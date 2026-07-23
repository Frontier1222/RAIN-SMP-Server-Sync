import { world, EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import { isEntityPlayer } from './utils.js';
import { slimeToolEntityHit, manyullynEntityKill, arditeToolEntityHit, hepatizonEntityHit, cobaltEntityHit, experiencedEntityKill, boneToolEntityHit } from './tool_effects.js';

function isValidEntity(entity) {
    try {
        return entity?.isValid === true;
    } catch {
        return false;
    }
}

world.afterEvents.projectileHitEntity.subscribe((event) => {
    try {
        const projectile = event.projectile;
        const player = event.source;
        if (!isValidEntity(projectile) || !isValidEntity(player) || !isEntityPlayer(player)) return;
        if (projectile.typeId !== "minecraft:arrow") return;

        const propertyKey = "ftb_tc:" + projectile.id;
        const bowType = world.getDynamicProperty(propertyKey);
        world.setDynamicProperty(propertyKey, undefined);
        const hitEntity = event.getEntityHit()?.entity;
        if (!isValidEntity(hitEntity)) return;

        const health = hitEntity.getComponent(EntityComponentTypes.Health);
        if (!health) return;

        const isDead = health.currentValue <= 0;
        switch (bowType) {
        case "ftb_tc:bow_stone":
            if (!isDead) {
                return;
            }
            const fivePrecentChance = Math.random() <= 0.05;
            if (!fivePrecentChance) {
                return;
            }
            const isSilverFish = Math.random() <= 0.5;
            const entityType = isSilverFish
                ? "minecraft:silverfish"
                : "minecraft:endermite";
            hitEntity.dimension.spawnEntity(entityType, hitEntity.location);
            break;
        case "ftb_tc:bow_bone":
            boneToolEntityHit(player, hitEntity, "ftb_tc:bow_bone");
            break;
        case "ftb_tc:bow_rose_gold":
            if (!isDead) {
                return;
            }
            experiencedEntityKill(hitEntity, player, "ftb_tc:bow_rose_gold");
            break;
        case "ftb_tc:bow_cobalt":
            if (!isDead) {
                return;
            }
            cobaltEntityHit(player, hitEntity, "ftb_tc:bow_cobalt");
            break;
        case "ftb_tc:bow_hepatizon":
            hepatizonEntityHit(hitEntity, "ftb_tc:bow_hepatizon");
            break;
        case "ftb_tc:bow_ardite":
            arditeToolEntityHit(hitEntity, "ftb_tc:bow_ardite");
            break;
        case "ftb_tc:bow_manyullyn":
            if (!isDead) {
                return;
            }
            manyullynEntityKill(hitEntity, player, "ftb_tc:bow_manyullyn");
            break;
        case "ftb_tc:bow_slimesteel":
            slimeToolEntityHit(hitEntity, "ftb_tc:bow_slimesteel");
            break;
        }
    } catch (error) {
        console.warn(`[Tinkers bows] Projectile hit processing failed: ${error}`);
    }
});
// Store the bow type that shoe the arrow, on the world dynamic properties. Can't use entity as it was error
world.afterEvents.entitySpawn.subscribe((event) => {
    try {
        const arrow = event.entity;
        if (!isValidEntity(arrow) || arrow.typeId !== "minecraft:arrow") return;

        const component = arrow.getComponent(EntityComponentTypes.Projectile);
        const shooter = component?.owner;
        if (!isValidEntity(shooter) || !isEntityPlayer(shooter)) return;

        const equipment = shooter.getComponent(EntityComponentTypes.Equippable);
        const mainHand = equipment?.getEquipment(EquipmentSlot.Mainhand);
        if (mainHand?.hasTag("ftb_tc:bow")) {
            world.setDynamicProperty("ftb_tc:" + arrow.id, mainHand.typeId);
        }
    } catch (error) {
        console.warn(`[Tinkers bows] Arrow spawn processing failed: ${error}`);
    }
});
