import { EntityComponentTypes, EquipmentSlot, BlockPermutation } from '@minecraft/server';

// Full bush -> base bush
const bushTransformMap = {
    "ftb_tc:copper_berry_bush_full": "ftb_tc:copper_berry_bush",
    "ftb_tc:iron_berry_bush_full": "ftb_tc:iron_berry_bush",
    "ftb_tc:gold_berry_bush_full": "ftb_tc:gold_berry_bush",
    "ftb_tc:diamond_berry_bush_full": "ftb_tc:diamond_berry_bush",
    "ftb_tc:emerald_berry_bush_full": "ftb_tc:emerald_berry_bush",
    "ftb_tc:xp_berry_bush_full": "ftb_tc:xp_berry_bush",
};
// Full bush -> loot table ID
const lootTableMap = {
    "ftb_tc:copper_berry_bush_full": "ftb/tinkers/berries/copper_berry_full",
    "ftb_tc:iron_berry_bush_full": "ftb/tinkers/berries/iron_berry_full",
    "ftb_tc:gold_berry_bush_full": "ftb/tinkers/berries/gold_berry_full",
    "ftb_tc:diamond_berry_bush_full": "ftb/tinkers/berries/diamond_berry_full",
    "ftb_tc:emerald_berry_bush_full": "ftb/tinkers/berries/emerald_berry_full",
    "ftb_tc:xp_berry_bush_full": "ftb/tinkers/berries/xp_berry_full",
};
class FullBerryBushComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            const player = event.player;
            const block = event.block;
            if (!player || !block)
                return;
            const fullBushId = block.typeId;
            const baseBushId = bushTransformMap[fullBushId];
            const lootTableId = lootTableMap[fullBushId];
            if (!baseBushId || !lootTableId)
                return;
            const equipment = player.getComponent(EntityComponentTypes.Equippable);
            const item = equipment?.getEquipment(EquipmentSlot.Mainhand);
            const isBoneMeal = item?.typeId === "minecraft:bone_meal";
            const growStage = isBoneMeal ? 2 : 1;
            try {
                // === Replace block ===
                const newPerm = BlockPermutation.resolve(baseBushId, {
                    "ftb_tc:grow_stage": growStage,
                });
                block.setPermutation(newPerm);
                // === Sound ===
                block.dimension.playSound(isBoneMeal ? "item.bone_meal.use" : "random.pop", {
                    x: block.location.x + 0.5,
                    y: block.location.y + 0.5,
                    z: block.location.z + 0.5,
                });
                // === Particle ===
                if (isBoneMeal) {
                    block.dimension.spawnParticle("minecraft:crop_growth_emitter", {
                        x: block.location.x + 0.5,
                        y: block.location.y + 1,
                        z: block.location.z + 0.5,
                    });
                }
                // === Spawn loot ===
                runLootTableAt(player, lootTableId, block.location);
                // === Consume bone meal ===
                if (isBoneMeal) {
                    const inventory = player.getComponent(EntityComponentTypes.Inventory);
                    const container = inventory?.container;
                    if (container) {
                        for (let i = 0; i < container.size; i++) {
                            const stack = container.getItem(i);
                            if (stack && stack.typeId === "minecraft:bone_meal") {
                                stack.amount--;
                                if (stack.amount <= 0) {
                                    container.setItem(i, undefined);
                                }
                                else {
                                    container.setItem(i, stack);
                                }
                                break;
                            }
                        }
                    }
                }
            }
            catch (err) {
                console.warn(`[FullBerryBushComponent] Failed to transform bush: ${err}`);
            }
        };
    }
}
// === Loot Table Helper ===
function runLootTableAt(player, lootTable, location) {
    const cmd = `loot spawn ~ ~ ~ loot "${lootTable}"`;
    const execCmd = `execute positioned ${location.x} ${location.y} ${location.z} run ${cmd}`;
    try {
        player.runCommand(execCmd);
    }
    catch (err) {
        console.warn(`[berryBush] Loot command failed: ${err}`);
    }
}

export { FullBerryBushComponent };
