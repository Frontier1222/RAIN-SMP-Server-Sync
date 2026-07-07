import { world, system, EquipmentSlot } from "@minecraft/server";
import { isInCombat } from "../utils/teleport.js";
import { notify, toastDeny } from "../utils/realmPerf.js";

export const MURASAME_ID = "viberater:epic_wither_sword";
const HARMING_EFFECTS = new Set([
    "minecraft:instant_damage",
    "instant_damage",
    "harm",
    "minecraft:harm",
    "damage",
    "minecraft:damage",
]);

function isCombatRestrictedItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    if (id.includes("potion")) return true;
    if (id.includes("arrow")) return true;
    if (id.includes("bow") || id.includes("crossbow")) return true;
    return false;
}

export function isStaffAdmin(player) {
    if (!player) return false;
    return (
        player.hasTag("staff") ||
        player.hasTag("rank:admin") ||
        player.hasTag("rank:owner") ||
        player.hasTag("rank:coowner")
    );
}

function denyCombatHarming(player, label) {
    toastDeny(player, `§c${label} are disabled during combat.`, "combat_no_harm");
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

function isProjectileDamage(damageSource) {
    const cause = String(damageSource?.cause ?? "").toLowerCase();
    return cause.includes("projectile") || cause.includes("arrow");
}

export function stripMurasameFromPlayer(player) {
    if (!player?.isValid || isStaffAdmin(player)) return false;

    let removed = false;
    try {
        const inv = player.getComponent("minecraft:inventory")?.container;
        if (inv) {
            for (let i = 0; i < inv.size; i++) {
                const stack = inv.getItem(i);
                if (stack?.typeId === MURASAME_ID) {
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
                if (stack?.typeId === MURASAME_ID) {
                    eq.setEquipment(slot, undefined);
                    removed = true;
                }
            }
        }
    } catch (e) {}

    if (removed) {
        notify(player, "murasame_inv_block", "§c§l[MURASAME]§r", "§cOnly admins may hold Murasame.", "", "note.bass");
    }

    return removed;
}

function blockCombatItemUse(event) {
    const player = event.source ?? event.player;
    const item = event.itemStack;
    if (!player || player.typeId !== "minecraft:player" || !item) return;
    if (!isInCombat(player)) return;
    if (!isCombatRestrictedItem(item.typeId)) return;

    event.cancel = true;
    denyCombatHarming(player, "Potions and arrows");
}

function registerCombatRules() {
    if (world.beforeEvents?.effectAdd) {
        world.beforeEvents.effectAdd.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== "minecraft:player") return;
            if (!isInCombat(entity)) return;

            const typeId = String(event.effect?.typeId || event.effectType || "").toLowerCase();
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

    if (world.beforeEvents?.projectileHitEntity) {
        world.beforeEvents.projectileHitEntity.subscribe((event) => {
            const shooter = event.source;
            if (!shooter || shooter.typeId !== "minecraft:player" || !isInCombat(shooter)) return;

            event.cancel = true;
            denyCombatHarming(shooter, "Potions and arrows");
        });
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

                const combatTagged = isInCombat(victim) || isInCombat(attacker);
                if (combatTagged && (isCombatRestrictedItem(weapon) || isProjectileDamage(event.damageSource))) {
                    event.cancel = true;
                    denyCombatHarming(attacker, "Potions and arrows");
                    return;
                }
            }

            if (victim?.typeId !== "minecraft:player" || !isInCombat(victim)) return;

            const shooter = getPlayerDamageSource(event.damageSource);
            if (shooter?.typeId === "minecraft:player" && isInCombat(shooter)) {
                if (isProjectileDamage(event.damageSource) || isCombatRestrictedItem(getAttackerWeapon(shooter))) {
                    event.cancel = true;
                    denyCombatHarming(shooter, "Potions and arrows");
                }
            }
        });
    }

    if (world.beforeEvents?.playerInteractWithEntity) {
        world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
            const player = event.player;
            const item = event.itemStack;
            if (!player || !item || item.typeId !== MURASAME_ID) return;
            if (isStaffAdmin(player)) return;

            if (event.target?.typeId === "minecraft:player") {
                event.cancel = true;
                notify(player, "murasame_trade_block", "§c§l[MURASAME]§r", "§cThis weapon cannot be given or traded.", "", "note.bass");
            }
        });
    }

    if (world.beforeEvents?.playerDropItem) {
        world.beforeEvents.playerDropItem.subscribe((event) => {
            const player = event.source;
            const item = event.itemStack;
            if (!player || !item || item.typeId !== MURASAME_ID) return;
            if (isStaffAdmin(player)) return;
            event.cancel = true;
            notify(player, "murasame_drop_block", "§c§l[MURASAME]§r", "§cYou cannot drop Murasame.", "", "note.bass");
        });
    }

    if (world.afterEvents?.playerInventoryItemChange) {
        world.afterEvents.playerInventoryItemChange.subscribe((event) => {
            const player = event.player;
            const item = event.itemStack ?? event.newItemStack;
            if (!player || item?.typeId !== MURASAME_ID) return;
            if (isStaffAdmin(player)) return;
            system.run(() => stripMurasameFromPlayer(player));
        });
    }

    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            system.run(() => stripMurasameFromPlayer(event.player));
        });
    }

    if (world.afterEvents?.entitySpawn) {
        world.afterEvents.entitySpawn.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== "minecraft:item") return;
            const stack = entity.getComponent("minecraft:item")?.itemStack;
            if (stack?.typeId !== MURASAME_ID) return;

            system.run(() => {
                try {
                    const nearby = entity.dimension.getPlayers({ location: entity.location, maxDistance: 4 });
                    for (const player of nearby) {
                        if (!isStaffAdmin(player)) {
                            entity.remove();
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
