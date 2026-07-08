import { world, system, EquipmentSlot, ItemComponentTypes, ItemLockMode, ItemStack, EnchantmentTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { notify, toastDeny, toastSuccess, toastInfo, toastError } from "../utils/realmPerf.js";
import { isStaffPlayer } from "./ranks.js";

export const BOUNTY_TARGET_TAG = "bounty_target";
export const BOUNTY_ACCESS_TAG = "bounty";
export const BOUNTY_MODE_TAG = "bounty_mode";
export const BOUNTY_KIT_MARKER = "§r§8RAIN_BOUNTY_KIT";
export const BOUNTY_NPC_ID = "npc:bounty_contracts";
const BOUNTY_BOARD_NAME = "§eBounty Board";
const BOUNTIES_KEY = "nf.bounties";
const MURASAME_ID = "viberater:epic_wither_sword";
const BOUNTY_CONTRACT_COSTS = [
    { typeId: "minecraft:netherite_ingot", amount: 4, label: "4 Netherite Ingots" },
    { typeId: "minecraft:diamond", amount: 10, label: "10 Diamonds" },
];
const BOUNTY_MURASAME_EFFECTS = ["speed", "strength", "invisibility", "fire_resistance", "regeneration"];
const ACTIVE_CONTRACT_KEY = "rain:bounty_contract";
const bountyLoadouts = new Map();

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

export function placeBounty(targetName, amount, placedBy) {
    const name = String(targetName || "").trim();
    const reward = Math.max(0, Math.floor(Number(amount) || 0));
    if (!name || reward <= 0) return false;

    const store = readStore();
    store[name] = {
        amount: reward,
        placedBy: String(placedBy || "Unknown"),
        placedAt: Date.now(),
    };
    writeStore(store);

    for (const player of world.getAllPlayers()) {
        if (player.name === name) syncBountyTag(player);
    }
    world.sendMessage(`§6[Bounty] §e${placedBy || "Someone"} placed a bounty on §f${name}§e for §a${reward}§e.`);

    return true;
}

export function clearBounty(targetName) {
    const name = String(targetName || "").trim();
    if (!name) return false;

    const store = readStore();
    if (!store[name]) return false;
    delete store[name];
    writeStore(store);

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
    if (!victim || !attacker) return false;
    if (!isBountyHunterActive(attacker)) return false;
    return getActiveContractTarget(attacker).toLowerCase() === victim.name.toLowerCase() && !!getBounty(victim.name);
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

export function denyBountyContainer(player) {
    toastDeny(player, "§cBounty targets cannot open chests in other players' claims.", "bounty_no_chest");
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

function addInventoryItem(container, typeId, amount) {
    try {
        container?.addItem(new ItemStack(typeId, amount));
    } catch (e) {}
}

function takeContractPayment(player) {
    const inv = getInventory(player);
    if (!inv) return null;

    const payment = BOUNTY_CONTRACT_COSTS.find((cost) => countInventoryItem(inv, cost.typeId) >= cost.amount);
    if (!payment) {
        toastDeny(player, "§cAccepting a bounty costs §f4 Netherite Ingots §cor §f10 Diamonds§c.", "bounty_cost_missing");
        return null;
    }

    if (!removeInventoryItem(inv, payment.typeId, payment.amount)) {
        toastError(player, "§cCould not take the bounty contract payment.", "bounty_cost_fail");
        return null;
    }
    return payment;
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
        eq.setEquipment(EquipmentSlot.Mainhand, makeBountyMurasame());
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
    if (!getBounty(name)) {
        toastDeny(player, "§cThat bounty is no longer available.", "bounty_missing");
        return false;
    }
    if (name.toLowerCase() === player.name.toLowerCase()) {
        toastDeny(player, "§cYou cannot accept your own bounty.", "bounty_self");
        return false;
    }
    if (isBountyHunterActive(player)) endBountyMode(player, "§7Previous bounty contract closed.");

    const payment = takeContractPayment(player);
    if (!payment) return false;

    const saved = snapshotLoadout(player);
    if (!saved) {
        addInventoryItem(getInventory(player), payment.typeId, payment.amount);
        toastError(player, "§cCould not store your inventory.", "bounty_store_fail");
        return false;
    }
    bountyLoadouts.set(player.id, saved);
    if (!equipBountyKit(player)) {
        restoreLoadout(player);
        addInventoryItem(getInventory(player), payment.typeId, payment.amount);
        toastError(player, "§cCould not equip bounty kit.", "bounty_kit_fail");
        return false;
    }
    player.addTag(BOUNTY_MODE_TAG);
    player.setDynamicProperty(ACTIVE_CONTRACT_KEY, name);
    toastSuccess(player, `§dContract accepted: §f${name} §8- §7Paid ${payment.label}`, "bounty_accept");
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
        .textField("Reward", "1000")
        .show(player);
    if (result.canceled) return;
    const [targetIndex, amountRaw] = result.formValues;
    const target = players[targetIndex];
    if (!target) return;
    if (placeBounty(target.name, amountRaw, player.name)) {
        toastSuccess(player, `§dBounty posted for §f${target.name}`, "bounty_posted");
    } else {
        toastError(player, "§cCould not post bounty.", "bounty_post_fail");
    }
}

async function openContracts(player) {
    const entries = Object.entries(getAllBounties()).filter(([name]) => name.toLowerCase() !== player.name.toLowerCase());
    const form = new ActionFormData()
        .title("bd.action:§5Bounty Contracts")
        .body(entries.length ? "§7Cost: §f4 Netherite Ingots §7or §f10 Diamonds§7." : "§7No contracts are currently posted.");
    for (const [name, data] of entries) form.button(`§d${name}\n§7Reward: ${data.amount}`);
    form.button("§8Back");
    const result = await form.show(player);
    if (result.canceled || result.selection === entries.length) return openBountyBoard(player);
    const [target] = entries[result.selection] ?? [];
    if (target) acceptContract(player, target);
}

export async function openBountyBoard(player) {
    const active = isBountyHunterActive(player);
    const target = getActiveContractTarget(player);
    const form = new ActionFormData()
        .title("bd.action:§5Bounty Board")
        .body(active ? `§dActive Contract: §f${target}` : "§7Post bounties or accept a contract.");
    form.button(active ? "§cLeave Bounty Mode" : hasBountyAccess(player) ? "§dAccept Contract" : "§8Accept Contract");
    form.button("§5Set Bounty");
    form.button("§8Close");
    const result = await form.show(player);
    if (result.canceled || result.selection === 2) return;
    if (result.selection === 0) {
        if (active) endBountyMode(player);
        else if (hasBountyAccess(player)) await openContracts(player);
        else toastDeny(player, "§cYou need the bounty tag to accept contracts.", "bounty_no_access");
        return;
    }
    if (result.selection === 1) await openPlaceBountyForm(player);
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
                clearBounty(victim.name);
                world.sendMessage(`§6[Bounty] §f${victim.name}§e's bounty was completed${attacker?.typeId === "minecraft:player" ? ` by §f${attacker.name}` : ""}§e. Reward: §a${bounty.amount ?? 0}§e.`);
                if (completedByContract) {
                    endBountyMode(attacker, `§dContract complete. Reward: §f${bounty.amount ?? 0}`);
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
