import { world, EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import { isEntityPlayer } from './utils.js';
import { slimeToolEntityHit, manyullynEntityKill, arditeToolEntityHit, hepatizonEntityHit, cobaltEntityHit, experiencedEntityKill, boneToolEntityHit } from './tool_effects.js';

world.afterEvents.projectileHitEntity.subscribe((event) => {
    if (!isEntityPlayer(event.source)) {
        return;
    }
    if (event.projectile.typeId !== "minecraft:arrow") {
        return;
    }
    const bowType = world.getDynamicProperty("ftb_tc:" + event.projectile.id);
    const hitEntity = event.getEntityHit().entity;
    const player = event.source;
    const health = hitEntity.getComponent(EntityComponentTypes.Health);
    if (!health) {
        return;
    }
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
});
// Store the bow type that shoe the arrow, on the world dynamic properties. Can't use entity as it was error
world.afterEvents.entitySpawn.subscribe((event) => {
    if (event.entity.typeId !== "minecraft:arrow") {
        return;
    }
    const component = event.entity.getComponent(EntityComponentTypes.Projectile);
    if (!component) {
        return;
    }
    const shooter = component.owner;
    const equipment = shooter.getComponent(EntityComponentTypes.Equippable);
    if (!equipment) {
        return;
    }
    const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!mainHand) {
        return;
    }
    if (mainHand.hasTag("ftb_tc:bow")) {
        world.setDynamicProperty("ftb_tc:" + event.entity.id, mainHand.typeId);
    }
});
