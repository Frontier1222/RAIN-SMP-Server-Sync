import { world, ItemStack, EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import { extraXpDropBlocks, cropToDropTable, summonerEntitySpawns, smeltingConflictBlacklist, smeltingDropTables, unexpectedDropsConversion } from './data.js';
import { isTinkersTool } from './durability.js';
import { Mth as X } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const blockPerm = event.brokenBlockPermutation;
    const itemStack = event.itemStackAfterBreak;
    if (!itemStack || !isTinkersTool(itemStack)) {
        return;
    }
    // Check if the item is a smeltery trait
    attemptToSmelt(event.player, event.dimension, itemStack, {
        typeId: blockPerm.type.id,
        location: event.block.location,
        isAir: false
    }, itemStack.typeId);
    attemptToSpawnWithSummoner(event, blockPerm, itemStack.typeId);
    attemptToGiveMoreCrops(event, blockPerm, itemStack.typeId);
    attemptToGiveMoreXpForStuff(event, blockPerm, itemStack.typeId);
});
function attemptToGiveMoreXpForStuff(event, blockPerm, typeId) {
    if (!typeId.includes("rose_gold")) {
        return;
    }
    const firstFind = extraXpDropBlocks.find((key) => blockPerm.matches(key));
    if (!firstFind) {
        return;
    }
    const chance = Math.random();
    if (chance > 0.2) {
        return;
    }
    const location = event.block.location;
    const centeredLocation = {
        x: location.x + 0.5,
        y: location.y + 0.5,
        z: location.z + 0.5,
    };
    const xpAmount = X.randomRanged(1, 3);
    for (let i = 0; i < xpAmount; i++) {
        event.dimension.runCommand(`summon xp_orb ${centeredLocation.x} ${centeredLocation.y} ${centeredLocation.z}`);
    }
}
/**
 * Attempts to provide more crops if the block is broken
 */
function attemptToGiveMoreCrops(event, blockPerm, typeId) {
    if (!typeId.includes("wood")) {
        return;
    }
    // Try the chance before everything else
    const chance = Math.random();
    if (chance > 0.2) {
        // There is no reason to continue if the chance would have been missing anyway
        return;
    }
    const table = cropToDropTable[event.brokenBlockPermutation.type.id];
    if (!table) {
        return;
    }
    let isSpecialCase = false;
    const growthBit = blockPerm.getState("growth");
    if (!growthBit) {
        isSpecialCase = passesSpecialChecks(blockPerm, event.brokenBlockPermutation.type.id);
    }
    // It's not fully grown
    if (!isSpecialCase && growthBit < 7) {
        return;
    }
    const location = event.block.location;
    const centeredLocation = {
        x: location.x + 0.5,
        y: location.y + 0.5,
        z: location.z + 0.5,
    };
    event.dimension.spawnItem(new ItemStack(table, 1), centeredLocation);
}
/**
 * Check if the block passes any special checks
 */
function passesSpecialChecks(blockPerm, blockType) {
    if (blockType === "minecraft:leaves") {
        return true;
    }
    if (blockType === "minecraft:pumpkin" || blockType === "minecraft:melon_block") {
        return true;
    }
    if (blockType === "minecraft:cocoa") {
        const ageBit = blockPerm.getState("age");
        return ageBit >= 2;
    }
    if (blockType === "minecraft:brown_mushroom_block" || blockType === "minecraft:red_mushroom_block") {
        return true;
    }
    return false;
}
/**
 * Attempt to spawn a summoner entity if the block is broken
 */
function attemptToSpawnWithSummoner(event, blockPerm, typeId) {
    if (!typeId.includes("rock_stone")) {
        return;
    }
    const chance = Math.random();
    if (chance > 0.05) {
        return;
    }
    const result = summonerEntitySpawns[event.brokenBlockPermutation.type.id];
    if (!result) {
        return;
    }
    const location = event.block.location;
    const centeredLocation = {
        x: location.x + 0.5,
        y: location.y + 0.5,
        z: location.z + 0.5,
    };
    event.player.dimension.runCommand(`summon ${result} ${centeredLocation.x} ${centeredLocation.y} ${centeredLocation.z}`);
}
/**
 * Attempt to smelt the block if it's a smeltery item
 */
function attemptToSmelt(player, dimension, itemInHand, blockBroken, typeId, effects = true) {
    if (!typeId.includes("ardite")) {
        return;
    }
    // Test the blacklist first
    const brokenBlock = blockBroken.typeId;
    const foundBlock = smeltingConflictBlacklist[brokenBlock];
    if (foundBlock) {
        return;
    }
    const blockMatch = smeltingDropTables[brokenBlock];
    if (!blockMatch) {
        return;
    }
    // Collect the old drops, kill them, then spawn the new ones
    const location = blockBroken.location;
    // Center the location of the new spawn
    const centeredLocation = {
        x: location.x + 0.5,
        y: location.y + 0.5,
        z: location.z + 0.5,
    };
    // Find the block drops and kill them
    const drops = dimension.getEntities({
        location: centeredLocation,
        maxDistance: 0.8,
    });
    const blockToDelete = unexpectedDropsConversion[brokenBlock] ?? brokenBlock;
    for (const drop of drops) {
        if (drop.typeId === "minecraft:item") {
            const itemComponent = drop.getComponent(EntityComponentTypes.Item);
            if (!itemComponent) {
                continue;
            }
            if (itemComponent.itemStack.typeId === blockToDelete || itemComponent.itemStack.typeId.startsWith("minecraft:raw_") || itemComponent.itemStack.typeId.startsWith("ftb_tc:raw_")) {
                drop.kill();
            }
        }
    }
    if (effects) {
        const randomPitch = X.randomRanged(0.6, 1.2);
        player.playSound("random.fizz", {
            volume: 0.15,
            pitch: randomPitch,
        });
        for (let i = 0; i < 2; i++) {
            dimension.spawnParticle("ftb_tc:ardite_flame_particle", centeredLocation);
        }
    }
    let fortuneLevel = 0;
    const toolsEnchantments = itemInHand.getComponent(ItemComponentTypes.Enchantable);
    if (toolsEnchantments) {
        const fortune = toolsEnchantments.getEnchantment("minecraft:fortune");
        if (fortune) {
            fortuneLevel = fortune.level;
        }
    }
    const spawnLoot = () => {
        dimension.runCommand(`loot spawn ${centeredLocation.x} ${centeredLocation.y} ${centeredLocation.z} loot "${blockMatch}"`);
        dimension.runCommand('scoreboard players add "ftb_tc:ardite_block" "ftb_tc:jig_computer.addon_stats" 1');
        const chanceForXp = Math.random();
        if (chanceForXp < 0.25) {
            dimension.runCommand(`summon xp_orb ${centeredLocation.x} ${centeredLocation.y} ${centeredLocation.z}`);
        }
    };
    // Garentee at least one drop
    spawnLoot();
    // Roll for the second drop
    for (let i = 0; i < fortuneLevel; i++) {
        const chance = Math.random();
        if (chance < 0.25) { // A 25% chance to spawn another
            spawnLoot();
        }
    }
}

export { attemptToSmelt };
