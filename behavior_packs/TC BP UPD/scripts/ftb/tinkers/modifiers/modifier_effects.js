import { world, system, BlockVolume, EntityComponentTypes, EquipmentSlot, ItemStack, BlockPermutation, EntityDamageCause, EnchantmentTypes, ItemComponentTypes } from '@minecraft/server';
import { isEntityPlayer } from '../utils.js';
import { getDurability, updateDurability } from '../durability.js';
import { attemptToSmelt } from '../block_break.js';
import { tc as Ot, vec3 as Rt, mc as Nt } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const modifierPropsToEffect = {
    [Ot("bright")]: brightEffect,
    [Ot("sponged")]: spongedEffect,
    [Ot("resistence")]: resistenceEffect,
    [Ot("water_breathing")]: waterBreathingEffect,
};
function modifierPlayerTick(playerController, playerInventory, mainhand) {
    const currentTicks = system.currentTick;
    // All effects run every 10 ticks
    if (currentTicks % 10 !== 0) {
        return;
    }
    effectResets(playerController, mainhand);
    if (!mainhand) {
        return;
    }
    const itemProps = mainhand.getDynamicPropertyIds();
    const context = {
        playerController,
        playerInventory,
        mainhand,
        player: playerController.player,
        itemProps,
    };
    for (const [key, value] of Object.entries(modifierPropsToEffect)) {
        if (itemProps.includes(key)) {
            value(context);
        }
    }
}
function resistenceEffect(context) {
    const player = context.player;
    const effects = player.getEffects();
    const resistenceEffect = effects.find((effect) => effect.typeId === Nt("resistance"));
    if (resistenceEffect) {
        return;
    }
    const level = context.mainhand.getDynamicProperty(Ot("resistence")) ?? 1;
    player.addEffect(Nt("resistance"), 20 * 5, {
        amplifier: level - 1,
        showParticles: false,
    }); // 5 seconds
}
function effectResets(playerController, mainhand) {
    const itemProps = mainhand?.getDynamicPropertyIds() ?? [];
    if (!mainhand || !itemProps.includes(Ot("bright"))) {
        const lightProp = playerController.player.getDynamicProperty(Ot("lastLightPos"));
        if (lightProp) {
            playerController.player.setDynamicProperty(Ot("lastLightPos"), undefined);
            // Remove the light
            const lightPos = deserializeVec3(lightProp);
            playerController.player.dimension.setBlockPermutation(lightPos, BlockPermutation.resolve(Nt("air")));
        }
    }
}
function brightEffect(context) {
    const { player } = context;
    const lightLocation = {
        x: player.location.x,
        y: player.location.y + 1,
        z: player.location.z,
    };
    const lastLightPosRaw = player.getDynamicProperty(Ot("lastLightPos"));
    if (lastLightPosRaw) {
        const lastLightPos = deserializeVec3(lastLightPosRaw);
        if (lastLightPos === lightLocation) {
            return;
        }
        // Remove the last light
        player.dimension.setBlockPermutation(lastLightPos, BlockPermutation.resolve(Nt("air")));
    }
    const theBlock = player.dimension.getBlock(lightLocation);
    if (!theBlock.isAir) {
        return;
    }
    // Place a new light at the players location
    player.dimension.setBlockPermutation(lightLocation, BlockPermutation.resolve(Nt("light_block_15")));
    player.setDynamicProperty(Ot("lastLightPos"), serializeVec3(lightLocation));
}
function spongedEffect(context) {
    const playerLocation = context.player.location;
    const size = 8;
    const halfSize = Math.floor(size / 2);
    context.player.runCommand(`fill ${playerLocation.x - halfSize} ${playerLocation.y - halfSize} ${playerLocation.z - halfSize} ${playerLocation.x + halfSize} ${playerLocation.y + halfSize} ${playerLocation.z + halfSize} air replace water`);
}
function waterBreathingEffect(context) {
    const playerEffects = context.player.getEffects();
    const waterBreathing = playerEffects.find((effect) => effect.typeId === "water_breathing");
    if (!waterBreathing || waterBreathing.duration < 20) {
        context.player.addEffect(Nt("water_breathing"), 20 * 5, {
            showParticles: false,
        }); // 5 seconds
    }
}
world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const props = event.itemStack?.getDynamicPropertyIds() ?? [];
    if (props.includes(Ot("ultimine"))) {
        ultimineBlockBreakEffect(event);
    }
    if (props.includes(Ot("explosive"))) {
        explosiveBlockBreakEffect(event);
    }
});
function explosiveBlockBreakEffect(event) {
    // Define the list of block type IDs that shouldn't be broken
    const doNotBreakList = ["minecraft:bedrock"];
    // Get the block hit face, then break blocks in a 3x3 area in that direction
    const rayBlock = event.player.getBlockFromViewDirection();
    if (!rayBlock) {
        return;
    }
    const face = rayBlock.face;
    let bottomLeftCorner;
    let topRightCorner;
    if (face === "Up" || face === "Down") {
        // We need to expand the area to break in the x and z directions
        bottomLeftCorner = { x: -1, y: 0, z: -1 };
        topRightCorner = { x: 1, y: 0, z: 1 };
    }
    else if (face === "North" || face === "South") {
        // We need to expand the area to break in the x and y directions
        bottomLeftCorner = { x: -1, y: -1, z: 0 };
        topRightCorner = { x: 1, y: 1, z: 0 };
    }
    else {
        // We need to expand the area to break in the y and z directions
        bottomLeftCorner = { x: 0, y: -1, z: -1 };
        topRightCorner = { x: 0, y: 1, z: 1 };
    }
    const player = event.player;
    const location = event.block.location;
    system.run(() => {
        event.itemStack?.typeId;
        const volume = new BlockVolume(Rt(location.x + bottomLeftCorner.x, location.y + bottomLeftCorner.y, location.z + bottomLeftCorner.z), Rt(location.x + topRightCorner.x, location.y + topRightCorner.y, location.z + topRightCorner.z));
        const iterator = volume.getBlockLocationIterator();
        for (const loc of iterator) {
            const block = event.dimension.getBlock(loc);
            if (!block)
                continue;
            // Skip blocks in the "do-not-break" list
            if (doNotBreakList.includes(block.typeId)) {
                continue;
            }
            player.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`);
        }
        system.runTimeout(() => {
            const durability = getDurability(event.itemStack);
            if (!durability) {
                return;
            }
            const blocksBroken = 9;
            let maxAppliedDurability = 9;
            if (durability.damage + blocksBroken > durability.maxDurability) {
                maxAppliedDurability = durability.maxDurability - durability.damage; // This produces the amount of blocks we can break
            }
            updateDurability(event.itemStack, player, false, maxAppliedDurability);
        }, 2);
    });
}
const validLogBlocks = [
    Nt("oak_log"),
    Nt("spruce_log"),
    Nt("birch_log"),
    Nt("jungle_log"),
    Nt("acacia_log"),
    Nt("dark_oak_log"),
    Nt("cherry_log"),
    Nt("warped_stem"),
    Nt("crimson_stem"),
    Nt("pale_oak_log"),
    Ot("greenheart_log"),
    Ot("scarletshroom_log"),
    Ot("skyroot_log"),
];
const validOres = [
    Nt("iron_ore"),
    Nt("gold_ore"),
    Nt("diamond_ore"),
    Nt("copper_ore"),
    Nt("emerald_ore"),
    Nt("lapis_ore"),
    Nt("redstone_ore"),
    Nt("coal_ore"),
    Nt("deepslate_iron_ore"),
    Nt("deepslate_gold_ore"),
    Nt("deepslate_diamond_ore"),
    Nt("deepslate_copper_ore"),
    Nt("deepslate_emerald_ore"),
    Nt("deepslate_lapis_ore"),
    Nt("deepslate_redstone_ore"),
    Nt("deepslate_coal_ore"),
    Nt("quartz_ore"),
    Nt("nether_gold_ore"),
    Ot("ardite_ore"),
    Ot("cobalt_ore"),
    Ot("tin_ore"),
    Ot("deepslate_tin_ore"),
];
const validUltimineBlocks = new Set([
    Nt("gravel"),
    Nt("andesite"),
    Nt("diorite"),
    Nt("granite"),
    ...validLogBlocks,
    ...validOres,
]);
/**
 * If we hit a tree, we should break the entire tree, maybe leaves?
 * If we hit an ore, we should break the entire vein
 */
function ultimineBlockBreakEffect(event) {
    const mode = event.itemStack?.getDynamicProperty(Ot("ultimine_mode")) ?? "always";
    if (mode === "sneak" && !event.player.isSneaking) {
        return;
    }
    const targetBlockId = "" + event.block.typeId;
    const targetBlock = event.block;
    const dimension = targetBlock.dimension;
    const brokenBlock = targetBlock.typeId;
    if (!validUltimineBlocks.has(brokenBlock)) {
        return;
    }
    let props = event.itemStack?.getDynamicProperty(Ot("ultimine_settings"));
    if (typeof props === "undefined") {
        props = "logs,ores";
    }
    const allowedBlockTypes = props.split(",");
    if (allowedBlockTypes.length === 0) {
        return;
    }
    let anythingPassed = false;
    if (allowedBlockTypes.includes("logs") &&
        validLogBlocks.includes(brokenBlock))
        anythingPassed = true;
    if (allowedBlockTypes.includes("ores") && validOres.includes(brokenBlock))
        anythingPassed = true;
    if (allowedBlockTypes.includes("gravel") && brokenBlock.includes("gravel"))
        anythingPassed = true;
    if (allowedBlockTypes.includes("andesite") &&
        brokenBlock.includes("andesite"))
        anythingPassed = true;
    if (allowedBlockTypes.includes("diorite") && brokenBlock.includes("diorite"))
        anythingPassed = true;
    if (allowedBlockTypes.includes("granite") && brokenBlock.includes("granite"))
        anythingPassed = true;
    if (!anythingPassed) {
        return;
    }
    system.run(() => {
        const requiresLeaves = brokenBlock.includes("log");
        const blocks = walkConnectedBlocks(dimension, targetBlock.location, (block) => {
            // Trees
            if (requiresLeaves) {
                return (block.matches(brokenBlock) &&
                    block.location.y >= targetBlock.location.y);
            }
            // Ores
            return block.typeId.includes(targetBlockId.replace("deepslate_", "").replace("minecraft:", ""));
        }, requiresLeaves);
        if (requiresLeaves && blocks.leavesCount < 4) {
            return;
        }
        const itemStack = event.itemStack;
        system.runTimeout(() => {
            const durabilityOfitem = getDurability(itemStack);
            if (!durabilityOfitem) {
                return;
            }
            const blocksToBreak = blocks.blocks.size;
            let blocksAllowedToBreak = blocksToBreak;
            const max = durabilityOfitem.maxDurability;
            const newDurability = durabilityOfitem.damage + blocksToBreak;
            if (newDurability > max) {
                // We can't break all the blocks, let's reduce the amount of blocks we can break
                blocksAllowedToBreak = max - durabilityOfitem.damage; // This produces the amount of blocks we can break
            }
            let blockBokenCount = 0;
            for (const b of blocks.blocks) {
                const blockAtPos = dimension.getBlock(b);
                const blockEnough = {
                    typeId: blockAtPos.typeId,
                    isAir: blockAtPos.isAir,
                    location: b,
                };
                event.player.runCommand(`fill ${b.x} ${b.y} ${b.z} ${b.x} ${b.y} ${b.z} air destroy`);
                if (event.itemStack?.typeId.includes("ardite")) {
                    attemptToSmelt(event.player, event.dimension, event.itemStack, blockEnough, event.itemStack.typeId, false);
                }
                blockBokenCount++;
                if (blockBokenCount >= blocksAllowedToBreak) {
                    break;
                }
            }
            updateDurability(itemStack, event.player, false, blockBokenCount);
        }, 2);
    });
}
/**
 * Walks all connected blocks in the dimension starting from the given location
 */
function walkConnectedBlocks(dimension, location, validBlockPredicate, checkLeaves = false) {
    const blocksToCheck = [location];
    const checkedBlocks = new Set();
    const validBlocks = new Set();
    let foundLeaves = 0;
    while (blocksToCheck.length > 0 && validBlocks.size < 500) {
        const current = blocksToCheck.shift(); // FIFO: Dequeue for breadth-first search (BFS)
        if (!current) {
            continue;
        }
        const currentKey = `${current.x},${current.y},${current.z}`;
        if (checkedBlocks.has(currentKey)) {
            continue; // Skip if the block has already been checked
        }
        checkedBlocks.add(currentKey);
        // Draw a 3x3x3 cube around the block
        const volume = new BlockVolume(Rt(current.x - 1, current.y - 1, current.z - 1), Rt(current.x + 1, current.y + 1, current.z + 1));
        const itter = volume.getBlockLocationIterator();
        // Check all blocks within the 3x3x3 cube
        for (const loc of itter) {
            const locKey = `${loc.x},${loc.y},${loc.z}`;
            if (checkedBlocks.has(locKey)) {
                continue;
            }
            const block = dimension.getBlock(loc);
            if (block.isAir) {
                continue; // Skip air blocks
            }
            if (checkLeaves) {
                if (block.typeId.includes("leaves")) {
                    const persistentBit = block.permutation.getState("persistent_bit");
                    // If the block is persistent, skip it, this was placed by a player
                    if (!persistentBit) {
                        foundLeaves++;
                    }
                }
            }
            // If the block is valid, add it to the valid blocks and to the queue to check its neighbors
            if (validBlockPredicate(block)) {
                validBlocks.add(loc);
                blocksToCheck.push(loc);
            }
            else {
                // Mark the location as checked
                checkedBlocks.add(locKey);
            }
        }
    }
    return {
        blocks: validBlocks,
        leavesCount: foundLeaves,
    };
}
const weaponSunderHits = new Set();
const CLEAVER_MAX_HIT = 20;
const CLEAVER_MAX_BASE = 14; // 14 + Sharp V (+6) = 20 attack shown in tooltip

function getWeaponSharpnessLevel(weapon) {
    const enchantable = weapon.getComponent(ItemComponentTypes.Enchantable);
    return enchantable?.getEnchantment(EnchantmentTypes.get(Nt("sharpness")))?.level ?? 0;
}

function getSharpnessDamageBonus(sharpLevel) {
    if (sharpLevel <= 0) {
        return 0;
    }
    return Math.floor(sharpLevel * 1.25 + 0.5);
}

function getMeleeWeaponSunderBonus(weapon) {
    const typeId = weapon.typeId;
    const sharpLevel = getWeaponSharpnessLevel(weapon);
    const stealLevel = weapon.getDynamicProperty(Ot("necrotic_modifier")) ?? 0;

    if (typeId.includes("cleaver_head_")) {
        // Max-tier base is 14; Sharp V (+6) shows 20 attack; sunder adds up to +4 in combat.
        const bonus = 2 + Math.floor(sharpLevel / 2) + Math.floor(stealLevel / 2);
        return Math.min(bonus, CLEAVER_MAX_HIT - CLEAVER_MAX_BASE);
    }
    if (typeId.includes("sword_guard_")) {
        return 1 + Math.floor(sharpLevel / 3) + Math.floor(stealLevel / 3);
    }
    if (typeId.includes("dagger_blade_")) {
        return 1 + Math.floor(sharpLevel / 4) + Math.floor(stealLevel / 4);
    }
    if (typeId.includes("hand_axe_") || typeId.includes("broad_axe_")) {
        return 1 + Math.floor(sharpLevel / 3);
    }
    return 0;
}

function isTinkersMeleeWeapon(typeId) {
    return typeId.includes("cleaver_head_")
        || typeId.includes("sword_guard_")
        || typeId.includes("dagger_blade_")
        || typeId.includes("hand_axe_")
        || typeId.includes("broad_axe_");
}

function capCleaverHitDamage(event, weapon) {
    const sunderBonus = getMeleeWeaponSunderBonus(weapon);
    const sharpLevel = getWeaponSharpnessLevel(weapon);
    const sharpBonus = getSharpnessDamageBonus(sharpLevel);

    if (event.damage + sunderBonus > CLEAVER_MAX_HIT) {
        event.damage = Math.max(0, CLEAVER_MAX_HIT - sunderBonus);
        return;
    }

    // Sharpness can apply after beforeEvents; reserve room for sunder + sharp.
    if (sharpLevel > 0 && event.damage + sharpBonus + sunderBonus > CLEAVER_MAX_HIT) {
        event.damage = Math.max(0, CLEAVER_MAX_HIT - sunderBonus - sharpBonus);
    }
}

if (world.beforeEvents?.entityHurt) {
    world.beforeEvents.entityHurt.subscribe((event) => {
        const damager = event.damageSource?.damagingEntity;
        const hurtEntity = event.hurtEntity;
        if (!damager?.isValid || !hurtEntity?.isValid) {
            return;
        }
        if (damager.typeId !== "minecraft:player" || damager.id === hurtEntity.id) {
            return;
        }

        const weapon = damager.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand);
        if (!weapon?.typeId.includes("cleaver_head_")) {
            return;
        }

        capCleaverHitDamage(event, weapon);
    });
}

world.afterEvents.entityHurt.subscribe((event) => {
    const hurtEntity = event.hurtEntity;
    const damager = event.damageSource?.damagingEntity;
    if (!hurtEntity?.isValid || !damager?.isValid) {
        return;
    }
    if (damager.typeId !== "minecraft:player") {
        return;
    }
    if (hurtEntity.id === damager.id) {
        return;
    }

    const equippable = damager.getComponent(EntityComponentTypes.Equippable);
    const weapon = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!weapon || !isTinkersMeleeWeapon(weapon.typeId)) {
        return;
    }

    let bonus = getMeleeWeaponSunderBonus(weapon);
    if (weapon.typeId.includes("cleaver_head_")) {
        bonus = Math.min(bonus, Math.max(0, CLEAVER_MAX_HIT - (event.damage ?? 0)));
    }
    if (bonus <= 0) {
        return;
    }

    const sunderKey = `${damager.id}:${hurtEntity.id}:${system.currentTick}`;
    if (weaponSunderHits.has(sunderKey)) {
        return;
    }

    weaponSunderHits.add(sunderKey);
    system.run(() => {
        try {
            if (hurtEntity.isValid) {
                hurtEntity.applyDamage(bonus, {
                    cause: EntityDamageCause.override,
                    damagingEntity: damager,
                });
            }
        } finally {
            system.runTimeout(() => weaponSunderHits.delete(sunderKey), 2);
        }
    });
});

world.afterEvents.entityHitEntity.subscribe((event) => {
    const target = event.hitEntity;
    const source = event.damagingEntity;
    if (!isEntityPlayer(source)) {
        return;
    }
    const itemStack = source.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand);
    if (!itemStack) {
        return;
    }
    if (itemStack.getDynamicProperty(Ot("electrifying"))) {
        electrifyingEffect(event, target);
    }
    if (itemStack.getDynamicProperty(Ot("starstruck"))) {
        starstruckEffect(event, target, source);
    }
    if (itemStack.getDynamicProperty(Ot("necrotic_modifier"))) {
        regenerationEffect(event, target, source, itemStack);
    }
});
function electrifyingEffect(event, target, source) {
    // Roll for a 10% chance to apply the effect
    if (Math.random() > 0.1) {
        return;
    }
    // Strike the target with lightning
    target.dimension.spawnEntity(Nt("lightning_bolt"), target.location);
}
function starstruckEffect(event, target, source) {
    const health = target.getComponent(EntityComponentTypes.Health);
    if (!health) {
        return;
    }
    const family = target.getComponent(EntityComponentTypes.TypeFamily);
    if (!family) {
        return;
    }
    if (!family.hasTypeFamily("monster")) {
        return;
    }
    const targetHealth = health.currentValue;
    if (targetHealth > 0) {
        return;
    }
    // Roll for a 5% chance to apply the effect
    if (Math.random() > 0.05) {
        return;
    }
    // Drop a star on the target
    source.dimension.spawnItem(new ItemStack(Nt("nether_star")), target.location);
}
function regenerationEffect(event, target, source, itemStack) {
    // Get the players health
    const effects = source.getEffects();
    const regenerationEffect = effects.find((effect) => effect.typeId.includes("necrotic_modifier"));
    if (regenerationEffect) {
        return;
    }
    const level = itemStack.getDynamicProperty(Ot("necrotic_modifier")) ?? 1;
    // Give regeneration to the player
    source.addEffect(Nt("regeneration"), 20 * 5, {
        amplifier: level - 1,
        showParticles: false,
    }); // 5 seconds
}
function serializeVec3(vec) {
    return `${vec.x}|${vec.y}|${vec.z}`;
}
function deserializeVec3(str) {
    const parts = str.split("|");
    if (parts.length !== 3) {
        return { x: 0, y: 0, z: 0 };
    }
    const [x, y, z] = parts.map((v) => parseFloat(v));
    return { x, y, z };
}

export { modifierPlayerTick, serializeVec3 };
