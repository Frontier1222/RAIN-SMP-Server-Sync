import { system, world, EntityComponentTypes, EquipmentSlot, ItemStack } from '@minecraft/server';

// ====== Config ======
const config = {
    interactSound: "note.pling",
    defaultFuelSound: "random.fizz",
    defaultSmeltSound: "bucket.empty_lava",
    defaultExtractSound: "bucket.fill_lava",
};
const defaultAutoUpdateTimer = 100;
const fuelItems = {
    "minecraft:coal": { amount: 1 },
    "minecraft:charcoal": { amount: 1 },
    "minecraft:coal_block": { amount: 8 },
    "minecraft:lava_bucket": { amount: 8, sound: "bucket.empty_lava", returnItem: "minecraft:bucket" },
    "minecraft:dried_kelp_block": { "amount": 1 },
    "minecraft:blaze_rod": { "amount": 2 },
    "minecraft:boat": { "amount": 1 },
    "minecraft:boat_with_chest": { "amount": 1 },
    "minecraft:oak_log": { "amount": 1 },
    "minecraft:spruce_log": { "amount": 1 },
    "minecraft:birch_log": { "amount": 1 },
    "minecraft:jungle_log": { "amount": 1 },
    "minecraft:acacia_log": { "amount": 1 },
    "minecraft:dark_oak_log": { "amount": 1 },
    "minecraft:mangrove_log": { "amount": 1 },
    "minecraft:cherry_log": { "amount": 1 },
    "minecraft:stripped_oak_log": { "amount": 1 },
    "minecraft:stripped_spruce_log": { "amount": 1 },
    "minecraft:stripped_birch_log": { "amount": 1 },
    "minecraft:stripped_jungle_log": { "amount": 1 },
    "minecraft:stripped_acacia_log": { "amount": 1 },
    "minecraft:stripped_dark_oak_log": { "amount": 1 },
    "minecraft:stripped_mangrove_log": { "amount": 1 },
    "minecraft:stripped_cherry_log": { "amount": 1 },
    "minecraft:oak_wood": { "amount": 1 },
    "minecraft:spruce_wood": { "amount": 1 },
    "minecraft:birch_wood": { "amount": 1 },
    "minecraft:jungle_wood": { "amount": 1 },
    "minecraft:acacia_wood": { "amount": 1 },
    "minecraft:dark_oak_wood": { "amount": 1 },
    "minecraft:mangrove_wood": { "amount": 1 },
    "minecraft:cherry_wood": { "amount": 1 },
    "minecraft:stripped_oak_wood": { "amount": 1 },
    "minecraft:stripped_spruce_wood": { "amount": 1 },
    "minecraft:stripped_birch_wood": { "amount": 1 },
    "minecraft:stripped_jungle_wood": { "amount": 1 },
    "minecraft:stripped_acacia_wood": { "amount": 1 },
    "minecraft:stripped_dark_oak_wood": { "amount": 1 },
    "minecraft:stripped_mangrove_wood": { "amount": 1 },
    "minecraft:stripped_cherry_wood": { "amount": 1 },
    "minecraft:oak_planks": { "amount": 1 },
    "minecraft:spruce_planks": { "amount": 1 },
    "minecraft:birch_planks": { "amount": 1 },
    "minecraft:jungle_planks": { "amount": 1 },
    "minecraft:acacia_planks": { "amount": 1 },
    "minecraft:dark_oak_planks": { "amount": 1 },
    "minecraft:mangrove_planks": { "amount": 1 },
    "minecraft:cherry_planks": { "amount": 1 },
    "minecraft:bamboo_mosaic": { "amount": 1 },
    "minecraft:bamboo_mosaic_slab": { "amount": 1 },
    "minecraft:bamboo_mosaic_stairs": { "amount": 1 },
    "minecraft:oak_slab": { "amount": 1 },
    "minecraft:spruce_slab": { "amount": 1 },
    "minecraft:birch_slab": { "amount": 1 },
    "minecraft:jungle_slab": { "amount": 1 },
    "minecraft:acacia_slab": { "amount": 1 },
    "minecraft:dark_oak_slab": { "amount": 1 },
    "minecraft:mangrove_slab": { "amount": 1 },
    "minecraft:cherry_slab": { "amount": 1 },
    "minecraft:oak_stairs": { "amount": 1 },
    "minecraft:spruce_stairs": { "amount": 1 },
    "minecraft:birch_stairs": { "amount": 1 },
    "minecraft:jungle_stairs": { "amount": 1 },
    "minecraft:acacia_stairs": { "amount": 1 },
    "minecraft:dark_oak_stairs": { "amount": 1 },
    "minecraft:mangrove_stairs": { "amount": 1 },
    "minecraft:cherry_stairs": { "amount": 1 },
    "minecraft:oak_fence": { "amount": 1 },
    "minecraft:spruce_fence": { "amount": 1 },
    "minecraft:birch_fence": { "amount": 1 },
    "minecraft:jungle_fence": { "amount": 1 },
    "minecraft:acacia_fence": { "amount": 1 },
    "minecraft:dark_oak_fence": { "amount": 1 },
    "minecraft:mangrove_fence": { "amount": 1 },
    "minecraft:cherry_fence": { "amount": 1 },
    "minecraft:oak_fence_gate": { "amount": 1 },
    "minecraft:spruce_fence_gate": { "amount": 1 },
    "minecraft:birch_fence_gate": { "amount": 1 },
    "minecraft:jungle_fence_gate": { "amount": 1 },
    "minecraft:acacia_fence_gate": { "amount": 1 },
    "minecraft:dark_oak_fence_gate": { "amount": 1 },
    "minecraft:mangrove_fence_gate": { "amount": 1 },
    "minecraft:cherry_fence_gate": { "amount": 1 },
    "minecraft:oak_trapdoor": { "amount": 1 },
    "minecraft:spruce_trapdoor": { "amount": 1 },
    "minecraft:birch_trapdoor": { "amount": 1 },
    "minecraft:jungle_trapdoor": { "amount": 1 },
    "minecraft:acacia_trapdoor": { "amount": 1 },
    "minecraft:dark_oak_trapdoor": { "amount": 1 },
    "minecraft:mangrove_trapdoor": { "amount": 1 },
    "minecraft:cherry_trapdoor": { "amount": 1 },
    "minecraft:crafting_table": { "amount": 1 },
    "minecraft:bookshelf": { "amount": 1 },
    "minecraft:chiseled_bookshelf": { "amount": 1 },
    "minecraft:note_block": { "amount": 1 },
    "minecraft:daylight_detector": { "amount": 1 },
    "minecraft:wooden_axe": { "amount": 1 },
    "minecraft:wooden_pickaxe": { "amount": 1 },
    "minecraft:wooden_shovel": { "amount": 1 },
    "minecraft:wooden_hoe": { "amount": 1 },
    "minecraft:wooden_sword": { "amount": 1 },
    "minecraft:oak_door": { "amount": 1 },
    "minecraft:spruce_door": { "amount": 1 },
    "minecraft:birch_door": { "amount": 1 },
    "minecraft:jungle_door": { "amount": 1 },
    "minecraft:acacia_door": { "amount": 1 },
    "minecraft:dark_oak_door": { "amount": 1 },
    "minecraft:mangrove_door": { "amount": 1 },
    "minecraft:cherry_door": { "amount": 1 },
    "minecraft:stick": { "amount": 1 },
    "minecraft:oak_sapling": { "amount": 1 },
    "minecraft:spruce_sapling": { "amount": 1 },
    "minecraft:birch_sapling": { "amount": 1 },
    "minecraft:jungle_sapling": { "amount": 1 },
    "minecraft:acacia_sapling": { "amount": 1 },
    "minecraft:dark_oak_sapling": { "amount": 1 },
    "minecraft:mangrove_sapling": { "amount": 1 },
    "minecraft:cherry_sapling": { "amount": 1 },
    "minecraft:dead_bush": { "amount": 1 },
    "minecraft:bowl": { "amount": 1 },
    "minecraft:wooden_button": { "amount": 1 }
};

// ====== Smeltable Items ======
const smeltables = [
    { item: "minecraft:iron_ore", material: "iron", liquidYield: 1 },
    { item: "minecraft:gold_ore", material: "gold", liquidYield: 1 },
    { item: "minecraft:copper_ore", material: "copper", liquidYield: 1 },
    { item: "minecraft:deepslate_iron_ore", material: "iron", liquidYield: 1 },
    { item: "minecraft:deepslate_gold_ore", material: "gold", liquidYield: 1 },
    { item: "minecraft:deepslate_copper_ore", material: "copper", liquidYield: 1 },
    { item: "minecraft:raw_iron", material: "iron", liquidYield: 1 },
    { item: "minecraft:iron_ingot", material: "iron", liquidYield: 1 },
    { item: "minecraft:iron_block", material: "iron", liquidYield: 9 },
    { item: "minecraft:raw_iron_block", material: "iron", liquidYield: 9 },
    { item: "minecraft:raw_gold", material: "gold", liquidYield: 1 },
    { item: "minecraft:gold_ingot", material: "gold", liquidYield: 1 },
    { item: "minecraft:gold_block", material: "gold", liquidYield: 9 },
    { item: "minecraft:raw_gold_block", material: "gold", liquidYield: 9 },
    { item: "ftb_tc:raw_pig_iron", material: "pig_iron", liquidYield: 1 },
    { item: "ftb_tc:raw_pig_iron_block", material: "pig_iron", liquidYield: 9 },
    { item: "ftb_tc:pig_iron_ingot", material: "pig_iron", liquidYield: 1 },
    { item: "ftb_tc:pig_iron_block", material: "pig_iron", liquidYield: 9 },
    { item: "minecraft:raw_copper", material: "copper", liquidYield: 1 },
    { item: "minecraft:copper_ingot", material: "copper", liquidYield: 1 },
    { item: "minecraft:copper_block", material: "copper", liquidYield: 9 },
    { item: "minecraft:raw_copper_block", material: "copper", liquidYield: 9 },
    { item: "ftb_tc:raw_rose_gold", material: "rose_gold", liquidYield: 1 },
    { item: "ftb_tc:rose_gold_ingot", material: "rose_gold", liquidYield: 1 },
    { item: "ftb_tc:rose_gold_block", material: "rose_gold", liquidYield: 9 },
    { item: "ftb_tc:raw_rose_gold_block", material: "rose_gold", liquidYield: 9 },
    { item: "ftb_tc:tin_ore", material: "tin", liquidYield: 1 },
    { item: "ftb_tc:deepslate_tin_ore", material: "tin", liquidYield: 1 },
    { item: "ftb_tc:raw_tin", material: "tin", liquidYield: 1 },
    { item: "ftb_tc:tin_ingot", material: "tin", liquidYield: 1 },
    { item: "ftb_tc:tin_block", material: "tin", liquidYield: 9 },
    { item: "ftb_tc:raw_tin_block", material: "tin", liquidYield: 9 },
    { item: "ftb_tc:bronze_ingot", material: "bronze", liquidYield: 1 },
    { item: "ftb_tc:bronze_block", material: "bronze", liquidYield: 9 },
    { item: "ftb_tc:raw_bronze_block", material: "bronze", liquidYield: 9 },
    {
        item: "ftb_tc:bucket_iron",
        material: "iron",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:bucket_gold",
        material: "gold",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:bucket_copper",
        material: "copper",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:bucket_pig_iron",
        material: "pig_iron",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:bucket_rose_gold",
        material: "rose_gold",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:bucket_tin",
        material: "tin",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:bucket_bronze",
        material: "bronze",
        liquidYield: 9,
        returnItem: "minecraft:bucket",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:copper_can_iron",
        material: "iron",
        liquidYield: 2,
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:copper_can_gold",
        material: "gold",
        liquidYield: 2,
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:copper_can_copper",
        material: "copper",
        liquidYield: 2,
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:copper_can_pig_iron",
        material: "pig_iron",
        liquidYield: 2,
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:copper_can_rose_gold",
        material: "rose_gold",
        liquidYield: 2,
        returnItem: "ftb_tc:copper_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_iron",
        material: "iron",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_gold",
        material: "gold",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_pig_iron",
        material: "pig_iron",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_rose_gold",
        material: "rose_gold",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_copper",
        material: "copper",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_tin",
        material: "tin",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
    {
        item: "ftb_tc:iron_can_bronze",
        material: "bronze",
        liquidYield: 1,
        returnItem: "ftb_tc:iron_can_empty",
        sound: "bucket.empty_lava",
    },
];

// ====== Extraction Containers ======
const extractContainers = [
    {
        item: "ftb_tc:copper_can_empty",
        output: (material) => `ftb_tc:copper_can_${material}`,
        amount: 2,
        sound: "item.bottle.fill",
    },
    {
        item: "ftb_tc:iron_can_empty",
        output: (material) => `ftb_tc:iron_can_${material}`,
        amount: 1,
    },
    {
        item: "minecraft:bucket",
        output: (material) => `ftb_tc:bucket_${material}`,
        amount: 9,
        sound: "bucket.fill_lava",
    },
];

// ====== Helpers ======
function getMelterState(permutation) {
    return {
        fuel: permutation.getState("ftb_tc:fuel"),
        liquidStage: permutation.getState("ftb_tc:liquid_stage"),
        material: permutation.getState("ftb_tc:material"),
    };
}
function applyMelterState(block, state) {
    const updated = block.permutation
        .withState("ftb_tc:fuel", Math.max(0, Math.min(8, state.fuel)))
        .withState("ftb_tc:liquid_stage", Math.max(0, Math.min(10, state.liquidStage)))
        .withState("ftb_tc:material", state.material);
    block.setPermutation(updated);
}
function formatMaterialName(id) {
    if (id === "empty")
        return "None";
    return id
        .split("_")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}
function giveItemToPlayer(player, itemId, amount = 1) {
    if (!itemId || amount <= 0 || amount > 255)
        return;
    const item = new ItemStack(itemId, amount);
    const inventory = player.getComponent(EntityComponentTypes.Inventory);
    inventory?.container?.addItem(item);
}
function consumeItemFromMainHand(player, equipment, returnItem) {
    const item = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!item)
        return;
    const oldAmount = item.amount;
    if (oldAmount <= 1) {
        equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
    }
    else {
        const newItem = new ItemStack(item.typeId, oldAmount - 1);
        equipment.setEquipment(EquipmentSlot.Mainhand, newItem);
    }
    if (returnItem) {
        giveItemToPlayer(player, returnItem);
    }
}
function playSound(dimension, block, sound) {
    dimension.playSound(sound, {
        x: block.location.x + 0.5,
        y: block.location.y + 1,
        z: block.location.z + 0.5,
    });
}
function errorMessage(player, msg, dimension, block) {
    player.sendMessage(msg);
    playSound(dimension, block, "note.bass");
}
function getBlockLocationKey(block) {
    return `${block.location.x},${block.location.y},${block.location.z}`;
}

// ====== AutoState Tracking ======
const autoUpdateTrackers = new Map();
const sequenceTrackers = new Map();
const fuelTimers = new Map();
const autoUpdateStates = {};
const autoUpdateStatesSequence = {};

class MelterComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            const { player, block, dimension } = event;
            if (!block || !player)
                return;
            const equipment = player.getComponent(EntityComponentTypes.Equippable);
            const mainHand = equipment?.getEquipment(EquipmentSlot.Mainhand);
            const itemType = mainHand?.typeId?.toLowerCase() ?? "minecraft:air";
            const state = getMelterState(block.permutation);
            const blockKey = getBlockLocationKey(block);
            
            // === Status Check with Empty Hand
            if (!mainHand || itemType === "minecraft:air") {
                const mb = state.liquidStage * 100;
                const pretty = formatMaterialName(state.material);
                player.sendMessage(`§7Tank: §b${mb}mB§7 / 1000mB\nFuel: §e${state.fuel}/8\nMaterial: §a${pretty}`);
                playSound(dimension, block, config.interactSound);
                return;
            }
            
            // === Insert Fuel
            const fuel = fuelItems[itemType];
            if (fuel) {
                if (state.fuel >= 8) {
                    errorMessage(player, "Fuel is full. No more can be added.", dimension, block);
                    return;
                }
                state.fuel = Math.min(8, state.fuel + fuel.amount);
                applyMelterState(block, state);
                fuelTimers.set(blockKey, system.currentTick + 800); // reset fuel timer to 40 seconds
                consumeItemFromMainHand(player, equipment, fuel.returnItem);
                playSound(dimension, block, fuel.sound ?? config.defaultFuelSound);
                return;
            }
            
            // === Smelting
            for (const smelt of smeltables) {
                if (smelt.item === itemType) {
                    if (state.fuel <= 0) {
                        errorMessage(player, "No fuel. Try adding coal!", dimension, block);
                        return;
                    }
                    if (state.material !== "empty" && state.material !== smelt.material) {
                        errorMessage(player, `Melter already contains molten ${formatMaterialName(state.material)}.`, dimension, block);
                        return;
                    }
                    if (state.liquidStage + smelt.liquidYield > 10) {
                        errorMessage(player, "Not enough space for more molten metal.", dimension, block);
                        return;
                    }
                    state.liquidStage += smelt.liquidYield;
                    
                    // ✳ Apply fuel penalty based on yield amount
                    if (smelt.liquidYield >= 9) {
                        // Whole blocks consume 4 fuel points (half a lava bucket)
                        state.fuel = Math.max(0, state.fuel - 4);
                    } else if (smelt.liquidYield >= 2) {
                        // Medium yields consume 2 fuel points
                        state.fuel = Math.max(0, state.fuel - 2);
                    } else {
                        // Standard ores and ingots consume 1 fuel point
                        state.fuel = Math.max(0, state.fuel - 1);
                    }
                    
                    if (state.material === "empty")
                        state.material = smelt.material;
                    
                    applyMelterState(block, state);
                    consumeItemFromMainHand(player, equipment, smelt.returnItem);
                    playSound(dimension, block, smelt.sound ?? config.defaultSmeltSound);
                    return;
                }
            }
            
            // === Extraction
            for (const extract of extractContainers) {
                if (itemType === extract.item && state.material !== "empty") {
                    if (state.liquidStage >= extract.amount) {
                        const output = extract.output(state.material);
                        state.liquidStage -= extract.amount;
                        if (state.liquidStage <= 0)
                            state.material = "empty";
                        applyMelterState(block, state);
                        consumeItemFromMainHand(player, equipment);
                        giveItemToPlayer(player, output);
                        playSound(dimension, block, extract.sound ?? config.defaultExtractSound);
                    }
                    else {
                        errorMessage(player, `Not enough molten ${formatMaterialName(state.material)}. Need ${extract.amount * 100}mB.`, dimension, block);
                    }
                    return;
                }
            }
            
            // === Fallback
            if (state.fuel === 0) {
                errorMessage(player, "No fuel. Try adding coal!", dimension, block);
            }
            else {
                errorMessage(player, "That item isn't smeltable. Try raw ores.", dimension, block);
            }
        };
        
        this.onTick = (event) => {
            const { block, dimension } = event;
            const state = getMelterState(block.permutation);
            const blockKey = getBlockLocationKey(block);
            
            // Handle fuel decay every 40–50 seconds (approx 800–1000 ticks)
            const next = fuelTimers.get(blockKey);
            if (typeof next === "number" && system.currentTick >= next && state.fuel > 0) {
                state.fuel--;
                applyMelterState(block, state);
                fuelTimers.set(blockKey, system.currentTick + 800 + Math.floor(Math.random() * 200));
            }
            
            // Auto/sequence updates
            const stateKey = `${state.fuel},${state.liquidStage},${state.material}`;
            if (stateKey in autoUpdateStates) {
                const data = autoUpdateStates[stateKey];
                const timer = data.timer ?? defaultAutoUpdateTimer;
                const nextTick = autoUpdateTrackers.get(blockKey);
                if (nextTick === undefined) {
                    autoUpdateTrackers.set(blockKey, system.currentTick + timer);
                    return;
                }
                if (system.currentTick >= nextTick) {
                    applyMelterState(block, data.newState);
                    playSound(dimension, block, "fire.fire");
                    autoUpdateTrackers.set(blockKey, system.currentTick + timer);
                }
                return;
            }
            
            const seq = sequenceTrackers.get(blockKey);
            if (seq) {
                const data = autoUpdateStatesSequence[seq.sequenceId];
                if (!data || system.currentTick < seq.nextTick)
                    return;
                const step = data.sequence[seq.index];
                if (step) {
                    applyMelterState(block, step.state);
                    playSound(dimension, block, "fire.fire");
                    seq.index++;
                    if (seq.index >= data.sequence.length) {
                        if (data.loop)
                            seq.index = 0;
                        else
                            sequenceTrackers.delete(blockKey);
                    }
                    const next = data.sequence[seq.index];
                    seq.nextTick = system.currentTick + (next?.timer ?? defaultAutoUpdateTimer);
                    sequenceTrackers.set(blockKey, seq);
                }
                return;
            }
            
            if (stateKey in autoUpdateStatesSequence) {
                const data = autoUpdateStatesSequence[stateKey];
                sequenceTrackers.set(blockKey, {
                    sequenceId: stateKey,
                    index: 0,
                    nextTick: system.currentTick + data.initialTimer,
                });
            }
        };
    }
    
    handleInteraction(player, block, dimension) {
        this.onPlayerInteract({ player, block, dimension });
    }
}

// ====== Cleanup fuel + tracker cache ======
system.runInterval(() => {
    const dim = world.getDimension("overworld");
    // Clean up auto update trackers
    for (const [key] of autoUpdateTrackers) {
        const [x, y, z] = key.split(",").map(Number);
        const block = dim.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            autoUpdateTrackers.delete(key);
    }
    // Clean up sequence trackers
    for (const [key] of sequenceTrackers) {
        const [x, y, z] = key.split(",").map(Number);
        const block = dim.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            sequenceTrackers.delete(key);
    }
    // Clean up fuel timers
    for (const [key] of fuelTimers) {
        const [x, y, z] = key.split(",").map(Number);
        const block = dim.getBlock({ x, y, z });
        if (!block || block.typeId === "minecraft:air")
            fuelTimers.delete(key);
    }
}, 200);

// ====== Export ======
const melterLogic = new MelterComponent();

export { MelterComponent, melterLogic };