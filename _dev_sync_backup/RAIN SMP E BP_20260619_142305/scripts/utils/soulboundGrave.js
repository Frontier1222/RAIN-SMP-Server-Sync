import { EquipmentSlot, system, world } from "@minecraft/server";

import { isRainGuiItem } from "./rainGui.js";

/** Tinkers' Construct Soulbound trait (amethyst bronze) — kept on death and restored on respawn. */
const AMETHYST_BRONZE = "amethyst_bronze";
const BINDING_CURSE_TOKENS = ["binding", "binding_curse"];
const VANISHING_CURSE_TOKENS = ["vanishing", "vanishing_curse"];

/** Player tag — full inventory kept on death (restored on respawn). */
export const GRAVE_KEEP_INV_TAG = "grave_keep_inv";

export function stripMcCodes(text) {
    return String(text ?? "").replace(/§./g, "");
}

export function isSoulboundItem(stack) {
    if (!stack) return false;

    const id = String(stack.typeId || "").toLowerCase();
    if (id.includes(AMETHYST_BRONZE)) return true;

    const plainName = stripMcCodes(stack.nameTag || "").toLowerCase();
    if (plainName.includes("soulbound")) return true;

    try {
        const lore = stack.getLore?.() ?? [];
        for (const line of lore) {
            if (stripMcCodes(line).toLowerCase().includes("soulbound")) return true;
        }
    } catch (e) {}

    return false;
}

function loreMentionsCurse(stack, phrases) {
    try {
        const lore = stack.getLore?.() ?? [];
        for (const line of lore) {
            const plain = stripMcCodes(line).toLowerCase();
            for (const phrase of phrases) {
                if (plain.includes(phrase)) return true;
            }
        }
    } catch (e) {}
    return false;
}

function enchantIdIncludes(stack, tokens) {
    if (!stack || !tokens?.length) return false;

    try {
        const ench = stack.getComponent("minecraft:enchantable");
        const list = ench?.getEnchantments?.() ?? [];

        for (const entry of list) {
            const id = String(entry?.type?.id ?? entry?.type ?? "").toLowerCase();
            for (const token of tokens) {
                if (id.includes(String(token).toLowerCase())) return true;
            }
        }
    } catch (e) {}

    return false;
}

export function hasBindingCurse(stack) {
    return (
        enchantIdIncludes(stack, BINDING_CURSE_TOKENS) ||
        loreMentionsCurse(stack, ["curse of binding", "binding curse"])
    );
}

export function hasVanishingCurse(stack) {
    return (
        enchantIdIncludes(stack, VANISHING_CURSE_TOKENS) ||
        loreMentionsCurse(stack, ["curse of vanishing", "vanishing curse"])
    );
}

function shouldKeepThroughDeath(stack) {
    if (!stack || isRainGuiItem(stack)) return false;
    return isSoulboundItem(stack) || hasBindingCurse(stack);
}

function playerKeepsInventoryOnDeath(player) {
    try {
        return player?.hasTag(GRAVE_KEEP_INV_TAG);
    } catch (e) {
        return false;
    }
}

const SOULBOUND_RESTORE_KEY = "rain_soulbound_restore_pending";

/** @type {Map<string, { inventory: (import("@minecraft/server").ItemStack|undefined)[], equipment: Record<string, import("@minecraft/server").ItemStack|undefined> }>} */
const soulboundStashById = new Map();

const EQUIP_SLOTS = [
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Offhand,
    EquipmentSlot.Mainhand,
];

function shouldSkipDeathInventoryHandling(player) {
    if (!player) return true;
    try {
        return player.hasTag("in_arena") || player.hasTag("in_spleef");
    } catch (e) {
        return false;
    }
}

function cloneItem(item) {
    if (!item) return undefined;
    try {
        return item.clone ? item.clone() : item;
    } catch (e) {
        return undefined;
    }
}

function stashStack(stash, inv, eq, slotKind, slot, stack) {
    if (slotKind === "inv") {
        stash.inventory[slot] = cloneItem(stack);
        inv.setItem(slot, undefined);
    } else {
        stash.equipment[slot] = cloneItem(stack);
        eq.setEquipment(slot, undefined);
    }
}

/** Apply curse rules and stash soulbound/binding items before death drops. */
export function prepareInventoryForGravestone(player) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    const eq = player.getComponent("minecraft:equippable");
    if (!inv && !eq) return false;

    const keepAll = playerKeepsInventoryOnDeath(player);
    const existing = soulboundStashById.get(player.id) ?? { inventory: [], equipment: {} };
    const stash = {
        inventory: existing.inventory ?? [],
        equipment: existing.equipment ?? {},
    };
    let changed = false;

    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            const stack = inv.getItem(i);
            if (!stack || isRainGuiItem(stack)) continue;

            if (hasVanishingCurse(stack)) {
                try {
                    inv.setItem(i, undefined);
                    changed = true;
                } catch (e) {}
                continue;
            }

            if (keepAll || shouldKeepThroughDeath(stack)) {
                try {
                    stashStack(stash, inv, eq, "inv", i, stack);
                    changed = true;
                } catch (e) {}
            }
        }
    }

    if (eq) {
        for (const slot of EQUIP_SLOTS) {
            const stack = eq.getEquipment(slot);
            if (!stack || isRainGuiItem(stack)) continue;

            if (hasVanishingCurse(stack)) {
                try {
                    eq.setEquipment(slot, undefined);
                    changed = true;
                } catch (e) {}
                continue;
            }

            if (keepAll || shouldKeepThroughDeath(stack)) {
                try {
                    stashStack(stash, inv, eq, "equip", slot, stack);
                    changed = true;
                } catch (e) {}
            }
        }
    }

    if (!changed) return false;

    soulboundStashById.set(player.id, stash);
    try {
        player.setDynamicProperty(SOULBOUND_RESTORE_KEY, true);
    } catch (e) {}

    return true;
}

/** @deprecated Use prepareInventoryForGravestone */
export function stripSoulboundForGravestone(player) {
    return prepareInventoryForGravestone(player);
}

function findEmptySlot(container, prefer = -1) {
    if (!container) return -1;
    if (prefer >= 0 && !container.getItem(prefer)) return prefer;
    for (let i = 0; i < container.size; i++) {
        if (!container.getItem(i)) return i;
    }
    return -1;
}

function forceGiveStack(player, stack) {
    if (!player?.isValid || !stack) return false;

    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;

    const slot = findEmptySlot(inv);
    if (slot < 0) return false;

    try {
        inv.setItem(slot, stack);
        return true;
    } catch (e) {
        return false;
    }
}

export function restoreSoulboundAfterRespawn(player) {
    const stash = soulboundStashById.get(player.id);
    const pending = player.getDynamicProperty(SOULBOUND_RESTORE_KEY);

    if (!stash && !pending) return false;

    try {
        player.setDynamicProperty(SOULBOUND_RESTORE_KEY, undefined);
    } catch (e) {}

    if (!stash) {
        soulboundStashById.delete(player.id);
        return false;
    }

    const inv = player.getComponent("minecraft:inventory")?.container;
    const eq = player.getComponent("minecraft:equippable");

    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            const stack = stash.inventory[i];
            if (!stack) continue;
            if (inv.getItem(i)) {
                forceGiveStack(player, stack);
            } else {
                try {
                    inv.setItem(i, stack);
                } catch (e) {
                    forceGiveStack(player, stack);
                }
            }
        }
    }

    if (eq) {
        for (const slot of EQUIP_SLOTS) {
            const stack = stash.equipment[slot];
            if (!stack) continue;
            if (eq.getEquipment(slot)) {
                forceGiveStack(player, stack);
            } else {
                try {
                    eq.setEquipment(slot, stack);
                } catch (e) {
                    forceGiveStack(player, stack);
                }
            }
        }
    }

    soulboundStashById.delete(player.id);
    return true;
}

function handlePlayerDeathBefore(player) {
    if (!player || player.typeId !== "minecraft:player") return;
    if (shouldSkipDeathInventoryHandling(player)) return;

    prepareInventoryForGravestone(player);
}

if (world.beforeEvents?.playerDie) {
    world.beforeEvents.playerDie.subscribe((ev) => {
        handlePlayerDeathBefore(ev.player);
    });
} else if (world.beforeEvents?.entityDie) {
    world.beforeEvents.entityDie.subscribe((ev) => {
        if (ev.deadEntity?.typeId === "minecraft:player") {
            handlePlayerDeathBefore(ev.deadEntity);
        }
    });
}

if (world.afterEvents?.playerSpawn) {
    world.afterEvents.playerSpawn.subscribe((ev) => {
        const player = ev.player;
        if (!player || ev.initialSpawn) return;

        system.runTimeout(() => {
            if (!player.isValid) return;
            restoreSoulboundAfterRespawn(player);
        }, 5);
    });
}
