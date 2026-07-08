import { world, system, EquipmentSlot, ItemComponentTypes } from "@minecraft/server";
import { isStaffPlayer } from "../systems/ranks.js";
import { canUseBountyMurasame, isBountyKitItem } from "./bounty.js";
import { notify, toastDeny } from "../utils/realmPerf.js";

export const MURASAME_ID = "viberater:epic_wither_sword";
const HARMING_EFFECTS = new Set([
    "minecraft:instant_damage",
    "instant_damage",
    "harm",
    "minecraft:harm",
    "damage",
    "minecraft:damage",
    "minecraft:harming",
    "minecraft:strong_harming",
    "harming",
    "strong_harming",
]);
const BANNED_HARMING_SWEEP_TICKS = 1;
const MURASAME_GUARD_SWEEP_TICKS = 20;
const BANNED_HARMING_CLEAR_COMMANDS = [
    "clear @s arrow 24 999",
    "clear @s arrow 25 999",
    "clear @s minecraft:arrow 24 999",
    "clear @s minecraft:arrow 25 999",
    "clear @s splash_potion 23 999",
    "clear @s splash_potion 24 999",
    "clear @s minecraft:splash_potion 23 999",
    "clear @s minecraft:splash_potion 24 999",
    "clear @s lingering_potion 23 999",
    "clear @s lingering_potion 24 999",
    "clear @s minecraft:lingering_potion 23 999",
    "clear @s minecraft:lingering_potion 24 999",
];
let bannedHarmingSweepStarted = false;
let murasameGuardSweepStarted = false;

function getPotionEffectTypeId(item) {
    if (!item) return "";
    try {
        const component = item.getComponent(ItemComponentTypes.Potion)
            ?? item.getComponent("minecraft:potion");
        return String(
            component?.potionEffectType?.id ??
            component?.potionEffectType?.typeId ??
            ""
        ).toLowerCase();
    } catch (e) {
        return "";
    }
}

function hasHarmingDisplayData(item) {
    if (!item) return false;

    const parts = [];
    try {
        parts.push(item.nameTag);
    } catch (e) {}
    try {
        parts.push(...(item.getLore?.() ?? []));
    } catch (e) {}
    try {
        parts.push(...(item.getRawLore?.() ?? []));
    } catch (e) {}

    const text = parts
        .filter((part) => part != null)
        .map(String)
        .join(" ")
        .toLowerCase();

    return text.includes("harming") || text.includes("instant damage");
}

function isHarmingPotionOrArrow(item) {
    if (!item) return false;
    const id = String(item.typeId || "").toLowerCase();
    if (!id.includes("potion") && !id.includes("arrow")) return false;
    return isHarmingEffectType(getPotionEffectTypeId(item)) || hasHarmingDisplayData(item);
}

function isBannedHarmingItem(item) {
    if (!isHarmingPotionOrArrow(item)) return false;
    const id = String(item?.typeId || "").toLowerCase();
    return (
        id.includes("arrow") ||
        id.includes("splash_potion") ||
        id.includes("lingering_potion")
    );
}

function stripBannedHarmingItems(player, notifyPlayer = true) {
    if (!player?.isValid) return false;
    let removed = false;

    try {
        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (inventory) {
            for (let slot = 0; slot < inventory.size; slot++) {
                const stack = inventory.getItem(slot);
                if (!isBannedHarmingItem(stack)) continue;
                inventory.setItem(slot, undefined);
                removed = true;
            }
        }

        const equippable = player.getComponent("minecraft:equippable");
        const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
        if (isBannedHarmingItem(offhand)) {
            equippable.setEquipment(EquipmentSlot.Offhand, undefined);
            removed = true;
        }
    } catch (e) {}

    // Bedrock tipped arrows/potions can arrive as legacy data values that the
    // ItemStack API does not expose reliably. Command clear catches those.
    try {
        for (const command of BANNED_HARMING_CLEAR_COMMANDS) {
            try {
                const result = player.runCommand(command);
                if ((result?.successCount ?? 0) > 0) removed = true;
            } catch (e) {}
        }
    } catch (e) {}

    if (removed && notifyPlayer) {
        toastDeny(
            player,
            "§cHarming arrows and throwable Harming potions are banned.",
            "banned_harming_item"
        );
    }
    return removed;
}

function getPreferredArrowAmmo(player) {
    try {
        const offhand = player
            .getComponent("minecraft:equippable")
            ?.getEquipment(EquipmentSlot.Offhand);
        if (String(offhand?.typeId || "").toLowerCase().includes("arrow")) {
            return offhand;
        }

        const inventory = player.getComponent("minecraft:inventory")?.container;
        if (!inventory) return undefined;
        for (let slot = 0; slot < inventory.size; slot++) {
            const stack = inventory.getItem(slot);
            if (String(stack?.typeId || "").toLowerCase().includes("arrow")) {
                return stack;
            }
        }
    } catch (e) {}
    return undefined;
}

export function isStaffAdmin(player) {
    return isStaffPlayer(player);
}

function interruptDeniedItemUse(player) {
    system.run(() => {
        if (!player?.isValid) return;
        const selected = player.selectedSlotIndex;
        const interruptSlot = selected === 8 ? 7 : selected + 1;
        try {
            player.selectedSlotIndex = interruptSlot;
            system.run(() => {
                if (player?.isValid && player.selectedSlotIndex === interruptSlot) {
                    player.selectedSlotIndex = selected;
                }
            });
        } catch (e) {}
    });
}

function isBlockingWithShield(player) {
    if (!player || player.typeId !== "minecraft:player") return false;
    try {
        if (typeof player.isSneaking === "function" && !player.isSneaking()) return false;
    } catch (e) {
        return false;
    }

    try {
        const eq = player.getComponent("minecraft:equippable");
        const off = eq?.getEquipment(EquipmentSlot.Offhand);
        const main = eq?.getEquipment(EquipmentSlot.Mainhand);
        const offId = String(off?.typeId || "").toLowerCase();
        const mainId = String(main?.typeId || "").toLowerCase();
        return offId.includes("shield") || mainId.includes("shield");
    } catch (e) {
        return false;
    }
}

function getAttackerWeapon(attacker) {
    if (!attacker || attacker.typeId !== "minecraft:player") return "";
    try {
        return attacker.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand)?.typeId || "";
    } catch (e) {
        return "";
    }
}

export function getPlayerDamageSource(damageSource) {
    if (!damageSource) return null;

    const direct = damageSource.damagingEntity;
    if (direct?.typeId === "minecraft:player") return direct;

    const projectile = damageSource.damagingProjectile;
    if (projectile) {
        try {
            const owner = projectile.owner ?? projectile.getComponent?.("minecraft:projectile")?.owner;
            if (owner?.typeId === "minecraft:player") return owner;
        } catch (e) {}
    }

    if (direct) {
        const typeId = String(direct.typeId || "").toLowerCase();
        if (typeId.includes("arrow") || typeId.includes("thrown") || typeId.includes("potion")) {
            try {
                const owner = direct.getComponent?.("minecraft:projectile")?.owner;
                if (owner?.typeId === "minecraft:player") return owner;
            } catch (e) {}
        }
    }

    return null;
}

function isHarmingEffectType(typeId) {
    const id = String(typeId || "").toLowerCase();
    if (HARMING_EFFECTS.has(id)) return true;
    return id.includes("instant_damage") || id.includes("harm");
}

export function stripMurasameFromPlayer(player) {
    if (!player?.isValid || isStaffAdmin(player)) return false;

    let removed = false;
    try {
        const inv = getInventoryContainer(player);
        if (inv) {
            for (let i = 0; i < inv.size; i++) {
                const stack = inv.getItem(i);
                if (stack?.typeId === MURASAME_ID && !canUseBountyMurasame(player, stack)) {
                    inv.setItem(i, undefined);
                    removed = true;
                }
            }
        }

        const eq = player.getComponent("minecraft:equippable");
        if (eq) {
            for (const slot of [
                EquipmentSlot.Mainhand,
                EquipmentSlot.Offhand,
                EquipmentSlot.Head,
                EquipmentSlot.Chest,
                EquipmentSlot.Legs,
                EquipmentSlot.Feet,
            ]) {
                const stack = eq.getEquipment(slot);
                if (stack?.typeId === MURASAME_ID && !canUseBountyMurasame(player, stack)) {
                    eq.setEquipment(slot, undefined);
                    removed = true;
                }
            }
        }
    } catch (e) {}

    if (removed) {
        removeMurasameEffects(player);
        notify(player, "murasame_inv_block", "§c§l[MURASAME]§r", "§cOnly admins may hold Murasame.", "", "note.bass");
    }

    return removed;
}

function getInventoryContainer(holder) {
    try {
        return holder?.getComponent("minecraft:inventory")?.container
            ?? holder?.getComponent("inventory")?.container;
    } catch (e) {
        return undefined;
    }
}

function getItemEntityStack(entity) {
    try {
        return entity?.getComponent("minecraft:item")?.itemStack
            ?? entity?.getComponent("item")?.itemStack;
    } catch (e) {
        return undefined;
    }
}

function containerHasMurasame(container) {
    if (!container) return false;

    try {
        for (let i = 0; i < container.size; i++) {
            const stack = container.getItem(i);
            if (stack?.typeId === MURASAME_ID || isBountyKitItem(stack)) return true;
        }
    } catch (e) {}

    return false;
}

function blockHasMurasame(block) {
    try {
        return containerHasMurasame(getInventoryContainer(block));
    } catch (e) {
        return false;
    }
}

function entityHasMurasame(entity) {
    if (!entity?.isValid) return false;

    if (entity.typeId === "minecraft:item") {
        const stack = getItemEntityStack(entity);
        return stack?.typeId === MURASAME_ID || isBountyKitItem(stack);
    }

    if (containerHasMurasame(getInventoryContainer(entity))) return true;

    try {
        const eq = entity.getComponent("minecraft:equippable") ?? entity.getComponent("equippable");
        if (!eq) return false;
        for (const slot of [
            EquipmentSlot.Mainhand,
            EquipmentSlot.Offhand,
            EquipmentSlot.Head,
            EquipmentSlot.Chest,
            EquipmentSlot.Legs,
            EquipmentSlot.Feet,
        ]) {
            const stack = eq.getEquipment(slot);
            if (stack?.typeId === MURASAME_ID || isBountyKitItem(stack)) return true;
        }
    } catch (e) {}

    return false;
}

function removeMurasameEffects(player) {
    for (const effect of ["speed", "strength", "invisibility", "fire_resistance", "regeneration"]) {
        try {
            player.removeEffect(effect);
        } catch (e) {}
    }
}

function denyMurasameTransfer(player, key = "murasame_transfer_block") {
    if (!player?.isValid) return;
    notify(player, key, "§c§l[MURASAME]§r", "§cOnly admins may receive or move Murasame.", "", "note.bass");
}

function blockCombatItemUse(event) {
    const player = event.source ?? event.player;
    const item = event.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !item) return;

    const hadBannedHarmingItem = stripBannedHarmingItems(player);

    const itemId = String(item.typeId || "").toLowerCase();
    const isBowUse = itemId.includes("bow") || itemId.includes("crossbow");
    const isHarmingArrowUse =
        (itemId.includes("arrow") && isHarmingPotionOrArrow(item)) ||
        (isBowUse && isHarmingPotionOrArrow(getPreferredArrowAmmo(player)));

    if (isHarmingArrowUse) {
        event.cancel = true;
        interruptDeniedItemUse(player);
        system.run(() => stripBannedHarmingItems(player));
        toastDeny(
            player,
            "§cHarming arrows are disabled and cannot be fired.",
            "combat_no_harming_arrow"
        );
        return;
    }

    if (!isHarmingPotionOrArrow(item)) {
        if (hadBannedHarmingItem && isBowUse) {
            event.cancel = true;
            interruptDeniedItemUse(player);
        }
        return;
    }

    event.cancel = true;
    interruptDeniedItemUse(player);
    system.run(() => stripBannedHarmingItems(player));
    toastDeny(
        player,
        "§cHarming splash and lingering potions are disabled.",
        "combat_no_harming_potion"
    );
}

function registerCombatRules() {
    if (!bannedHarmingSweepStarted) {
        bannedHarmingSweepStarted = true;
        system.runInterval(() => {
            for (const player of world.getPlayers()) {
                stripBannedHarmingItems(player, false);
            }
        }, BANNED_HARMING_SWEEP_TICKS);
    }

    if (!murasameGuardSweepStarted) {
        murasameGuardSweepStarted = true;
        system.runInterval(() => {
            for (const player of world.getPlayers()) {
                stripMurasameFromPlayer(player);
            }
        }, MURASAME_GUARD_SWEEP_TICKS);
    }

    if (world.beforeEvents?.effectAdd) {
        world.beforeEvents.effectAdd.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== "minecraft:player") return;

            const typeId = String(
                event.effect?.typeId ??
                event.effect?.type?.id ??
                event.effectType?.id ??
                event.effectType?.typeId ??
                event.effectType ??
                ""
            ).toLowerCase();
            if (!isHarmingEffectType(typeId)) return;

            event.cancel = true;
            system.run(() => {
                try {
                    entity.removeEffect(typeId);
                } catch (e) {}
            });
        });
    }

    for (const hook of ["itemUse", "itemCompleteUse", "itemReleaseUse", "itemStartUse"]) {
        if (world.beforeEvents?.[hook]) {
            world.beforeEvents[hook].subscribe(blockCombatItemUse);
        }
    }

    if (world.beforeEvents?.entityHurt) {
        world.beforeEvents.entityHurt.subscribe((event) => {
            const victim = event.hurtEntity;
            const attacker = getPlayerDamageSource(event.damageSource)
                ?? (event.damageSource?.damagingEntity?.typeId === "minecraft:player"
                    ? event.damageSource.damagingEntity
                    : null);

            if (victim?.typeId === "minecraft:player" && attacker?.typeId === "minecraft:player") {
                const weapon = getAttackerWeapon(attacker);
                if (weapon === "minecraft:mace" && isBlockingWithShield(victim)) {
                    event.cancel = true;
                    return;
                }

            }
        });
    }

    if (world.beforeEvents?.playerInteractWithEntity) {
        world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
            const player = event.player;
            const item = event.itemStack;
            if (!player) return;
            if (isStaffAdmin(player)) return;

            if ((item?.typeId === MURASAME_ID && !canUseBountyMurasame(player, item)) || isBountyKitItem(item)) {
                event.cancel = true;
                system.run(() => stripMurasameFromPlayer(player));
                notify(player, "murasame_trade_block", "§c§l[MURASAME]§r", "§cThis weapon cannot be given or traded.", "", "note.bass");
                return;
            }

            if (entityHasMurasame(event.target)) {
                event.cancel = true;
                denyMurasameTransfer(player, "murasame_entity_block");
            }
        });
    }

    if (world.beforeEvents?.playerInteractWithBlock) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
            const player = event.player;
            if (!player || isStaffAdmin(player)) return;

            const item = event.itemStack;
            if ((item?.typeId === MURASAME_ID && !canUseBountyMurasame(player, item)) || isBountyKitItem(item)) {
                event.cancel = true;
                system.run(() => stripMurasameFromPlayer(player));
                denyMurasameTransfer(player);
                return;
            }

            if (blockHasMurasame(event.block)) {
                event.cancel = true;
                denyMurasameTransfer(player, "murasame_container_block");
            }
        });
    }

    if (world.beforeEvents?.playerDropItem) {
        world.beforeEvents.playerDropItem.subscribe((event) => {
            const player = event.source;
            const item = event.itemStack;
            if (!player || !item || (item.typeId !== MURASAME_ID && !isBountyKitItem(item))) return;
            if (isStaffAdmin(player)) return;
            event.cancel = true;
            notify(player, "murasame_drop_block", "§c§l[MURASAME]§r", "§cYou cannot drop Murasame.", "", "note.bass");
        });
    }

    if (world.afterEvents?.playerInventoryItemChange) {
        world.afterEvents.playerInventoryItemChange.subscribe((event) => {
            const player = event.player;
            const item = event.itemStack ?? event.newItemStack;
            if (isBannedHarmingItem(item)) {
                system.run(() => stripBannedHarmingItems(player));
                return;
            }
            if (!player || (item?.typeId !== MURASAME_ID && !isBountyKitItem(item))) return;
            if (isStaffAdmin(player)) return;
            if (canUseBountyMurasame(player, item)) return;
            system.run(() => stripMurasameFromPlayer(player));
        });
    }

    if (world.beforeEvents?.entityItemPickup) {
        world.beforeEvents.entityItemPickup.subscribe((event) => {
            const player = event.entity;
            if (!player || player.typeId !== "minecraft:player") return;
            if (isStaffAdmin(player)) return;

            const stack = event.itemStack ?? getItemEntityStack(event.itemEntity);
            if (stack?.typeId !== MURASAME_ID && !isBountyKitItem(stack)) return;

            event.cancel = true;
            denyMurasameTransfer(player, "murasame_pickup_block");
            try {
                if (event.itemEntity?.isValid) event.itemEntity.remove();
            } catch (e) {}
            system.run(() => stripMurasameFromPlayer(player));
        });
    }

    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            system.run(() => {
                stripBannedHarmingItems(event.player, false);
                stripMurasameFromPlayer(event.player);
            });
        });
    }

    if (world.afterEvents?.entitySpawn) {
        world.afterEvents.entitySpawn.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== "minecraft:item") return;
            if (!entity.isValid) return;
            let stack;
            try {
                stack = getItemEntityStack(entity);
            } catch (e) {
                return;
            }
            if (stack?.typeId !== MURASAME_ID && !isBountyKitItem(stack)) return;

            system.run(() => {
                try {
                    if (!entity?.isValid) return;
                    const nearby = entity.dimension.getPlayers({ location: entity.location, maxDistance: 4 });
                    for (const player of nearby) {
                        if (!isStaffAdmin(player)) {
                            if (entity.isValid) entity.remove();
                            return;
                        }
                    }
                } catch (e) {}
            });
        });
    }
}

export function initCombatRules() {
    registerCombatRules();
}
