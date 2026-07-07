import { system, world, EntityComponentTypes, EquipmentSlot, ItemStack } from '@minecraft/server';
import { SmelteryMaterials } from '../recipes/recipes.js';
import { Mth as X, tc as Ot, ItemUtils as y } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const defaultAutoUpdateTimer = X.TICKS_PER_SECOND * 10; // ticks (20 TPS)
const defaultMessages = {
    cheeseSolidifying: ["The Milk is still solidifying.", "Good things come to those who wait... for cheese.", "Cheese is not ready."]
};
const messageStates = {
    "0,0,0": { messages: ["An empty basin. What liquid will you try first?", "Ready for a liquid. Which bucket will it be?", "Try using any bucket of liquid in here."] },
    "0,1,4": { messages: defaultMessages.cheeseSolidifying },
    "0,1,5": { messages: defaultMessages.cheeseSolidifying },
    "0,1,6": { messages: defaultMessages.cheeseSolidifying },
};
// Auto sequencer states
const autoUpdateStatesSequence = {
    "0,1,3": {
        initialTimer: 200, // How long before first step
        sequence: [
            { state: [0, 1, 4], timer: 200 },
            { state: [0, 1, 5], timer: 200 },
            { state: [0, 1, 6], timer: 200 },
            { state: [0, 1, 7], timer: 200 },
        ],
        loop: false,
    },
};
// ============================
//     AUTO-UPDATE RULES
// ============================
const autoUpdateStates = {
    "0,1,8": { newState: [0, 1, 9] }, // Queen Slime
    "0,2,0": { newState: [0, 2, 1] }, // Scarlet Slime
    // "0,0,3": { newState: [0, 0, 4] },
    // "0,0,5": { newState: [0, 0, 6] },
    // "0,0,7": { newState: [0, 0, 8] },
    // "0,0,9": { newState: [0, 0, 10] },
    // "0,0,11": { newState: [0, 0, 12] },
    // "0,0,13": { newState: [0, 0, 14] },
    // "0,0,15": { newState: [0, 1, 0] },
    // "0,1,1": { newState: [0, 1, 2] },
    // "0,1,3": { newState: [0, 1, 4] },
    // "0,1,5": { newState: [0, 1, 6] },
    // "0,1,7": { newState: [0, 1, 8] },
    // "0,1,9": { newState: [0, 1, 10] },
    // "0,1,11": { newState: [0, 1, 12] },
    // "0,1,13": { newState: [0, 1, 14] },
    // "0,2,2": { newState: [0, 2, 3] },
    // "0,2,5": { newState: [0, 2, 6] },
    // "0,2,8": { newState: [0, 2, 9] },
    // "0,2,11": { newState: [0, 2, 12] },
    // "0,2,14": { newState: [0, 2, 15] },
    // "0,3,1": { newState: [0, 3, 2] },
    // "0,3,3": { newState: [0, 3, 4] },
    // "0,3,5": { newState: [0, 3, 6] },
    // "0,3,7": { newState: [0, 3, 8] },
    // "0,3,9": { newState: [0, 3, 10], timer: 300 },
    // "1,0,0": { newState: [1, 0, 1]},
    // "1,0,2": { newState: [1, 0, 3]},
};
// ============================
//     MULTI-STAGE PROGRESSION
// ============================
const stateProgression = [
    // 1a: Empty Basin
    {
        condition: [0, 0, 0],
        item: "minecraft:lava_bucket",
        newState: [0, 0, 1],
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        condition: [0, 0, 0],
        item: "ftb_tc:seared_brick_block",
        newState: [0, 0, 3],
    },
    {
        condition: [0, 0, 0],
        item: "minecraft:rabbit_foot",
        newState: [0, 0, 5],
        sound: "mob.rabbit.idle",
    },
    {
        condition: [0, 0, 0],
        item: "minecraft:shulker_shell",
        newState: [0, 0, 6],
        sound: "mob.shulker.open",
    },
    {
        condition: [0, 0, 0],
        item: "ftb_tc:plate_chestplate",
        newState: [0, 0, 7],
        sound: "armor.equip_leather",
    },
    {
        condition: [0, 0, 0],
        item: "ftb_tc:travelers_helmet",
        newState: [0, 0, 8],
        sound: "armor.equip_leather",
    },
    {
        condition: [0, 0, 0],
        item: "ftb_tc:blaze_head_item",
        newState: [0, 0, 9],
        sound: "mob.blaze.shoot",
    },
    {
        condition: [0, 0, 0],
        item: "ftb_tc:bucket_scarlet_slime",
        newState: [0, 2, 0],
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        condition: [0, 2, 1],
        newState: [0, 0, 0],
        returnItem: "ftb_tc:congealed_scarlet_essence",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 0],
        item: "minecraft:milk_bucket",
        newState: [0, 1, 3],
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_milk",
    },
    // 1b: secondary interaction
    {
        condition: [0, 0, 1],
        item: "minecraft:water_bucket",
        newState: [0, 0, 2],
        returnItem: "minecraft:bucket",
        sound: "random.fizz",
    },
    {
        condition: [0, 0, 3],
        item: "ftb_tc:bucket_copper",
        newState: [0, 0, 4],
    },
    {
        condition: [0, 0, 5],
        item: "ftb_tc:bucket_ender_slime",
        newState: [0, 2, 2],
        returnItem: "minecraft:bucket",
        sound: "random.fizz",
    },
    {
        condition: [0, 0, 6],
        item: "ftb_tc:bucket_ender_slime",
        newState: [0, 2, 3],
        returnItem: "minecraft:bucket",
        sound: "random.fizz",
    },
    {
        condition: [0, 0, 7],
        item: "ftb_tc:bucket_ender_slime",
        newState: [0, 2, 4],
        returnItem: "minecraft:bucket",
        sound: "random.fizz",
    },
    {
        condition: [0, 0, 8],
        item: "ftb_tc:bucket_ender_slime",
        newState: [0, 2, 5],
        returnItem: "minecraft:bucket",
        sound: "random.fizz",
    },
    {
        condition: [0, 0, 9],
        item: "minecraft:lava_bucket",
        newState: [0, 1, 1],
        returnItem: "minecraft:bucket",
        sound: "random.fizz",
    },
    // 1c: take liquid out
    {
        condition: [0, 1, 8],
        item: "minecraft:bucket",
        newState: [0, 0, 0],
        returnItem: "ftb_tc:bucket_queens_slime",
        sound: "bucket.empty_lava",
    },
    {
        condition: [0, 0, 1],
        item: "minecraft:bucket",
        newState: [0, 0, 0],
        returnItem: "minecraft:lava_bucket",
        sound: "bucket.empty_lava",
    },
    {
        condition: [0, 1, 1],
        item: "minecraft:bucket",
        newState: [0, 0, 0],
        returnItem: "ftb_tc:bucket_blaze",
        sound: "bucket.empty_lava",
    },
    {
        condition: [0, 1, 3],
        item: "minecraft:bucket",
        newState: [0, 0, 0],
        returnItem: "minecraft:milk_bucket",
        sound: "bucket.empty_milk",
    },
    // 2: take solid out
    {
        condition: [0, 1, 9],
        returnItem: "ftb_tc:queens_slime_block",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 2],
        returnItem: "minecraft:obsidian",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 3],
        returnItem: "ftb_tc:seared_brick_block",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 4],
        returnItem: "ftb_tc:smeltery_controller",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 5],
        returnItem: "minecraft:rabbit_foot",
        sound: "random.pop",
    },
    {
        condition: [0, 2, 2],
        returnItem: "ftb_tc:slime_boots",
        sound: "random.pop",
    },
    {
        condition: [0, 2, 3],
        returnItem: "ftb_tc:slime_leggings",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 6],
        returnItem: "minecraft:shulker_shell",
        sound: "random.pop",
    },
    {
        condition: [0, 2, 4],
        returnItem: "ftb_tc:slime_chestplate",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 7],
        returnItem: "ftb_tc:plate_chestplate",
        sound: "random.pop",
    },
    {
        condition: [0, 2, 5],
        returnItem: "ftb_tc:slime_helmet",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 8],
        returnItem: "ftb_tc:travelers_helmet",
        sound: "random.pop",
    },
    {
        condition: [0, 0, 9],
        returnItem: "ftb_tc:blaze_head_item",
        sound: "random.pop",
    },
    {
        condition: [0, 1, 7],
        returnItem: "ftb_tc:cheese_block",
        sound: "use.slime",
    }
];
for (let material of SmelteryMaterials.materials) {
    const numberStateArray = SmelteryMaterials.numberArray(material);
    stateProgression.push({
        condition: [0, 0, 0],
        item: Ot("bucket_" + material.id),
        newState: [1, numberStateArray[0], numberStateArray[1]],
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    });
    stateProgression.push({
        condition: [2, numberStateArray[0], numberStateArray[1]],
        returnItem: material.blockId,
        sound: "random.pop",
    });
    stateProgression.push({
        condition: [1, numberStateArray[0], numberStateArray[1]],
        item: "minecraft:bucket",
        newState: [0, 0, 0],
        returnItem: Ot("bucket_" + material.id),
        sound: "bucket.empty_lava",
    });
    autoUpdateStates[`1,${numberStateArray[0]},${numberStateArray[1]}`] = {
        newState: [2, numberStateArray[0], numberStateArray[1]],
        sound: "random.fizz",
        particle: "minecraft:basic_smoke_particle",
    };
}
// ============================
//         TRACKERS
// ============================
const autoUpdateTrackers = new Map();
const sequenceTrackers = new Map();
function getBlockLocationKey(block) {
    return `${block.location.x},${block.location.y},${block.location.z}`;
}
function triggerEffects(block, dimension, config) {
    if (config.sound) {
        dimension.playSound(config.sound, { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
    }
    if (config.particle) {
        dimension.spawnParticle(config.particle, { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
    }
    if (config.message) {
        for (const player of dimension.getPlayers({ location: block.location, maxDistance: 8 })) {
            player.sendMessage(config.message);
        }
    }
}
function giveItemToPlayer(player, itemId, amount = 1) {
    const item = new ItemStack(itemId, amount);
    const inventoryComponent = player.getComponent(EntityComponentTypes.Inventory);
    if (inventoryComponent)
        inventoryComponent.container?.addItem(item);
}
function getBlockStateKey(permutation) {
    return [
        permutation.getState("ftb_tc:type"),
        permutation.getState("ftb_tc:material_1"),
        permutation.getState("ftb_tc:material_2"),
    ].join(",");
}
function setBlockState(block, newState) {
    let updatedPermutation = block.permutation;
    ["ftb_tc:type", "ftb_tc:material_1", "ftb_tc:material_2"].forEach((state, index) => {
        updatedPermutation = updatedPermutation.withState(state, newState[index]);
    });
    block.setPermutation(updatedPermutation);
}
// ============================
//     TRACKER CLEANUP
// ============================
system.runInterval(() => {
    const dimension = world.getDimension("overworld");
    autoUpdateTrackers.forEach((_, key) => {
        const [x, y, z] = key.split(",").map(Number);
        const block = dimension.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            autoUpdateTrackers.delete(key);
    });
    sequenceTrackers.forEach((_, key) => {
        const [x, y, z] = key.split(",").map(Number);
        const block = dimension.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            sequenceTrackers.delete(key);
    });
}, 200);
// ============================
//   CASTING BASIN COMPONENT
// ============================
class CastingBasinComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            if (!event.player || !event.block)
                return;
            const block = event.block;
            const permutation = block.permutation;
            const equipment = event.player.getComponent(EntityComponentTypes.Equippable);
            if (!equipment)
                return;
            const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
            const itemType = mainHand?.typeId ?? null;
            const currentState = getBlockStateKey(permutation);
            getBlockLocationKey(block);
            for (const step of stateProgression) {
                if (step.condition.join(",") === currentState && (step.item === itemType || !step.item)) {
                    setBlockState(block, step.newState ?? [0, 0, 0]);
                    event.dimension.playSound(step.sound ?? "use.stone", { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
                    if (step.returnItem)
                        giveItemToPlayer(event.player, step.returnItem, 1);
                    if (step.item && step.item !== "TIMER")
                        equipment.setEquipment(EquipmentSlot.Mainhand, y.shrinkItemStack(mainHand));
                    return;
                }
            }
            const msgState = messageStates[currentState];
            if (msgState) {
                const msg = Array.isArray(msgState.messages)
                    ? msgState.messages[Math.floor(Math.random() * msgState.messages.length)]
                    : msgState.messages;
                event.player.sendMessage(msg);
            }
            event.dimension.playSound("vr.stutterturn", { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 });
        };
        this.onTick = (event) => {
            const block = event.block;
            const permutation = block.permutation;
            const stateKey = [
                permutation.getState("ftb_tc:type"),
                permutation.getState("ftb_tc:material_1"),
                permutation.getState("ftb_tc:material_2"),
            ].join(",");
            const blockKey = getBlockLocationKey(block);
            // === Auto Update ===
            if (stateKey in autoUpdateStates) {
                const data = autoUpdateStates[stateKey];
                const timer = data.timer ?? defaultAutoUpdateTimer;
                const nextTick = autoUpdateTrackers.get(blockKey);
                if (nextTick === undefined) {
                    // First time seeing this block → initialize and wait for timer
                    autoUpdateTrackers.set(blockKey, system.currentTick + timer);
                    return;
                }
                if (system.currentTick < nextTick)
                    return;
                // Time to update state
                setBlockState(block, data.newState ?? [0, 0, 0]);
                triggerEffects(block, event.dimension, data);
                autoUpdateTrackers.set(blockKey, system.currentTick + timer);
                return;
            }
            // === Sequence update ===
            const runningSeq = sequenceTrackers.get(blockKey);
            if (runningSeq) {
                const sequenceData = autoUpdateStatesSequence[runningSeq.sequenceId];
                if (!sequenceData) {
                    sequenceTrackers.delete(blockKey);
                    return;
                }
                if (system.currentTick < runningSeq.nextTick)
                    return;
                const step = sequenceData.sequence[runningSeq.index];
                if (!step)
                    return;
                setBlockState(block, step.state ?? [0, 0, 0]);
                triggerEffects(block, event.dimension, step);
                runningSeq.index++;
                if (runningSeq.index >= sequenceData.sequence.length) {
                    if (sequenceData.loop) {
                        runningSeq.index = 0;
                    }
                    else {
                        sequenceTrackers.delete(blockKey);
                        return;
                    }
                }
                const nextStep = sequenceData.sequence[runningSeq.index];
                runningSeq.nextTick = system.currentTick + (nextStep?.timer ?? defaultAutoUpdateTimer);
                sequenceTrackers.set(blockKey, runningSeq);
                return;
            }
            // === Start new sequence if defined ===
            if (stateKey in autoUpdateStatesSequence) {
                const sequenceData = autoUpdateStatesSequence[stateKey];
                sequenceTrackers.set(blockKey, {
                    sequenceId: stateKey,
                    index: 0,
                    nextTick: system.currentTick + (sequenceData.initialTimer ?? defaultAutoUpdateTimer),
                });
            }
        };
    }
}

export { CastingBasinComponent };
