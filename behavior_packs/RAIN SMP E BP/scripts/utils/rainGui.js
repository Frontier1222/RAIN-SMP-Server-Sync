import { ItemComponentTypes, ItemLockMode, ItemStack, system, world } from "@minecraft/server";
import { nextRealmPlayer, REALM_STAGGER, registerRealmHook } from "./realmPerf.js";
import { isVanished } from "./vanish.js";
import { isRainGuiBlocked, syncRainGuiBlockState } from "../systems/ranks.js";
import { isLivePlayer } from "./livePlayer.js";

export const RECEIVED_GUI_KEY = "rain_smp_received_gui";
export const RECEIVED_GUI_TAG = "received_gui";
export const RAIN_GUI_ITEM_ID = "bd:gui";
/** Default hotbar slot when first giving the item (not enforced). */
export const RAIN_GUI_HOTBAR_SLOT = 8;
/** All-caps bold purple display name for the Rain SMP GUI item. */
export const RAIN_GUI_DISPLAY_NAME = "§r§d§lRAIN SMP GUI";

const RAIN_GUI_LORE = [
    "§8§m────────────────",
    "§7OPEN YOUR §d§lRAIN SMP §7MENUS",
    "§fRIGHT-CLICK §7OR §fUSE §7THIS ITEM",
    "§8NEVER LOST ON DEATH",
    "§8§m────────────────",
];

/** Arena/spleef/soccer — no Rain GUI item or menu while in a minigame. */
export function isRainGuiMinigamePlayer(player) {
    if (!player) return false;
    try {
        return (
            player.hasTag("in_arena") ||
            player.hasTag("in_spleef") ||
            player.hasTag("in_soccer") ||
            player.hasTag("arena_pvp") ||
            player.hasTag("arena_player_1") ||
            player.hasTag("arena_player_2") ||
            player.hasTag("spleef_p1") ||
            player.hasTag("spleef_p2") ||
            player.hasTag("spleef_p3") ||
            player.hasTag("spleef_p4")
        );
    } catch (e) {
        return false;
    }
}

/** Coalesce inventory-change work to one flush per tick (Realm-friendly). */
const pendingRainGuiMaint = new Map();
let rainGuiMaintFlushQueued = false;

export function isRainGuiItem(stack) {
    return stack?.typeId === RAIN_GUI_ITEM_ID;
}

export function hasReceivedRainGui(player) {
    if (!isLivePlayer(player)) return false;
    try {
        if (player.hasTag(RECEIVED_GUI_TAG)) return true;
    } catch (e) {}
    try {
        const stored = player.getDynamicProperty(RECEIVED_GUI_KEY);
        return stored === true || stored === 1;
    } catch (e) {
        return false;
    }
}

export function markReceivedRainGui(player) {
    player.setDynamicProperty(RECEIVED_GUI_KEY, true);
    try {
        player.addTag(RECEIVED_GUI_TAG);
    } catch (e) {}
}

/** Backfill returning players so they are not treated as first-time joiners. */
export function migrateReceivedRainGui(player) {
    if (!isLivePlayer(player)) return;
    if (hasReceivedRainGui(player)) return;

    if (player.hasTag(RECEIVED_GUI_TAG)) {
        markReceivedRainGui(player);
        return;
    }

    const playtime = Number(player.getDynamicProperty("bd_playtime_ms") || 0);
    if (playtime > 0) {
        markReceivedRainGui(player);
        return;
    }

    const ownedPlots = player.getDynamicProperty("owned_plots");
    if (ownedPlots && ownedPlots !== "[]") {
        markReceivedRainGui(player);
    }
}

export function playerHasRainGuiItem(player) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;

    for (let i = 0; i < inv.size; i++) {
        if (isRainGuiItem(inv.getItem(i))) return true;
    }

    return false;
}

function rainGuiHasEnchantments(stack) {
    const ench = stack?.getComponent(ItemComponentTypes.Enchantable);
    if (!ench) return false;

    try {
        const list = typeof ench.getEnchantments === "function" ? ench.getEnchantments() : [];
        return Array.isArray(list) && list.length > 0;
    } catch (e) {
        return false;
    }
}

function loreMatches(stack) {
    try {
        const lore = stack?.getLore?.() ?? [];
        return lore.length === RAIN_GUI_LORE.length && lore[1] === RAIN_GUI_LORE[1];
    } catch (e) {
        return false;
    }
}

function rainGuiIsLocked(stack) {
    return stack?.lockMode === ItemLockMode.slot || stack?.lockMode === ItemLockMode.inventory;
}

function rainGuiNeedsSync(stack) {
    if (!isRainGuiItem(stack)) return false;
    return (
        stack.nameTag !== RAIN_GUI_DISPLAY_NAME ||
        !stack.keepOnDeath ||
        rainGuiIsLocked(stack) ||
        rainGuiHasEnchantments(stack) ||
        !loreMatches(stack)
    );
}

/** Name, lore, keep on death — movable in any inventory slot. */
export function applyRainGuiItemProps(stack) {
    if (!stack || !isRainGuiItem(stack)) return stack;

    stack.nameTag = RAIN_GUI_DISPLAY_NAME;
    stack.keepOnDeath = true;
    stack.lockMode = ItemLockMode.none;
    try {
        stack.setLore(RAIN_GUI_LORE);
    } catch (e) {}
    return stack;
}

/** Keeps display name; strips script-added enchants so tooltip stays clean. */
export function applyRainGuiGlint(stack) {
    if (!stack || !rainGuiNeedsSync(stack)) return stack;
    return applyRainGuiItemProps(stack);
}

export function createRainGuiStack() {
    return applyRainGuiItemProps(new ItemStack(RAIN_GUI_ITEM_ID, 1));
}

function findEmptyInventorySlot(container, preferSlot = -1) {
    if (preferSlot >= 0 && !container.getItem(preferSlot)) return preferSlot;
    for (let i = 0; i <= 8; i++) {
        if (!container.getItem(i)) return i;
    }
    for (let i = 9; i < container.size; i++) {
        if (!container.getItem(i)) return i;
    }
    return -1;
}

function stackFromInventoryEvent(ev) {
    return ev.itemStack ?? ev.newItemStack ?? ev.beforeItemStack;
}

/**
 * One inventory pass: dedupe, unlock/sync props, optional give-if-missing.
 * @returns {boolean} player has a Rain GUI item after maintenance
 */
export function maintainPlayerRainGui(player, { ensureIfEligible = false } = {}) {
    if (!player?.isValid) return false;
    if (isVanished(player)) return false;
    if (isRainGuiMinigamePlayer(player)) {
        stripRainGuiForGravestone(player);
        return false;
    }
    if (isRainGuiBlocked(player)) {
        stripRainGuiForGravestone(player);
        return false;
    }

    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;

    let kept = false;
    let hasGui = false;

    for (let i = 0; i < inv.size; i++) {
        const stack = inv.getItem(i);
        if (!isRainGuiItem(stack)) continue;

        if (!kept) {
            kept = true;
            hasGui = true;
            if (rainGuiNeedsSync(stack)) {
                try {
                    inv.setItem(i, applyRainGuiItemProps(stack));
                } catch (e) {}
            }
            continue;
        }

        try {
            inv.setItem(i, undefined);
        } catch (e) {}
    }

    if (hasGui) return true;
    if (!ensureIfEligible) return false;
    if (!hasReceivedRainGui(player)) return false;

    const slot = findEmptyInventorySlot(inv, RAIN_GUI_HOTBAR_SLOT);
    if (slot < 0) return false;

    try {
        inv.setItem(slot, createRainGuiStack());
        return true;
    } catch (e) {
        return false;
    }
}

function scheduleRainGuiMaintenance(player) {
    if (!player?.isValid || !hasReceivedRainGui(player)) return;
    if (isVanished(player) || isRainGuiMinigamePlayer(player)) return;
    pendingRainGuiMaint.set(player.id, player);
    if (rainGuiMaintFlushQueued) return;
    rainGuiMaintFlushQueued = true;
    system.run(flushRainGuiMaintenance);
}

function flushRainGuiMaintenance() {
    rainGuiMaintFlushQueued = false;
    if (!pendingRainGuiMaint.size) return;

    const batch = [...pendingRainGuiMaint.values()];
    pendingRainGuiMaint.clear();

    for (const player of batch) {
        if (!player?.isValid) continue;
        maintainPlayerRainGui(player);
    }
}

/** Realm backup: one player per ITEM_MAINT tick (round-robin). */
export function tickRainGuiRealmBackup(players) {
    const player = nextRealmPlayer(players);
    if (!player?.isValid || !hasReceivedRainGui(player) || isRainGuiMinigamePlayer(player)) return;
    maintainPlayerRainGui(player, { ensureIfEligible: true });
}

export function syncRainGuiGlintInContainer(container) {
    if (!container) return;
    for (let i = 0; i < container.size; i++) {
        const stack = container.getItem(i);
        if (!stack || !rainGuiNeedsSync(stack)) continue;
        try {
            container.setItem(i, applyRainGuiGlint(stack));
        } catch (e) {}
    }
}

/** Light sync before opening the menu (first GUI stack only). */
export function syncPlayerRainGuiGlint(player) {
    const inv = player?.getComponent("minecraft:inventory")?.container;
    if (!inv) return;

    for (let i = 0; i < inv.size; i++) {
        const stack = inv.getItem(i);
        if (!isRainGuiItem(stack)) continue;
        if (rainGuiNeedsSync(stack)) {
            try {
                inv.setItem(i, applyRainGuiItemProps(stack));
            } catch (e) {}
        }
        return;
    }
}

/** @deprecated Use maintainPlayerRainGui */
export function removeRainGuiDuplicates(player) {
    maintainPlayerRainGui(player);
}

/** Ensures the player has one movable Rain GUI; does not force a hotbar slot. */
export function ensureRainGuiItem(player) {
    if (!player) return false;
    if (isRainGuiMinigamePlayer(player)) {
        stripRainGuiForGravestone(player);
        return false;
    }
    if (isRainGuiBlocked(player)) {
        stripRainGuiForGravestone(player);
        return false;
    }
    if (!hasReceivedRainGui(player) && !playerHasRainGuiItem(player)) return false;
    return maintainPlayerRainGui(player, { ensureIfEligible: true });
}

/** @deprecated Use ensureRainGuiItem — no longer locks to hotbar. */
export const ensureRainGuiHotbar = ensureRainGuiItem;

/** Pull GUI from inventory on death so it is not dropped. */
export function stripRainGuiForGravestone(player) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;

    let stripped = false;
    for (let i = 0; i < inv.size; i++) {
        if (!isRainGuiItem(inv.getItem(i))) continue;
        try {
            inv.setItem(i, undefined);
            stripped = true;
        } catch (e) {}
    }
    return stripped;
}

export function giveRainGuiItem(player) {
    if (isRainGuiBlocked(player)) {
        stripRainGuiForGravestone(player);
        return false;
    }
    try {
        if (!hasReceivedRainGui(player)) markReceivedRainGui(player);
        ensureRainGuiItem(player);
        return true;
    } catch (e) {}

    return false;
}

/** First join only: mark persisted flag and give the Rain SMP GUI item once. */
export function giveRainGuiOnFirstJoin(player) {
    if (!isLivePlayer(player)) return false;
    if (isRainGuiBlocked(player)) {
        stripRainGuiForGravestone(player);
        return false;
    }
    migrateReceivedRainGui(player);
    if (hasReceivedRainGui(player)) {
        ensureRainGuiItem(player);
        return false;
    }

    markReceivedRainGui(player);
    giveRainGuiItem(player);
    return true;
}

function handleRainGuiPlayerDeath(player) {
    if (!player || player.typeId !== "minecraft:player") return;
    if (isRainGuiMinigamePlayer(player)) return;
    if (!playerHasRainGuiItem(player)) return;

    stripRainGuiForGravestone(player);
    try {
        player.setDynamicProperty("rain_gui_restore_pending", true);
    } catch (e) {}
}

// beforeEvents runs while inventory is still writable — gravestones use afterEvents.
if (world.beforeEvents?.entityDie) {
    world.beforeEvents.entityDie.subscribe((ev) => {
        handleRainGuiPlayerDeath(ev.deadEntity);
    });
} else if (world.afterEvents?.entityDie) {
    world.afterEvents.entityDie.subscribe((ev) => {
        handleRainGuiPlayerDeath(ev.deadEntity);
    });
}

if (world.afterEvents?.playerSpawn) {
    world.afterEvents.playerSpawn.subscribe((ev) => {
        const player = ev.player;
        if (!player) return;

        system.runTimeout(() => {
            if (!player.isValid) return;
            if (syncRainGuiBlockState(player)) {
                stripRainGuiForGravestone(player);
                return;
            }
            if (isRainGuiMinigamePlayer(player)) return;
            if (hasReceivedRainGui(player) || player.getDynamicProperty("rain_gui_restore_pending")) {
                try {
                    player.setDynamicProperty("rain_gui_restore_pending", undefined);
                } catch (e) {}
                maintainPlayerRainGui(player, { ensureIfEligible: true });
            }
        }, 5);
    });
}

if (world.afterEvents?.playerInventoryItemChange) {
    world.afterEvents.playerInventoryItemChange.subscribe((ev) => {
        const stack = stackFromInventoryEvent(ev);
        if (!isRainGuiItem(stack)) return;
        scheduleRainGuiMaintenance(ev.player);
    });
}

registerRealmHook(REALM_STAGGER.ITEM_MAINT, tickRainGuiRealmBackup);
