import { ItemStack } from '@minecraft/server';
import { SmelteryFuelType } from '../../recipes/types/smeltery.js';
import { SmelteryMaterials, SmelteryRecipes } from '../../recipes/recipes.js';
import { findBlockInSmeltery, getMissingBlocks } from '../../smeltery.js';
import { MelterLikeHandler } from './smeltery_type.js';
import { TankHandler } from './seared_tank.js';
import { TCBlocks } from '../../constants.js';
import { PlayerUtils as R, ItemUtils as y, tc as Ot } from '../../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { updateBucket } from '../../utils.js';

class SmelteryHandler extends MelterLikeHandler {
    constructor(block, smelteryEntity) {
        super();
        this.block = block;
        this.smelteryEntity = smelteryEntity;
    }
    static tryGet(block) {
        const smelteryEntity = SmelteryHandler.getSmelteryEntity(block);
        if (smelteryEntity === undefined) {
            return undefined;
        }
        return new SmelteryHandler(block, smelteryEntity);
    }
    removeFuelAmount(tanks, fluidType, amount) {
        let amountLeftToRemove = amount;
        for (const tank of tanks) {
            const tankHandler = TankHandler.create(tank);
            const currentFluidType = tankHandler.getTankFluidType();
            if (currentFluidType !== fluidType) {
                continue;
            }
            const currentLevel = tankHandler.getBlockFluidLevel();
            if (currentLevel === undefined) {
                continue;
            }
            if (currentLevel <= amountLeftToRemove) {
                tankHandler.setBlockFluidLevel(tank, 0);
                amountLeftToRemove -= currentLevel;
            }
            else {
                const newLevel = currentLevel - amountLeftToRemove;
                tankHandler.setBlockFluidLevel(tank, newLevel);
                amountLeftToRemove = 0;
            }
        }
    }
    getTanks() {
        return findBlockInSmeltery(this.block, [TCBlocks.SEARED_TANK]);
    }
    getTankLevels(tankBlock) {
        const levels = new Map();
        for (const block of tankBlock) {
            const tankHandler = TankHandler.create(block);
            const fluidType = tankHandler.getTankFluidType();
            if (fluidType === undefined) {
                continue;
            }
            const level = tankHandler.getBlockFluidLevel();
            if (level === undefined) {
                continue;
            }
            if (!levels[fluidType]) {
                levels[fluidType] = 0;
            }
            levels[fluidType] += level;
        }
        return levels;
    }
    getMaterial() {
        let activeMaterial = undefined;
        for (const material of SmelteryMaterials.materials) {
            const materialState = SmelteryHandler.PROPERTIES.MATERIAL_STATE + material.id;
            const dynamicProperty = this.smelteryEntity.getProperty(materialState);
            if (dynamicProperty !== undefined && dynamicProperty !== 0) {
                activeMaterial = material;
                break;
            }
        }
        return activeMaterial;
    }
    getMaxFluidLevel() {
        return SmelteryHandler.MAX_LEVEL;
    }
    isBuilt() {
        return this.smelteryEntity.getProperty(SmelteryHandler.PROPERTIES.FORMED) === true;
    }
    getFluidLevel(materialType) {
        const level = this.smelteryEntity.getProperty(SmelteryHandler.PROPERTIES.MATERIAL_STATE + materialType.id) || 0;
        return level;
    }
    setFluidLevel(materialType, level) {
        this.smelteryEntity.setProperty(SmelteryHandler.PROPERTIES.MATERIAL_STATE + materialType.id, level);
    }
    setMaterial(materialType) {
        this.smelteryEntity.setProperty(SmelteryHandler.PROPERTIES.MATERIAL, materialType.materialList);
    }
    getNotBuiltMessage() {
        const missingBlocks = getMissingBlocks(this.block);
        if (missingBlocks.size === 0 || missingBlocks.has(TCBlocks.SMELTERY_CONTROLLER)) {
            // How did you even get here?
            return "ftb_tc.smeltery.info.not_built";
        }
        if (missingBlocks.has("ftb_tc:seared_tank")) {
            return "ftb_tc.smeltery.info.no_tank";
        }
        if (missingBlocks.has("ftb_tc:seared_drain")) {
            return "ftb_tc.smeltery.info.no_drain";
        }
        // If missing others blocks, return a generic message
        return "ftb_tc.smeltery.info.not_complete";
    }
    tryToSmeltItem(player, stack, activeMaterial = this.getMaterial(), tanks = this.getTanks()) {
        const recipe = SmelteryRecipes.fromInput(stack?.typeId);
        if (!recipe) {
            return "ftb_tc.smeltery.info.no_recipe";
        }
        // If it is not a player trying to smelt, we can't allow items like buckets to be smelted
        if (player === undefined && recipe.returnItem !== undefined) {
            return undefined;
        }
        if (activeMaterial === undefined || (recipe.outputType === activeMaterial)) {
            const levelNumber = this.getFluidLevel(recipe.outputType);
            if (levelNumber + recipe.outputAmount > SmelteryHandler.MAX_LEVEL) {
                return "ftb_tc.smeltery.info.too_much";
            }
            if (recipe.useFuel) {
                recipe.outputType.fuelType;
                const fluidLevels = this.getTankLevels(tanks);
                const amountOfFluidLeft = fluidLevels[recipe.outputType.fuelType] ?? 0;
                const fluidToUse = new Map();
                fluidToUse[recipe.outputType.fuelType] = recipe.outputAmount;
                if (amountOfFluidLeft === undefined || amountOfFluidLeft <= 0) {
                    if (recipe.outputType.fuelType === SmelteryFuelType.LAVA) {
                        if (fluidLevels[SmelteryFuelType.BLAZE] === undefined || fluidLevels[SmelteryFuelType.BLAZE] <= 0) {
                            return "ftb_tc.smeltery.info.no_fuel";
                        }
                    }
                    else {
                        return "ftb_tc.smeltery.info.no_fuel";
                    }
                }
                if (amountOfFluidLeft < SmelteryHandler.FUEL_COST) {
                    if (recipe.outputType.fuelType === SmelteryFuelType.LAVA) {
                        const blazeLeft = fluidLevels[SmelteryFuelType.BLAZE];
                        const fuelNeeded = SmelteryHandler.FUEL_COST - amountOfFluidLeft;
                        if (blazeLeft === undefined || blazeLeft < fuelNeeded) {
                            return "ftb_tc.smeltery.info.not_enough_fuel";
                        }
                        fluidToUse[SmelteryFuelType.BLAZE] = fuelNeeded;
                        fluidToUse[SmelteryFuelType.LAVA] = amountOfFluidLeft;
                    }
                    else {
                        return "ftb_tc.smeltery.info.not_enough_fuel";
                    }
                }
                for (const fluidType in fluidToUse) {
                    const fluidTypeKey = fluidType;
                    fluidToUse[fluidType];
                    this.removeFuelAmount(tanks, fluidTypeKey, 1);
                }
            }
            if (player) {
                player.playSound(recipe.sound, {
                    location: this.block.location,
                    volume: 1,
                    pitch: 1
                });
                if (recipe.returnItem) {
                    updateBucket(player, stack, new ItemStack(recipe.returnItem));
                }
                else {
                    R.overrideHeldItem(player, y.shrinkItemStack((stack)));
                }
            }
            this.setFluidLevel(recipe.outputType, levelNumber + recipe.outputAmount);
            if (activeMaterial === undefined) {
                this.setMaterial(recipe.outputType);
            }
        }
        else if (activeMaterial != undefined) {
            return "ftb_tc.smeltery.info.wrong_material";
        }
    }
    static getSmelteryEntity(block) {
        const entitiesAtBlockLocation = block.dimension.getEntitiesAtBlockLocation(block.location);
        const smelteryEntity = entitiesAtBlockLocation
            .filter(value => value?.typeId === TCBlocks.SMELTERY_CONTROLLER)[0];
        if (smelteryEntity === undefined) {
            return undefined;
        }
        return smelteryEntity;
    }
}
SmelteryHandler.MAX_LEVEL = 40;
SmelteryHandler.FUEL_COST = 1;
SmelteryHandler.PROPERTIES = {
    MATERIAL_STATE: Ot("molten_"),
    MATERIAL: Ot("material_list"),
    FORMED: Ot("built")
};

export { SmelteryHandler };
