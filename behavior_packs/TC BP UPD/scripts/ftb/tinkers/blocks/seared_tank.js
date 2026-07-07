import { world, system, ItemStack } from '@minecraft/server';
import { SmelteryFuelType } from '../recipes/types/smeltery.js';
import { FluidStorageRecipes } from '../recipes/recipes.js';
import { StringTransforms as Xt, PlayerUtils as R } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { TankHandler } from './handlers/seared_tank.js';
import { TCBlocks } from '../constants.js';

function normalizeTankFluidType(fluidType) {
    const id = String(fluidType || '').toLowerCase().trim();

    if (
        id === 'blaze' ||
        id === 'blaze_lava' ||
        id === 'blazing_blood' ||
        id === 'blazingblood' ||
        id.includes('blaze')
    ) {
        return 'blaze';
    }

    if (id === 'lava' || id.includes('lava')) {
        return 'lava';
    }

    if (id === 'water' || id.includes('water')) {
        return 'water';
    }

    if (id === 'empty' || id === 'none' || id === '') {
        return SmelteryFuelType.EMPTY;
    }

    return id;
}

function getFluidTypeFromObject(value) {
    if (!value) return null;

    if (typeof value === 'string') {
        return normalizeTankFluidType(value);
    }

    if (typeof value !== 'object') return null;

    const possibleKeys = [
        'fluidType',
        'fluid_type',
        'fluid',
        'type',
        'id',
        'name'
    ];

    for (const key of possibleKeys) {
        try {
            const found = getFluidTypeFromObject(value[key]);
            if (found) return found;
        } catch (e) {}
    }

    return null;
}

function normalizeFluidStorageComponent(fluidStorage) {
    if (!fluidStorage || typeof fluidStorage !== 'object') return fluidStorage;

    const possibleKeys = [
        'fluidType',
        'fluid_type',
        'fluid',
        'type',
        'id',
        'name'
    ];

    for (const key of possibleKeys) {
        try {
            if (typeof fluidStorage[key] === 'string') {
                fluidStorage[key] = normalizeTankFluidType(fluidStorage[key]);
            }
        } catch (e) {}
    }

    try {
        if (fluidStorage.fluid && typeof fluidStorage.fluid === 'object') {
            for (const key of possibleKeys) {
                if (typeof fluidStorage.fluid[key] === 'string') {
                    fluidStorage.fluid[key] = normalizeTankFluidType(fluidStorage.fluid[key]);
                }
            }
        }
    } catch (e) {}

    return fluidStorage;
}

function forceTankFluidState(block, fluidType) {
    const fixedFluidType = normalizeTankFluidType(fluidType);

    if (
        !block ||
        !fixedFluidType ||
        fixedFluidType === SmelteryFuelType.EMPTY ||
        fixedFluidType === 'empty'
    ) {
        return;
    }

    system.runTimeout(() => {
        try {
            const tankHandler = TankHandler.create(block);
            if (!tankHandler) return;

            const currentLevel = tankHandler.getBlockFluidLevel() || 0;
            if (currentLevel <= 0) return;

            const fluidLevels = TankHandler.getFluidLevels(currentLevel);

            block.setPermutation(
                block.permutation
                    .withState(TankHandler.PROPERTIES.FLUID_TYPE, fixedFluidType)
                    .withState(TankHandler.PROPERTIES.FLUID_LEVEL_1, fluidLevels?.level1 || 0)
                    .withState(TankHandler.PROPERTIES.FLUID_LEVEL_2, fluidLevels?.level2 || 0)
            );
        } catch (e) {
            console.warn(`Failed to force tank fluid state: ${e}`);
        }
    }, 1);
}

class SearedTankBlockComponent {
    onPlayerInteract(event) {
        const block = event.block;
        const player = event.player;
        const stack = R.getHeldItem(player);

        const tankHandler = TankHandler.create(block);
        if (!tankHandler) return;

        const activeFluidType = normalizeTankFluidType(tankHandler.getTankFluidType());
        const currentFluidLevel = tankHandler.getBlockFluidLevel() || 0;

        if (stack === undefined) {
            player.onScreenDisplay.setActionBar({
                text: `${currentFluidLevel * 200} / 4000 mB`
            });
            return;
        }

        let fluidStorage = FluidStorageRecipes.getComponentFromStack(stack);

        if (!fluidStorage) {
            tankHandler.handleFluidExtraction(
                player,
                stack,
                activeFluidType,
                currentFluidLevel
            );
            return;
        }

        const insertedFluidType = getFluidTypeFromObject(fluidStorage);

        fluidStorage = normalizeFluidStorageComponent(fluidStorage);

        tankHandler.handleFluidInsertion(
            player,
            stack,
            fluidStorage,
            activeFluidType,
            currentFluidLevel
        );

        if (insertedFluidType) {
            forceTankFluidState(block, insertedFluidType);
        }
    }

    beforeOnPlayerPlace(event) {
        const stack = R.getHeldItem(event.player);
        if (stack === undefined) return;

        const lore = stack.getLore();
        if (lore.length !== 2) return;

        const fluidType = normalizeTankFluidType(
            lore[0].replace('Fluid: ', '').toLowerCase()
        );

        const fluidLevel = Number(
            lore[1]
                .replace('Amount: ', '')
                .replace(' / 4000 mB', '')
        ) / 200;

        if (!fluidType || !Number.isFinite(fluidLevel)) return;

        const permutation = event.permutationToPlace;
        const fluidLevels = TankHandler.getFluidLevels(fluidLevel);

        event.permutationToPlace = permutation
            .withState(TankHandler.PROPERTIES.FLUID_TYPE, fluidType)
            .withState(TankHandler.PROPERTIES.FLUID_LEVEL_1, fluidLevels?.level1 || 0)
            .withState(TankHandler.PROPERTIES.FLUID_LEVEL_2, fluidLevels?.level2 || 0);
    }
}

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;

    if (block?.typeId !== TCBlocks.SEARED_TANK) {
        return;
    }

    const tankHandler = TankHandler.create(block);
    if (!tankHandler) {
        return;
    }

    const tankFluidType = normalizeTankFluidType(tankHandler.getTankFluidType());

    if (tankFluidType === SmelteryFuelType.EMPTY || tankFluidType === 'empty') {
        return;
    }

    event.cancel = true;

    system.runTimeout(() => {
        const tankStack = new ItemStack('ftb_tc:seared_tank');

        tankStack.setLore([
            `Fluid: ${Xt.capitalize(tankFluidType)}`,
            `Amount: ${tankHandler.getBlockFluidLevel() * 200} / 4000 mB`
        ]);

        block.setType('minecraft:air');
        block.dimension.spawnItem(tankStack, block.location);
    }, 0);
});

export { SearedTankBlockComponent };