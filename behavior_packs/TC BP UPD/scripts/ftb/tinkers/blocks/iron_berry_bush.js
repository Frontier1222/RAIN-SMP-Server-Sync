import { EntityComponentTypes, EquipmentSlot, system, EntityDamageCause, ItemStack, world } from '@minecraft/server';
import { ItemUtils as y } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

// ========== CONFIG ==========
const autoUpdateStates = {
    0: {
        newState: 1,
        minTicks: 600,
        maxTicks: 1200,
    },
    1: {
        newState: 2,
        minTicks: 1200,
        maxTicks: 2400,
    },
    2: {
        newState: 3,
        minTicks: 2400,
        maxTicks: 3600,
    },
};
const stateProgression = [
    {
        condition: 0,
        item: "minecraft:bone_meal",
        newState: 1,
        returnItem: null,
        sound: "item.bone_meal.use",
        particles: ["minecraft:crop_growth_emitter"],
    },
    {
        condition: 1,
        item: "minecraft:bone_meal",
        newState: 2,
        returnItem: null,
        sound: "item.bone_meal.use",
        particles: ["minecraft:crop_growth_emitter"],
    },
    {
        condition: 2,
        item: "minecraft:bone_meal",
        newState: 3,
        returnItem: null,
        sound: "item.bone_meal.use",
        particles: ["minecraft:crop_growth_emitter"],
    },
    {
        condition: 2,
        item: null,
        newState: 1,
        returnItem: null,
        sound: "random.pop",
        lootTable: "ftb/tinkers/berries/iron_berry_half",
    },
    {
        condition: 3,
        item: null, // empty hand to harvest
        newState: 1,
        returnItem: null,
        sound: "random.pop",
        lootTable: "ftb/tinkers/berries/iron_berry_full",
    },
    {
        condition: 3,
        item: "minecraft:bone_meal",
        newState: 2,
        returnItem: null,
        sound: "item.bone_meal.use",
        particles: ["minecraft:crop_growth_emitter"],
        lootTable: "ftb/tinkers/berries/iron_berry_full",
    },
];
const bushDamageSettings = {
    damage: 1, // half a heart
    interval: 10, // every 10 ticks
    sound: "damage.thorns",
    particles: ["minecraft:crit_particle"],
};
// ========== TIMERS ==========
const growthTimers = new Map();
// ========== COMPONENT ==========
class IronBerryBushComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            if (!event.player || !event.block)
                return;
            const block = event.block;
            const currentPermutation = block.permutation;
            const currentStage = currentPermutation.getState("ftb_tc:grow_stage");
            const equipment = event.player.getComponent(EntityComponentTypes.Equippable);
            const mainHand = equipment?.getEquipment(EquipmentSlot.Mainhand);
            const itemType = mainHand ? mainHand.typeId : null;
            for (const step of stateProgression) {
                if (step.condition === currentStage &&
                    (step.item === itemType || step.item === null)) {
                    const updatedPermutation = currentPermutation.withState("ftb_tc:grow_stage", step.newState);
                    block.setPermutation(updatedPermutation);
                    if (step.sound) {
                        block.dimension.playSound(step.sound, {
                            x: block.location.x + 0.5,
                            y: block.location.y + 1,
                            z: block.location.z + 0.5,
                        });
                    }
                    if (step.particles?.length) {
                        for (const particle of step.particles) {
                            block.dimension.spawnParticle(particle, {
                                x: block.location.x + 0.5,
                                y: block.location.y + 1,
                                z: block.location.z + 0.5,
                            });
                        }
                    }
                    if (step.lootTable) {
                        runLootTableAt(event.player, step.lootTable, block.location);
                    }
                    if (step.returnItem) {
                        giveItemToPlayer(event.player, step.returnItem, 1);
                    }
                    if (step.item && mainHand) {
                        equipment.setEquipment(EquipmentSlot.Mainhand, y.shrinkItemStack(mainHand));
                    }
                    return;
                }
            }
            block.dimension.playSound("vr.stutterturn", {
                x: block.location.x + 0.5,
                y: block.location.y + 1,
                z: block.location.z + 0.5,
            });
        };
        this.onTick = (event) => {
            const block = event.block;
            const currentPermutation = block.permutation;
            const currentStage = currentPermutation.getState("ftb_tc:grow_stage");
            const stageInfo = autoUpdateStates[currentStage];
            const blockKey = `${block.location.x},${block.location.y},${block.location.z}`;
            // === Auto-grow logic ===
            if (stageInfo) {
                if (!growthTimers.has(blockKey)) {
                    const delay = getRandomInt(stageInfo.minTicks, stageInfo.maxTicks);
                    growthTimers.set(blockKey, system.currentTick + delay);
                }
                else {
                    const growAtTick = growthTimers.get(blockKey);
                    if (system.currentTick >= growAtTick) {
                        const updatedPermutation = currentPermutation.withState("ftb_tc:grow_stage", stageInfo.newState);
                        block.setPermutation(updatedPermutation);
                        if (stageInfo.sound) {
                            block.dimension.playSound(stageInfo.sound, {
                                x: block.location.x + 0.5,
                                y: block.location.y + 1,
                                z: block.location.z + 0.5,
                            });
                        }
                        if (stageInfo.particles?.length) {
                            for (const particle of stageInfo.particles) {
                                block.dimension.spawnParticle(particle, {
                                    x: block.location.x + 0.5,
                                    y: block.location.y + 1,
                                    z: block.location.z + 0.5,
                                });
                            }
                        }
                        if (stageInfo.lootTable) {
                            runLootTableAt(undefined, stageInfo.lootTable, block.location);
                        }
                        growthTimers.delete(blockKey);
                    }
                }
            }
            // === Bush contact damage ===
            if (system.currentTick % bushDamageSettings.interval === 0) {
                if (currentStage < 1)
                    return;
                const players = block.dimension.getPlayers({
                    location: block.location,
                    maxDistance: 1,
                });
                for (const player of players) {
                    const loc = player.location;
                    if (Math.floor(loc.x) === block.location.x &&
                        Math.floor(loc.y) === block.location.y &&
                        Math.floor(loc.z) === block.location.z) {
                        try {
                            player.applyDamage(bushDamageSettings.damage, {
                                cause: EntityDamageCause.contact,
                            });
                            if (bushDamageSettings.sound) {
                                block.dimension.playSound(bushDamageSettings.sound, {
                                    x: loc.x,
                                    y: loc.y + 1,
                                    z: loc.z,
                                });
                            }
                            if (bushDamageSettings.particles?.length) {
                                for (const particle of bushDamageSettings.particles) {
                                    block.dimension.spawnParticle(particle, {
                                        x: loc.x,
                                        y: loc.y + 1,
                                        z: loc.z,
                                    });
                                }
                            }
                            player.addEffect("slowness", 20, {
                                amplifier: 0, // Slowness I
                                showParticles: false,
                            });
                        }
                        catch (e) {
                            console.warn(`[IronBerryBush] Failed to damage player:`, e);
                        }
                    }
                }
            }
        };
    }
}
// ========== HELPERS ==========
function giveItemToPlayer(player, itemId, amount = 1) {
    const item = new ItemStack(itemId, amount);
    const inventoryComponent = player.getComponent(EntityComponentTypes.Inventory);
    if (inventoryComponent?.container) {
        inventoryComponent.container.addItem(item);
    }
}
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function runLootTableAt(player, lootTable, location) {
    const cmd = `loot spawn ~ ~ ~ loot "${lootTable}"`;
    const execCmd = `execute positioned ${location.x} ${location.y} ${location.z} run ${cmd}`;
    try {
        if (player) {
            player.runCommand(execCmd);
        }
        else {
            system.run(() => {
                world.getDimension("overworld").runCommand(execCmd);
            });
        }
    }
    catch (err) {
        console.warn(`[IronBerryBush] Failed to run loot table '${lootTable}':`, err);
    }
}

export { IronBerryBushComponent };
