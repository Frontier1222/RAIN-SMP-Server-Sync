import { world, system, EquipmentSlot, ItemComponentTypes, ItemLockMode, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { notify, toastDeny, toastSuccess, toastInfo, toastError } from "../utils/realmPerf.js";
import { isStaffPlayer } from "./ranks.js";
import { pickInventorySlot } from "./auction/utils/inventoryPick.js";
import { buildItemDataFromItemStack, buildItemStackFromItemData } from "./auction/utils/itemDisplay.js";

export const BOUNTY_TARGET_TAG = "bounty_target";
export const BOUNTY_ACCESS_TAG = "bounty";
export const BOUNTY_MODE_TAG = "bounty_mode";
export const BOUNTY_KIT_MARKER = "§r§8RAIN_BOUNTY_KIT";
export const BOUNTY_NPC_ID = "npc:bounty_contracts";
const BOUNTY_BOARD_NAME = "§eBounty Board";
const BOUNTIES_KEY = "nf.bounties";
const MURASAME_ID = "viberater:epic_wither_sword";
const BOUNTY_MURASAME_EFFECTS = ["speed", "strength", "invisibility", "fire_resistance", "regeneration"];
const ACTIVE_CONTRACT_KEY = "rain:bounty_contract";
const PRIVATE_BOUNTY_REWARDS = [
    { typeId: "minecraft:netherite_ingot", amount: 4, label: "4 Netherite Ingots" },
    { typeId: "minecraft:diamond", amount: 10, label: "10 Diamonds" },
];
const bountyLoadouts = new Map();
const liveInstructionBooks = new Map();
const INSTRUCTION_BOOK_IDS = new Set(["minecraft:writable_book", "minecraft:written_book"]);
const SIGNED_INSTRUCTION_BOOK_IDS = new Set(["minecraft:written_book"]);
const ASSASSINATION_INSTRUCTION_PAGES = [
    {
        title: "Overview",
        body:
`§5§lASSASSINATION SHOP§r

§7Welcome to the Assassination Shop. If you want a target handled, start by taking an order form.

§fRequired on the form:
§71. Target name and your name
§72. Any special request
§73. Reason for the contract`,
    },
    {
        title: "Posting",
        body:
`§5§lPOSTING A CONTRACT§r

§7Use the Bounty Board to select the target, then choose Public or Private.

§aPublic contracts §7announce when posted.

§dPrivate contracts §7stay hidden until the target is killed.`,
    },
    {
        title: "Private",
        body:
`§5§lPRIVATE ORDERS§r

§7Private contracts require a signed Book and Quill with the instructions inside.

§7The signed book is collected with payment and handed to the hunter when they accept the contract.`,
    },
    {
        title: "Payment",
        body:
`§5§lPAYMENT§r

§7Public bounties use the reward item you select.

§7Private bounties cost one signed instruction book plus either:
§f- 4 Netherite Ingots
§f- 10 Diamonds

§cPosted contracts cannot be revoked.`,
    },
    {
        title: "Rules",
        body:
`§5§lCONTRACT LAW§r

§7Accepted hunters can fight the listed target through normal claim no-kill rules.

§7Bounty gear is locked to bounty mode and removed when the contract ends.`,
    },
];

function readStore() {
    const raw = world.getDynamicProperty(BOUNTIES_KEY);
    if (typeof raw !== "string" || !raw.length) return {};
    try {
        const obj = JSON.parse(raw);
        return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
        return {};
    }
}

function writeStore(store) {
    world.setDynamicProperty(BOUNTIES_KEY, JSON.stringify(store));
}

function isInstructionBook(item) {
    return INSTRUCTION_BOOK_IDS.has(item?.typeId);
}

function isSignedInstructionBook(item) {
    return SIGNED_INSTRUCTION_BOOK_IDS.has(item?.typeId);
}

function serializeInstructionBook(item) {
    if (!isInstructionBook(item)) return null;
    try {
        const data = buildItemDataFromItemStack(item, 1);
        if (!data?.typeId) return null;
        data.amount = 1;
        return data;
    } catch (e) {
        return {
            typeId: item.typeId,
            amount: 1,
            nameTag: String(item.nameTag || ""),
            lore: (() => {
                try {
                    return item.getLore?.() ?? [];
                } catch (err) {
                    return [];
                }
            })(),
        };
    }
}

function findSignedInstructionBook(container) {
    if (!container) return null;
    try {
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (isSignedInstructionBook(item)) return { slot: i, item };
        }
    } catch (e) {}
    return null;
}

function markInstructionBook(stack) {
    if (!stack) return stack;
    try {
        stack.keepOnDeath = true;
        stack.lockMode = ItemLockMode.inventory;
        const lore = stack.getLore?.() ?? [];
        const nextLore = lore.includes(BOUNTY_KIT_MARKER)
            ? lore
            : [...lore.slice(0, 18), BOUNTY_KIT_MARKER, "§r§5Private contract instructions"];
        stack.setLore(nextLore);
    } catch (e) {}
    return stack;
}

function makeFallbackInstructionBook(targetName, data) {
    const stack = new ItemStack("minecraft:writable_book", 1);
    stack.nameTag = String(data?.nameTag || `§5Instructions: ${targetName}`).slice(0, 64);
    try {
        const request = formatSpecialRequest(getBounty(targetName)?.specialRequest);
        stack.setLore([
            "§r§7Private contract instructions",
            `§r§7Target: §f${targetName}`,
            `§r§7Request: §f${request}`,
        ]);
    } catch (e) {}
    return markInstructionBook(stack);
}

function makeInstructionBookForHunter(targetName, bounty) {
    const key = String(targetName || "").toLowerCase();
    const live = liveInstructionBooks.get(key);
    if (live) {
        try {
            return markInstructionBook(live.clone());
        } catch (e) {}
    }

    const data = bounty?.instructionBook;
    if (data?.typeId) {
        try {
            const stack = buildItemStackFromItemData({ ...data, amount: 1 });
            if (stack) return markInstructionBook(stack);
        } catch (e) {}
    }
    return makeFallbackInstructionBook(targetName, data);
}

function giveInstructionBook(player, targetName, bounty) {
    const inv = getInventory(player);
    if (!inv) return false;
    const book = makeInstructionBookForHunter(targetName, bounty);
    try {
        const current = inv.getItem(1);
        if (!current) {
            inv.setItem(1, book);
            return true;
        }
    } catch (e) {}
    return addInventoryStack(inv, book);
}

function makeAssassinationOrderForm() {
    const stack = new ItemStack("minecraft:writable_book", 1);
    stack.nameTag = "§5Assassination Order Form";
    try {
        stack.setLore([
            "§r§7Write the target, your name,",
            "§r§7special request, and reason.",
            "§r§8Sign it before posting private.",
        ]);
    } catch (e) {}
    return stack;
}

function giveAssassinationOrderForm(player) {
    const inv = getInventory(player);
    if (!inv) {
        toastError(player, "§cCould not open your inventory.", "bounty_form_no_inv");
        return false;
    }
    if (addInventoryStack(inv, makeAssassinationOrderForm())) {
        toastSuccess(player, "§dAssassination order form added.", "bounty_form_given");
        return true;
    }
    toastDeny(player, "§cYour inventory is full.", "bounty_form_full");
    return false;
}

export function getAllBounties() {
    return readStore();
}

export function getBounty(targetName) {
    const name = String(targetName || "").trim();
    if (!name) return null;
    return readStore()[name] || null;
}

export function isBountyTarget(player) {
    return !!player?.hasTag(BOUNTY_TARGET_TAG);
}

export function hasBountyAccess(player) {
    return !!player?.hasTag(BOUNTY_ACCESS_TAG) || isStaffPlayer(player);
}

export function isBountyHunterActive(player) {
    return !!player?.hasTag(BOUNTY_MODE_TAG);
}

export function isBountyKitItem(item) {
    if (!item) return false;
    try {
        return (item.getLore?.() ?? []).includes(BOUNTY_KIT_MARKER);
    } catch (e) {
        return false;
    }
}

export function canUseBountyMurasame(player, item) {
    return isBountyHunterActive(player) && item?.typeId === MURASAME_ID && isBountyKitItem(item);
}

export function syncBountyTag(player) {
    if (!player?.isValid) return;
    const bounty = getBounty(player.name);
    if (bounty) {
        if (!player.hasTag(BOUNTY_TARGET_TAG)) player.addTag(BOUNTY_TARGET_TAG);
    } else if (player.hasTag(BOUNTY_TARGET_TAG)) {
        player.removeTag(BOUNTY_TARGET_TAG);
    }
}

function sanitizeSpecialRequest(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
}

function formatSpecialRequest(text) {
    const request = sanitizeSpecialRequest(text);
    return request || "No special request.";
}

function itemDisplayName(data) {
    if (data?.nameTag) return data.nameTag;
    const typeId = String(data?.typeId || "");
    return typeId.split(":").pop()?.replace(/_/g, " ") || typeId || "Unknown Item";
}

function normalizeReward(data) {
    if (data?.reward?.typeId && data?.reward?.amount) {
        return {
            typeId: String(data.reward.typeId),
            amount: Math.max(1, Math.floor(Number(data.reward.amount) || 1)),
            nameTag: String(data.reward.nameTag || ""),
            lore: Array.isArray(data.reward.lore) ? data.reward.lore.map(String).slice(0, 20) : [],
            label: String(data.reward.label || `${data.reward.amount} ${itemDisplayName(data.reward)}`),
        };
    }
    return {
        typeId: "minecraft:diamond",
        amount: Math.max(1, Math.floor(Number(data?.amount) || 1)),
        label: `${Math.max(1, Math.floor(Number(data?.amount) || 1))} Diamonds`,
    };
}

function formatReward(data) {
    return normalizeReward(data).label;
}

function makeRewardFromStack(stack, amount) {
    if (!stack?.typeId) return null;
    const rewardAmount = Math.max(1, Math.min(stack.amount ?? 1, Math.floor(Number(amount) || 1)));
    const data = {
        typeId: stack.typeId,
        amount: rewardAmount,
        nameTag: String(stack.nameTag || ""),
        lore: [],
    };
    try {
        data.lore = (stack.getLore?.() ?? []).map(String).slice(0, 20);
    } catch (e) {}
    data.label = `${rewardAmount} ${itemDisplayName(data)}`;
    return data;
}

function makeRewardStack(reward) {
    const data = normalizeReward({ reward });
    const stack = new ItemStack(data.typeId, data.amount);
    if (data.nameTag) stack.nameTag = data.nameTag;
    try {
        if (data.lore?.length) stack.setLore(data.lore);
    } catch (e) {}
    return stack;
}

export function placeBounty(targetName, reward, placedBy, specialRequest = "", isPrivate = false, instructionBook = null) {
    const name = String(targetName || "").trim();
    const selectedReward = normalizeReward({ reward });
    if (!name || !selectedReward.typeId || selectedReward.amount <= 0) return false;
    const serializedBook = isPrivate ? serializeInstructionBook(instructionBook) : null;

    const store = readStore();
    store[name] = {
        amount: selectedReward.amount,
        reward: selectedReward,
        placedBy: String(placedBy || "Unknown"),
        placedAt: Date.now(),
        specialRequest: sanitizeSpecialRequest(specialRequest),
        private: isPrivate === true,
        instructionBook: serializedBook,
    };
    writeStore(store);
    if (serializedBook && instructionBook) {
        try {
            liveInstructionBooks.set(name.toLowerCase(), instructionBook.clone());
        } catch (e) {}
    }

    for (const player of world.getAllPlayers()) {
        if (player.name === name) syncBountyTag(player);
    }
    if (!isPrivate) {
        world.sendMessage(
            `§6§l[BOUNTY]§r §eNew public contract posted\n` +
            `§7Target: §f${name} §8| §7Reward: §a${selectedReward.label}\n` +
            `§7Posted by: §f${placedBy || "Someone"}`
        );
    }

    return true;
}

export function clearBounty(targetName) {
    const name = String(targetName || "").trim();
    if (!name) return false;

    const store = readStore();
    if (!store[name]) return false;
    delete store[name];
    writeStore(store);
    liveInstructionBooks.delete(name.toLowerCase());

    for (const player of world.getAllPlayers()) {
        if (player.name === name) syncBountyTag(player);
    }

    return true;
}

function getActiveContractTarget(player) {
    try {
        const raw = player?.getDynamicProperty(ACTIVE_CONTRACT_KEY);
        return typeof raw === "string" ? raw : "";
    } catch (e) {
        return "";
    }
}

/** Accepted bounty contracts may be attacked even in PVP-disabled claims / safe zones. */
export function allowsBountyPvp(victim, attacker) {
    if (!victim?.isValid || !attacker?.isValid) return false;
    if (victim.typeId !== "minecraft:player" || attacker.typeId !== "minecraft:player") return false;
    if (!victim.name) return false;
    if (!isBountyHunterActive(attacker)) return false;
    const targetName = getActiveContractTarget(attacker);
    if (!targetName) return false;
    if (targetName.toLowerCase() !== victim.name.toLowerCase()) return false;
    return !!getBounty(victim.name) || isBountyTarget(victim);
}

/** Active hunters may only damage the exact player on their accepted contract. */
export function blocksBountyHunterPvp(victim, attacker) {
    if (!victim?.isValid || !attacker?.isValid) return false;
    if (victim.typeId !== "minecraft:player" || attacker.typeId !== "minecraft:player") return false;
    if (!isBountyHunterActive(attacker)) return false;
    return !allowsBountyPvp(victim, attacker);
}

/** Bounty targets cannot open containers in claims they do not own. */
export function blocksBountyContainerAccess(player, plot) {
    if (!player || !plot || !isBountyTarget(player)) return false;
    if (plot.ownerId === player.id) return false;
    if (String(plot.ownerName || plot.owner || "").toLowerCase() === player.name.toLowerCase()) return false;
    if (Array.isArray(plot.members) && plot.members.map((n) => String(n).toLowerCase()).includes(player.name.toLowerCase())) {
        return false;
    }
    return true;
}

/** Active hunters keep the kit isolated; doors are okay, storage is not. */
export function blocksBountyModeContainerAccess(player) {
    return isBountyHunterActive(player);
}

export function denyBountyContainer(player) {
    toastDeny(player, "§cBounty mode cannot open storage containers.", "bounty_container_block");
}

function getInventory(player) {
    return player?.getComponent("minecraft:inventory")?.container
        ?? player?.getComponent("inventory")?.container;
}

function getEquippable(player) {
    return player?.getComponent("minecraft:equippable")
        ?? player?.getComponent("equippable");
}

function markBountyBoard(entity) {
    if (!entity?.isValid || entity.typeId !== BOUNTY_NPC_ID) return;
    try {
        entity.nameTag = BOUNTY_BOARD_NAME;
        entity.addTag?.("bounty_npc");
    } catch (e) {}
}

function addEnchant(stack, id, level) {
    try {
        const type = EnchantmentTypes.get(id);
        const ench = stack.getComponent(ItemComponentTypes.Enchantable);
        if (type && ench) ench.addEnchantment({ type, level });
    } catch (e) {}
}

function countInventoryItem(container, typeId) {
    if (!container) return 0;
    let count = 0;
    try {
        for (let i = 0; i < container.size; i++) {
            const stack = container.getItem(i);
            if (stack?.typeId === typeId) count += stack.amount ?? 1;
        }
    } catch (e) {}
    return count;
}

function removeInventoryItem(container, typeId, amount) {
    if (!container || amount <= 0) return false;
    let remaining = amount;
    try {
        for (let i = 0; i < container.size && remaining > 0; i++) {
            const stack = container.getItem(i);
            if (stack?.typeId !== typeId) continue;
            const stackAmount = stack.amount ?? 1;
            if (stackAmount <= remaining) {
                container.setItem(i, undefined);
                remaining -= stackAmount;
            } else {
                stack.amount = stackAmount - remaining;
                container.setItem(i, stack);
                remaining = 0;
            }
        }
    } catch (e) {
        return false;
    }
    return remaining <= 0;
}

function addInventoryStack(container, stack) {
    if (!container) return false;
    try {
        if ((container.emptySlotsCount ?? 0) <= 0) return false;
    } catch (e) {
        return false;
    }
    try {
        const leftover = container.addItem(stack);
        return !leftover;
    } catch (e) {}
    return false;
}

function addInventoryItem(container, typeId, amount) {
    return addInventoryStack(container, new ItemStack(typeId, amount));
}

function removeSlotAmount(container, slot, amount) {
    if (!container || !Number.isInteger(slot) || amount <= 0) return false;
    try {
        const stack = container.getItem(slot);
        if (!stack || (stack.amount ?? 1) < amount) return false;
        if ((stack.amount ?? 1) === amount) {
            container.setItem(slot, undefined);
        } else {
            stack.amount = (stack.amount ?? 1) - amount;
            container.setItem(slot, stack);
        }
        return true;
    } catch (e) {
        return false;
    }
}

function takeBountyPostPayment(player, slot, reward) {
    const inv = getInventory(player);
    if (!inv) return null;
    const selectedReward = normalizeReward({ reward });

    const live = inv.getItem(slot);
    if (live?.typeId !== selectedReward.typeId || (live.amount ?? 1) < selectedReward.amount) {
        toastDeny(player, "§cThat reward item is no longer in the selected slot.", "bounty_cost_missing");
        return null;
    }

    if (!removeSlotAmount(inv, slot, selectedReward.amount)) {
        toastError(player, "§cCould not take the bounty reward payment.", "bounty_cost_fail");
        return null;
    }
    return selectedReward;
}

function removeBountyMurasameEffects(player) {
    for (const effect of BOUNTY_MURASAME_EFFECTS) {
        try {
            player.removeEffect(effect);
        } catch (e) {}
    }
}

function markKit(stack) {
    stack.keepOnDeath = true;
    stack.lockMode = ItemLockMode.inventory;
    stack.setLore([BOUNTY_KIT_MARKER, "§r§5Bounty contract gear"]);
    return stack;
}

function makeArmor(typeId, name) {
    const stack = markKit(new ItemStack(typeId, 1));
    stack.nameTag = `§5${name}`;
    addEnchant(stack, "protection", 4);
    addEnchant(stack, "unbreaking", 3);
    addEnchant(stack, "mending", 1);
    return stack;
}

function makeBountyMurasame() {
    const stack = markKit(new ItemStack(MURASAME_ID, 1));
    stack.nameTag = "§cMurasame §5Contract";
    addEnchant(stack, "sharpness", 5);
    addEnchant(stack, "unbreaking", 3);
    addEnchant(stack, "mending", 1);
    return stack;
}

function snapshotLoadout(player) {
    const inv = getInventory(player);
    const eq = getEquippable(player);
    if (!inv || !eq) return null;

    const inventory = [];
    for (let i = 0; i < inv.size; i++) inventory[i] = inv.getItem(i)?.clone();
    return {
        inventory,
        equipment: {
            [EquipmentSlot.Head]: eq.getEquipment(EquipmentSlot.Head)?.clone(),
            [EquipmentSlot.Chest]: eq.getEquipment(EquipmentSlot.Chest)?.clone(),
            [EquipmentSlot.Legs]: eq.getEquipment(EquipmentSlot.Legs)?.clone(),
            [EquipmentSlot.Feet]: eq.getEquipment(EquipmentSlot.Feet)?.clone(),
            [EquipmentSlot.Offhand]: eq.getEquipment(EquipmentSlot.Offhand)?.clone(),
        },
    };
}

function stripBountyKit(player) {
    const inv = getInventory(player);
    const eq = getEquippable(player);
    try {
        if (inv) {
            for (let i = 0; i < inv.size; i++) {
                if (isBountyKitItem(inv.getItem(i))) inv.setItem(i, undefined);
            }
        }
        if (eq) {
            for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand, EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet]) {
                if (isBountyKitItem(eq.getEquipment(slot))) eq.setEquipment(slot, undefined);
            }
        }
    } catch (e) {}
}

function restoreLoadout(player) {
    const saved = bountyLoadouts.get(player.id);
    const inv = getInventory(player);
    const eq = getEquippable(player);
    if (!saved || !inv || !eq) return false;

    stripBountyKit(player);
    inv.clearAll();
    for (let i = 0; i < inv.size; i++) {
        const item = saved.inventory[i];
        if (item) inv.setItem(i, item);
    }
    eq.setEquipment(EquipmentSlot.Head, saved.equipment[EquipmentSlot.Head]);
    eq.setEquipment(EquipmentSlot.Chest, saved.equipment[EquipmentSlot.Chest]);
    eq.setEquipment(EquipmentSlot.Legs, saved.equipment[EquipmentSlot.Legs]);
    eq.setEquipment(EquipmentSlot.Feet, saved.equipment[EquipmentSlot.Feet]);
    eq.setEquipment(EquipmentSlot.Offhand, saved.equipment[EquipmentSlot.Offhand]);
    bountyLoadouts.delete(player.id);
    return true;
}

function equipBountyKit(player) {
    const inv = getInventory(player);
    const eq = getEquippable(player);
    if (!inv || !eq) return false;

    try {
        inv.clearAll();
        eq.setEquipment(EquipmentSlot.Head, makeArmor("ftb_tc:manyullyn_helmet", "Manyullyn Helmet"));
        eq.setEquipment(EquipmentSlot.Chest, makeArmor("ftb_tc:manyullyn_chestplate", "Manyullyn Chestplate"));
        eq.setEquipment(EquipmentSlot.Legs, makeArmor("ftb_tc:manyullyn_leggings", "Manyullyn Leggings"));
        eq.setEquipment(EquipmentSlot.Feet, makeArmor("ftb_tc:manyullyn_boots", "Manyullyn Boots"));
        inv.setItem(0, makeBountyMurasame());
        player.selectedSlotIndex = 0;
        return true;
    } catch (e) {
        return false;
    }
}

function endBountyMode(player, message = "§7Bounty mode ended.") {
    if (!player?.isValid) return;
    removeBountyMurasameEffects(player);
    restoreLoadout(player);
    if (player.hasTag(BOUNTY_MODE_TAG)) player.removeTag(BOUNTY_MODE_TAG);
    try {
        player.setDynamicProperty(ACTIVE_CONTRACT_KEY, undefined);
    } catch (e) {}
    toastInfo(player, message, "bounty_mode_end");
}

function acceptContract(player, targetName) {
    const name = String(targetName || "").trim();
    if (!hasBountyAccess(player)) {
        toastDeny(player, "§cYou need the bounty tag to accept contracts.", "bounty_no_access");
        return false;
    }
    const bounty = getBounty(name);
    if (!bounty) {
        toastDeny(player, "§cThat bounty is no longer available.", "bounty_missing");
        return false;
    }
    if (name.toLowerCase() === player.name.toLowerCase()) {
        toastDeny(player, "§cYou cannot accept your own bounty.", "bounty_self");
        return false;
    }
    if (isBountyHunterActive(player)) endBountyMode(player, "§7Previous bounty contract closed.");

    const saved = snapshotLoadout(player);
    if (!saved) {
        toastError(player, "§cCould not store your inventory.", "bounty_store_fail");
        return false;
    }
    bountyLoadouts.set(player.id, saved);
    if (!equipBountyKit(player)) {
        restoreLoadout(player);
        toastError(player, "§cCould not equip bounty kit.", "bounty_kit_fail");
        return false;
    }
    player.addTag(BOUNTY_MODE_TAG);
    player.setDynamicProperty(ACTIVE_CONTRACT_KEY, name);
    if (bounty.private) {
        if (giveInstructionBook(player, name, bounty)) {
            toastInfo(player, "§dPrivate instructions added to your kit.", "bounty_private_book_given");
        } else {
            toastError(player, "§cCould not add the private instruction book.", "bounty_private_book_give_fail");
        }
    }
    toastSuccess(player, `§dContract accepted: §f${name}`, "bounty_accept");
    return true;
}

async function openPlaceBountyForm(player) {
    const players = world.getAllPlayers();
    if (!players.length) {
        toastDeny(player, "§cNo online targets available.", "bounty_no_targets");
        return;
    }
    const result = await new ModalFormData()
        .title("bd.modal:Bounty Board")
        .dropdown("Target", players.map((p) => p.name), { defaultValueIndex: Math.max(0, players.findIndex((p) => p.name === player.name)) })
        .dropdown("Visibility", ["Public - announce when posted", "Private - announce only on completion"], { defaultValueIndex: 0 })
        .textField("Special Request", "Optional instructions for the hunter")
        .show(player);
    if (result.canceled) return;
    const [targetIndex, visibilityIndex, specialRequestRaw] = result.formValues;
    const target = players[targetIndex];
    if (!target) return;

    await openBountyPaymentMenu(player, target.name, specialRequestRaw, visibilityIndex === 1);
}

async function openBountyPaymentMenu(player, targetName, specialRequestRaw, isPrivate) {
    if (isPrivate) return openPrivateBountyPaymentMenu(player, targetName, specialRequestRaw);

    const form = new ActionFormData()
        .title("bd.action:§5Fund Contract")
        .body(
            `§5§lBOUNTY PAYMENT§r\n\n` +
            `§7Target: §f${targetName}\n` +
            `§7Visibility: ${isPrivate ? "§dPrivate" : "§aPublic"}\n` +
            `§7Special Request: §f${formatSpecialRequest(specialRequestRaw)}\n\n` +
            `§7Choose a reward from your hotbar or inventory. The selected amount is removed when you confirm.`
        )
        .button("§ePick Reward Item")
        .button("§8Cancel");

    const result = await form.show(player);
    if (result.canceled || result.selection === 1) return openBountyBoard(player);
    if (result.selection !== 0) return openBountyBoard(player);

    const pick = await pickInventorySlot(player, "Bounty Reward");
    if (!pick?.item) return openBountyPaymentMenu(player, targetName, specialRequestRaw, isPrivate);
    await openBountyRewardAmountMenu(player, targetName, specialRequestRaw, isPrivate, pick.slot, pick.item);
}

async function openPrivateBountyPaymentMenu(player, targetName, specialRequestRaw) {
    const form = new ActionFormData()
        .title("bd.action:§5Private Contract")
        .body(
            `§5§lPRIVATE BOUNTY§r\n\n` +
            `§7Target: §f${targetName}\n` +
            `§7Visibility: §dPrivate §8(announces only when complete)\n` +
            `§7Special Request: §f${formatSpecialRequest(specialRequestRaw)}\n\n` +
            `§7Private contracts require a signed Book and Quill plus fixed payment.\n` +
            `§8The signed book is given to the hunter when they accept.`
        );

    for (const reward of PRIVATE_BOUNTY_REWARDS) form.button(`§d${reward.label}`);
    form.button("§8Cancel");

    const result = await form.show(player);
    if (result.canceled || result.selection === PRIVATE_BOUNTY_REWARDS.length) return openBountyBoard(player);

    const reward = PRIVATE_BOUNTY_REWARDS[result.selection];
    if (!reward) return openBountyBoard(player);

    const inv = getInventory(player);
    const bookPick = findSignedInstructionBook(inv);
    if (!bookPick?.item) {
        toastDeny(player, "§cPrivate bounties require a signed Book and Quill in your inventory.", "bounty_private_book_missing");
        return openPrivateBountyPaymentMenu(player, targetName, specialRequestRaw);
    }
    if (countInventoryItem(inv, reward.typeId) < reward.amount) {
        toastDeny(player, `§cYou need ${reward.label} to post this private bounty.`, "bounty_private_cost_missing");
        return openPrivateBountyPaymentMenu(player, targetName, specialRequestRaw);
    }

    const instructionBook = bookPick.item.clone();
    if (!removeInventoryItem(inv, reward.typeId, reward.amount)) {
        toastError(player, "§cCould not take the bounty payment.", "bounty_private_cost_fail");
        return;
    }
    if (!removeSlotAmount(inv, bookPick.slot, 1)) {
        addInventoryItem(inv, reward.typeId, reward.amount);
        toastError(player, "§cCould not take the signed instruction book.", "bounty_private_book_fail");
        return;
    }

    if (placeBounty(targetName, reward, player.name, specialRequestRaw, true, instructionBook)) {
        toastSuccess(player, `§dPrivate bounty posted for §f${targetName} §8- §7Reward: ${reward.label}`, "bounty_posted");
    } else {
        addInventoryItem(inv, reward.typeId, reward.amount);
        addInventoryStack(inv, instructionBook);
        toastError(player, "§cCould not post bounty.", "bounty_post_fail");
    }
}

async function openBountyRewardAmountMenu(player, targetName, specialRequestRaw, isPrivate, slot, item) {
    const max = Math.max(1, item.amount ?? 1);
    const result = await new ModalFormData()
        .title("bd.modal:Bounty Reward")
        .textField("Amount", `1-${max}`, { defaultValue: String(max) })
        .show(player);
    if (result.canceled) return openBountyPaymentMenu(player, targetName, specialRequestRaw, isPrivate);

    const amount = Math.max(1, Math.min(max, Math.floor(Number(result.formValues?.[0]) || max)));
    const reward = makeRewardFromStack(item, amount);
    if (!reward) {
        toastError(player, "§cCould not read that reward item.", "bounty_reward_fail");
        return openBountyPaymentMenu(player, targetName, specialRequestRaw, isPrivate);
    }

    const payment = takeBountyPostPayment(player, slot, reward);
    if (!payment) return;

    if (placeBounty(targetName, payment, player.name, specialRequestRaw, isPrivate)) {
        toastSuccess(player, `§d${isPrivate ? "Private" : "Public"} bounty posted for §f${targetName} §8- §7Reward: ${payment.label}`, "bounty_posted");
    } else {
        addInventoryStack(getInventory(player), makeRewardStack(payment));
        toastError(player, "§cCould not post bounty.", "bounty_post_fail");
    }
}

function contractDetailPages(targetName, data) {
    const request = formatSpecialRequest(data?.specialRequest);
    return [
        {
            title: "Overview",
            body:
                `§5§lBOUNTY CONTRACT§r\n\n` +
                `§7Target\n§f${targetName}\n\n` +
                `§7Reward\n§a${formatReward(data)}\n\n` +
                `§7Visibility\n${data?.private ? "§dPrivate" : "§aPublic"}`,
        },
        {
            title: "Details",
            body:
                `§5§lCONTRACT DETAILS§r\n\n` +
                `§7Posted By\n§f${data?.placedBy || "Unknown"}\n\n` +
                `§7Special Request\n§f${request}`,
        },
        {
            title: "Rules",
            body:
                `§5§lACCEPTANCE RULES§r\n\n` +
                `§7Bounty mode lets you enter claims and attack only this contract target.\n\n` +
                `§cYou cannot damage random players while bounty mode is active.`,
        },
    ];
}

async function openContractDetails(player, targetName, data, page = 0) {
    const pages = contractDetailPages(targetName, data);
    const index = Math.max(0, Math.min(pages.length - 1, Number(page) || 0));
    const current = pages[index];
    const form = new ActionFormData()
        .title(`bd.action:§5Contract - ${current.title}`)
        .body(`${current.body}\n\n§8Page §f${index + 1}/${pages.length}`)
        .button("§ePrevious")
        .button("§eNext")
        .button("§dAccept Contract")
        .button("§8Back");
    const result = await form.show(player);
    if (result.canceled || result.selection === 3) return openContracts(player);
    if (result.selection === 0) return openContractDetails(player, targetName, data, index <= 0 ? pages.length - 1 : index - 1);
    if (result.selection === 1) return openContractDetails(player, targetName, data, index >= pages.length - 1 ? 0 : index + 1);
    if (result.selection === 2) acceptContract(player, targetName);
}

async function openAssassinationInstructions(player, page = 0) {
    const pages = ASSASSINATION_INSTRUCTION_PAGES;
    const index = Math.max(0, Math.min(pages.length - 1, Number(page) || 0));
    const current = pages[index];
    const form = new ActionFormData()
        .title(`bd.action:§5Instructions - ${current.title}`)
        .body(`${current.body}\n\n§8Page §f${index + 1}/${pages.length}`)
        .button("§ePrevious")
        .button("§eNext")
        .button("§dGive Book")
        .button("§8Back");

    const result = await form.show(player);
    if (!result || result.canceled || result.selection === 3) return openBountyBoard(player);
    if (result.selection === 0) return openAssassinationInstructions(player, index <= 0 ? pages.length - 1 : index - 1);
    if (result.selection === 1) return openAssassinationInstructions(player, index >= pages.length - 1 ? 0 : index + 1);
    if (result.selection === 2) {
        giveAssassinationOrderForm(player);
        return openAssassinationInstructions(player, index);
    }
}

async function openContracts(player, page = 0) {
    const entries = Object.entries(getAllBounties()).filter(([name]) => name.toLowerCase() !== player.name.toLowerCase());
    const pageSize = 6;
    const maxPage = Math.max(0, Math.ceil(entries.length / pageSize) - 1);
    const index = Math.max(0, Math.min(maxPage, Number(page) || 0));
    const visible = entries.slice(index * pageSize, index * pageSize + pageSize);
    const form = new ActionFormData()
        .title("bd.action:§5Bounty Contracts")
        .body(entries.length
            ? `§7Select a contract to view the full details.\n\n§8Page §f${index + 1}/${maxPage + 1}`
            : "§7No contracts are currently posted.");
    form.button("§ePrevious");
    form.button("§eNext");
    for (const [name, data] of visible) form.button(`§d${name}\n§7Reward: §a${formatReward(data)}`);
    form.button("§8Back");
    const result = await form.show(player);
    if (result.canceled || result.selection === visible.length + 2) return openBountyBoard(player);
    if (result.selection === 0) return openContracts(player, index <= 0 ? maxPage : index - 1);
    if (result.selection === 1) return openContracts(player, index >= maxPage ? 0 : index + 1);
    const [target, data] = visible[result.selection - 2] ?? [];
    if (target) await openContractDetails(player, target, data);
}

export async function openBountyBoard(player) {
    const active = isBountyHunterActive(player);
    const target = getActiveContractTarget(player);
    const form = new ActionFormData()
        .title("bd.action:§5Bounty Board")
        .body(active
            ? `§5§lACTIVE CONTRACT§r\n§7Target: §f${target}`
            : `§7Create funded contracts or accept open hits.\n\n§8Posters choose a reward after selecting a target. Hunters can inspect full contract details before accepting.`);
    form.button(active ? "§cLeave Bounty Mode" : hasBountyAccess(player) ? "§dAccept Contract" : "§8Accept Contract");
    form.button("§5Set Bounty");
    form.button("§5Assainations Instructures");
    form.button("§8Close");
    const result = await form.show(player);
    if (result.canceled || result.selection === 3) return;
    if (result.selection === 0) {
        if (active) endBountyMode(player);
        else if (hasBountyAccess(player)) await openContracts(player);
        else toastDeny(player, "§cYou need the bounty tag to accept contracts.", "bounty_no_access");
        return;
    }
    if (result.selection === 1) await openPlaceBountyForm(player);
    if (result.selection === 2) await openAssassinationInstructions(player);
}

export function initBountyRuntime() {
    if (world.beforeEvents?.playerInteractWithEntity) {
        world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
            const player = event.player;
            const target = event.target;
            if (!player || !target) return;
            if (target.typeId !== BOUNTY_NPC_ID && !target.hasTag?.("bounty_npc")) return;
            markBountyBoard(target);
            event.cancel = true;
            system.run(() => openBountyBoard(player));
        });
    }

    if (world.afterEvents?.entitySpawn) {
        world.afterEvents.entitySpawn.subscribe((event) => {
            system.run(() => markBountyBoard(event.entity));
        });
    }

    system.runInterval(() => {
        for (const dimensionId of ["overworld", "nether", "the_end"]) {
            try {
                const dimension = world.getDimension(dimensionId);
                for (const entity of dimension.getEntities({ type: BOUNTY_NPC_ID })) markBountyBoard(entity);
            } catch (e) {}
        }
    }, 20);

    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            system.run(() => {
                syncBountyTag(event.player);
                if (isBountyHunterActive(event.player) && !bountyLoadouts.has(event.player.id)) {
                    removeBountyMurasameEffects(event.player);
                    event.player.removeTag(BOUNTY_MODE_TAG);
                    stripBountyKit(event.player);
                    event.player.setDynamicProperty(ACTIVE_CONTRACT_KEY, undefined);
                }
            });
        });
    }

    if (world.beforeEvents?.playerDropItem) {
        world.beforeEvents.playerDropItem.subscribe((event) => {
            if (!isBountyKitItem(event.itemStack)) return;
            event.cancel = true;
            toastDeny(event.source, "§cBounty kit items cannot be dropped.", "bounty_no_drop");
        });
    }

    if (world.afterEvents?.playerInventoryItemChange) {
        world.afterEvents.playerInventoryItemChange.subscribe((event) => {
            const player = event.player;
            const item = event.itemStack ?? event.newItemStack;
            if (!isBountyKitItem(item)) return;
            if (isBountyHunterActive(player)) return;
            system.run(() => stripBountyKit(player));
        });
    }

    if (world.afterEvents?.entityDie) {
        world.afterEvents.entityDie.subscribe((event) => {
            const victim = event.deadEntity;
            if (victim?.typeId !== "minecraft:player") return;
            const attacker = event.damageSource?.damagingEntity;
            const bounty = getBounty(victim.name);
            if (bounty) {
                const completedByContract = attacker?.typeId === "minecraft:player" && allowsBountyPvp(victim, attacker);
                const reward = normalizeReward(bounty);
                clearBounty(victim.name);
                world.sendMessage(
                    `§6§l[BOUNTY]§r §aContract completed\n` +
                    `§7Target: §f${victim.name}${attacker?.typeId === "minecraft:player" ? ` §8| §7Hunter: §f${attacker.name}` : ""}\n` +
                    `§7Reward: §a${reward.label}`
                );
                if (completedByContract) {
                    endBountyMode(attacker, `§dContract complete. Reward: §f${reward.label}`);
                    if (addInventoryStack(getInventory(attacker), makeRewardStack(reward))) {
                        toastSuccess(attacker, `§aReward claimed: §f${reward.label}`, "bounty_reward_claimed");
                    } else {
                        try {
                            attacker.dimension.spawnItem(makeRewardStack(reward), attacker.location);
                        } catch (e) {}
                        toastInfo(attacker, `§eReward dropped: §f${reward.label}`, "bounty_reward_dropped");
                    }
                }
                for (const player of world.getAllPlayers()) {
                    if (player.id === attacker?.id) continue;
                    if (isBountyHunterActive(player) && getActiveContractTarget(player).toLowerCase() === victim.name.toLowerCase()) {
                        endBountyMode(player, "§7Bounty contract closed.");
                    }
                }
            }
            if (isBountyHunterActive(victim)) {
                system.run(() => endBountyMode(victim, "§7Bounty mode ended on death."));
            }
        });
    }
}
