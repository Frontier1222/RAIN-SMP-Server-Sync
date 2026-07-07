import { world, EntityComponentTypes, ItemStack } from '@minecraft/server';
import { isEntityPlayer } from './utils.js';
import { isTinkersTool, updateDurability } from './durability.js';
import { cleaverExtraDrops, boneEntityConversions, tannedExtraDrops } from './data.js';
import { Mth as X, dropItemWithChance as Ft } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

world.afterEvents.entityHitEntity.subscribe((event) => {
    const { damagingEntity, hitEntity } = event;
    if (damagingEntity.typeId !== "minecraft:player") {
        return;
    }
    if (!hitEntity || !hitEntity.isValid) {
        // No entity was hit
        return;
    }
    const hitHealth = hitEntity.getComponent(EntityComponentTypes.Health);
    if (!hitHealth) {
        // It doesn't have health, so it can't be damaged
        return;
    }
    const hitCurrent = hitHealth.currentValue;
    const mainHandlItem = getMainHandlItem(damagingEntity);
    if (!mainHandlItem) {
        return;
    }
    if (!isTinkersTool(mainHandlItem)) {
        return;
    }
    // They're dead
    if (hitCurrent === 0) {
        entityDead(hitEntity, damagingEntity, mainHandlItem);
        return;
    }
    // THIS MUST BE FIRST SO THE CORRECT ENTITY IS PASSED TO THE OTHER FUNCTIONS
    const newHitEntity = boneToolEntityHit(damagingEntity, hitEntity, mainHandlItem.typeId);
    arditeToolEntityHit(newHitEntity, mainHandlItem.typeId);
    slimeToolEntityHit(newHitEntity, mainHandlItem.typeId);
    pigIronEntityHit(damagingEntity, mainHandlItem.typeId);
    hepatizonEntityHit(newHitEntity, mainHandlItem.typeId);
    cobaltEntityHit(damagingEntity, newHitEntity, mainHandlItem.typeId);
});

function entityDead(entityThatDied, theKiller, mainHandlItem) {
    // Don't do effects on players
    if (isEntityPlayer(entityThatDied)) {
        return;
    }
    tannedEntityKill(entityThatDied, theKiller, mainHandlItem.typeId);
    experiencedEntityKill(entityThatDied, theKiller, mainHandlItem.typeId);
    cleaverEntityKill(entityThatDied, theKiller, mainHandlItem);
    boneEntityKill(entityThatDied, theKiller, mainHandlItem.typeId);
    pigIronEntityHit(theKiller, mainHandlItem.typeId);
    manyullynEntityKill(entityThatDied, theKiller, mainHandlItem.typeId);
}

function manyullynEntityKill(entity, player, typeId) {
    if (!typeId.includes("manyullyn")) {
        return;
    }

    const entityLocation = entity.location;
    const newEnt = player.dimension.spawnEntity(entity.typeId, {
        x: entityLocation.x,
        y: entityLocation.y + 50,
        z: entityLocation.z,
    });
    newEnt.addEffect("levitation", 100, {
        amplifier: 10,
        showParticles: false,
    });
    newEnt.addEffect("slow_falling", 100, {
        amplifier: 10,
        showParticles: false,
    });
    // Make it invisible
    newEnt.addEffect("invisibility", 100, {
        amplifier: 1,
        showParticles: false,
    });

    // Plunder: balanced 1-3 extra loot rolls; 50% chance for the minimum (less loot).
    let rolls = X.randomRanged(1, 3);
    if (Math.random() < 0.5) {
        rolls = 1;
    }

    for (let i = 0; i < rolls; i++) {
        player.runCommand(`loot spawn ${entityLocation.x} ${entityLocation.y + 1} ${entityLocation.z} kill @e[type=${entity.typeId.replace("minecraft:", "")},c=1]`);
    }
    newEnt.remove();
}

/**
 * Drops a bone loot table upon killing an entity with a bone tool
 */
function boneEntityKill(entityThatDied, player, typeId) {
    if (!typeId.includes("bone")) {
        return;
    }
    const entityLoc = entityThatDied.location;
    player.runCommand(`loot spawn ${entityLoc.x} ${entityLoc.y} ${entityLoc.z} loot "ftb/tinkers/bone"`);
}

/**
 *
 * @param {Entity} entity
 * @param {Player} player
 * @param {ItemStack} item
 */
function cleaverEntityKill(entity, player, item) {
    if (!item.typeId.startsWith("ftb_tc:cleaver_")) {
        return;
    }
    if (!cleaverExtraDrops[entity.typeId]) {
        return;
    }
    entity.runCommand(cleaverExtraDrops[entity.typeId]);
    entity.runCommand('scoreboard players add "ftb_tc:cleaver" "ftb_tc:jig_computer.addon_stats" 1');
}

/**
 * Drops extra experience upon killing an entity with an experienced tool
 */
function experiencedEntityKill(entity, player, typeId) {
    if (!typeId.includes("rose_gold")) {
        return;
    }
    const entiyLoc = entity.location;
    const amount = X.randomRanged(1, 6);
    for (let i = 0; i < amount; i++) {
        player.dimension.spawnEntity("minecraft:xp_orb", entiyLoc);
    }
}

/**
 * Adds extra drops to the entity upon being killed by a tanned tool
 */
function tannedEntityKill(entity, player, typeId) {
    if (!typeId.includes("leather")) {
        return;
    }
    lookupAndDropExtraDrops(tannedExtraDrops, entity, player);
}

/**
 * Helper function to lookup and drop extra drops from a lookup list
 *
 * @param {Record<string, {chance: number, item: string}>} lookupList
 * @param {*} entity
 * @param {*} player
 * @returns
 */
function lookupAndDropExtraDrops(lookupList, entity, player) {
    if (!lookupList[entity.typeId]) {
        return;
    }
    const extraDrop = lookupList[entity.typeId];
    const location = entity.location;
    Ft(player.dimension, new ItemStack(extraDrop.item, 1), extraDrop.chance, location);
}

/**
 * Attempts to convert the entity to a different entity upon being hit by a bone tool
 */
function boneToolEntityHit(player, entity, typeId) {
    // Players can't be converted
    if (isEntityPlayer(entity)) {
        return entity;
    }
    if (!typeId.includes("bone")) {
        return entity;
    }
    // There is no conversion for this entity
    if (!boneEntityConversions[entity.typeId]) {
        return entity;
    }
    // Check if the entity is a baby
    const isBaby = entity.hasComponent("minecraft:is_baby");
    if (isBaby) {
        return entity;
    }
    const location = entity.location;
    const newEntity = boneEntityConversions[entity.typeId];
    player.playSound("mob.zombie.remedy", {
        volume: 0.2,
        pitch: 1,
    });
    player.dimension.spawnParticle("ftb_tc:bone_tool_particle", location);
    entity.remove();
    player.runCommand('scoreboard players add "ftb_tc:bone_tool" "ftb_tc:jig_computer.addon_stats" 1');
    return player.dimension.spawnEntity(newEntity, location);
}

/**
 * Provides a chance to drop an emerald upon hitting a villager or pillager with a cobalt tool
 */
function cobaltEntityHit(player, entity, typeId) {
    // This effect isn't needed for players as a player will never match the entity type
    if (isEntityPlayer(entity)) {
        return;
    }
    if (!typeId.includes("cobalt")) {
        return;
    }
    if (entity.typeId !== "minecraft:villager" && entity.typeId !== "minecraft:villager_v2" && entity.typeId !== "minecraft:vindicator" && entity.typeId !== "minecraft:evocation_illager" && entity.typeId !== "minecraft:pillager" && entity.typeId !== "minecraft:wandering_trader") {
        return;
    }
    const location = entity.location;
    const wasDropped = Ft(entity.dimension, new ItemStack("minecraft:emerald", 1), 0.25, location);
    if (wasDropped) {
        player.runCommand(`effect @s village_hero 100 0 true`);
        player.playSound("use.chain", {
            volume: 2,
            pitch: 1,
        });
    }
}

/**
 * Sets the entity on fire upon being hit by an ardite tool
 */
function arditeToolEntityHit(entity, typeId) {
    if (!typeId.includes("ardite")) {
        return;
    }
    // Execute a command as the entity so we can use relative coordinates
    entity.runCommand(`summon ftb_tc:ardite_fireball ~ ~ ~`);
    entity.runCommand(`scoreboard players add "ftb_tc:ardite_tool" "ftb_tc:jig_computer.addon_stats" 1`);
}

/**
 * Slows the entity upon being hit by a slime tool
 *
 * @param {Entity} entity
 */
function slimeToolEntityHit(entity, typeId) {
    if (!typeId.includes("slimesteel")) {
        return;
    }
    const isSwordOrBow = typeId.includes("sword") || typeId.includes("bow");
    entity.addEffect("slowness", isSwordOrBow ? 60 : 100, {
        amplifier: isSwordOrBow ? 1 : 2,
        showParticles: true,
    });
    entity.addEffect("slow_falling", isSwordOrBow ? 60 : 100, {
        amplifier: isSwordOrBow ? 1 : 2,
        showParticles: true,
    });
    entity.runCommand('scoreboard players add "ftb_tc:slimesteel" "ftb_tc:jig_computer.addon_stats" 1');
}

/**
 * Applies saturation to the player upon hitting an entity with a pig iron tool
 */
function pigIronEntityHit(player, typeId) {
    if (!typeId.includes("pig_iron")) {
        return;
    }
    player.addEffect("saturation", 1, {
        amplifier: 0,
        showParticles: true, // TODO: Maybe true?
    });
}

function hepatizonEntityHit(entity, typeId) {
    if (!typeId.includes("hepatizon")) {
        return;
    }
    const isSwordOrBow = typeId.includes("sword") || typeId.includes("bow");
    entity.addEffect("levitation", isSwordOrBow ? 3 : 5, {
        amplifier: isSwordOrBow ? 10 : 30,
        showParticles: false,
    });
}

/**
 * @param {Player} player
 * @return {ItemStack}
 */
function getMainHandlItem(player) {
    const equipment = player.getComponent("minecraft:equippable");
    return equipment.getEquipment("Mainhand");
}

world.afterEvents.itemUse.subscribe((eventData) => {
    const { itemStack, source } = eventData;
    if (source.typeId !== "minecraft:player") {
        return;
    }
    if (itemStack.typeId.startsWith("ftb_tc:shoel")) {
        // Get the block that was targetted
        const block = source.getBlockFromViewDirection({
            maxDistance: 8
        });
        if (!block || block.block.isAir) {
            return;
        }
        // Is the block grass?
        if (block.block.permutation.matches("minecraft:grass") || block.block.permutation.matches("minecraft:dirt") || block.block.permutation.matches("minecraft:grass_path")) {
            const blockToUse = source.isSneaking ? "minecraft:farmland" : "minecraft:grass_path";
            // Make sure we're not replacing the same block
            if (block.block.permutation.matches(blockToUse)) {
                return;
            }
            // Replace the block with tilde
            const location = block.block.location;
            source.dimension.runCommand(`setblock ${location.x} ${location.y} ${location.z} ${blockToUse}`);
            // Play the sound
            source.playSound("use.grass", {
                location: location
            });
            updateDurability(itemStack, source);
        }
    }
    if (itemStack.typeId.startsWith("ftb_tc:hand_axe")) ;
});

export { arditeToolEntityHit, boneToolEntityHit, cobaltEntityHit, experiencedEntityKill, hepatizonEntityHit, manyullynEntityKill, slimeToolEntityHit };