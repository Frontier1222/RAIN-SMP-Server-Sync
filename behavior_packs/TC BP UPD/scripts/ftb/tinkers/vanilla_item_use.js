import {
    BlockPermutation,
    EntityComponentTypes,
    EquipmentSlot,
    GameMode,
    world,
    system,
} from '@minecraft/server';

const SLIME_GRASS = new Map([
    ["ftb_tc:earth_grass", { dirt: "ftb_tc:earth_dirt", tallGrass: "ftb_tc:earth_tall_grass" }],
    ["ftb_tc:ender_grass", { dirt: "ftb_tc:ender_dirt", tallGrass: "ftb_tc:ender_tall_grass" }],
    ["ftb_tc:ichor_grass", { dirt: "ftb_tc:ichor_dirt" }],
    ["ftb_tc:scarlet_grass", { dirt: "ftb_tc:scarlet_dirt", tallGrass: "ftb_tc:scarlet_tall_grass" }],
    ["ftb_tc:sky_grass", { dirt: "ftb_tc:sky_dirt", tallGrass: "ftb_tc:sky_tall_grass" }],
]);
const lastFertilizedTick = new Map();

function consumeBoneMeal(player) {
    if (player.getGameMode() === GameMode.Creative) return;

    const equippable = player.getComponent(EntityComponentTypes.Equippable);
    const stack = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!stack || stack.typeId !== "minecraft:bone_meal") return;

    if (stack.amount <= 1) {
        equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
    } else {
        stack.amount -= 1;
        equippable.setEquipment(EquipmentSlot.Mainhand, stack);
    }
}

function fertilizeSlimeGrass(player, dimension, location, grassType, config) {
    try {
        if (!player?.isValid) return;

        const source = dimension.getBlock(location);
        if (!source || source.typeId !== grassType) return;

        const candidates = [];
        for (let x = -3; x <= 3; x++) {
            for (let z = -3; z <= 3; z++) {
                if (x === 0 && z === 0) continue;
                if ((x * x) + (z * z) > 10) continue;

                for (let y = -1; y <= 1; y++) {
                    const dirt = dimension.getBlock({
                        x: location.x + x,
                        y: location.y + y,
                        z: location.z + z,
                    });
                    if (!dirt || (dirt.typeId !== "minecraft:dirt" && dirt.typeId !== config.dirt)) continue;
                    if (!dirt.above()?.isAir) continue;
                    candidates.push(dirt);
                    break;
                }
            }
        }

        candidates.sort(() => Math.random() - 0.5);
        let changed = 0;
        for (const dirt of candidates.slice(0, 12)) {
            try {
                dirt.setPermutation(BlockPermutation.resolve(grassType));
                changed++;
            } catch {}
        }

        const above = source.above();
        if (config.tallGrass && above?.isAir) {
            above.setPermutation(BlockPermutation.resolve(config.tallGrass));
            changed++;
        }

        if (changed === 0) return;

        consumeBoneMeal(player);
        const effectLocation = {
            x: location.x + 0.5,
            y: location.y + 1,
            z: location.z + 0.5,
        };
        dimension.playSound("item.bone_meal.use", effectLocation);
        dimension.spawnParticle("minecraft:crop_growth_emitter", effectLocation);
    } catch (error) {
        console.warn(`[Tinkers slime grass] Bone meal interaction failed: ${error}`);
    }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.itemStack?.typeId !== "minecraft:bone_meal") return;

    const grassType = event.block?.typeId;
    const config = SLIME_GRASS.get(grassType);
    if (!config) return;

    const player = event.player;
    const previousTick = lastFertilizedTick.get(player.id) ?? -100;
    if (system.currentTick - previousTick < 5) {
        event.cancel = true;
        return;
    }

    lastFertilizedTick.set(player.id, system.currentTick);
    event.cancel = true;
    const dimension = event.block.dimension;
    const location = { ...event.block.location };
    system.run(() => fertilizeSlimeGrass(player, dimension, location, grassType, config));
});
