import { ItemStack } from '@minecraft/server';
import { smelteryFuelTypeFromId, SmelteryFuelType } from '../../recipes/types/smeltery.js';
import { sendTranslated, updateBucket } from '../../utils.js';
import { FluidHolderRecipes } from '../../recipes/recipes.js';
import { ItemUtils as y, BlockUtils as zt } from '../../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

class TankHandler {
    constructor(block) {
        this.block = block;
    }

    static create(block) {
        if (!block || block.typeId !== "ftb_tc:seared_tank") {
            throw new Error(`Invalid block type ${block.typeId} for TankHandler`);
        }
        return new TankHandler(block);
    }

    handleFluidInsertion(player, stack, fluidStorage, activeFluidType, currentFluidLevel) {
        if (!fluidStorage || !fluidStorage.seared_tank) {
            return;
        }

        // BULLETPROOFING 1: The 1.21 Component Fallback
        // If the item JSON is missing the fluid type, identify it by the Item ID!
        let rawBucketFluid = fluidStorage.fluid || "";
        const itemId = stack.typeId;
        
        if (itemId.includes("blaze")) rawBucketFluid = "blaze";
        else if (itemId.includes("lava")) rawBucketFluid = "lava";
        else if (itemId.includes("water")) rawBucketFluid = "water";

        // BULLETPROOFING 2: Strip namespaces to force exact matches
        const activeClean = String(activeFluidType).replace("ftb_tc:", "").replace("minecraft:", "");
        const storageClean = String(rawBucketFluid).replace("ftb_tc:", "").replace("minecraft:", "");

        const currentNum = Number(currentFluidLevel) || 0;
        const levelsToAdd = Number(this.getLevelsFromFluidAmount(fluidStorage.amount)) || 0;
        const newFluidLevel = currentNum + levelsToAdd;

        // Compare our cleaned strings
        if (activeClean === "empty" || activeClean === "0" || activeClean === "" || activeClean === storageClean) {
            
            if (newFluidLevel > TankHandler.MAX_LEVEL) {
                sendTranslated(player, "ftb_tc.seared_tank.info.too_much_fluid");
                return;
            }

            // If the tank was empty, officially set its block state to the new liquid
            if (activeClean === "empty" || activeClean === "0" || activeClean === "") {
                const stateToSet = storageClean === "blaze" ? "blaze" : 
                                   storageClean === "water" ? "water" : "lava";
                this.setTankFluidType(this.block, stateToSet);
            }
            
            this.setBlockFluidLevel(this.block, newFluidLevel);
            
            player.playSound("bucket.empty_lava", {
                location: this.block.location
            });
            
            const returnStack = new ItemStack(fluidStorage.return_item);
            updateBucket(player, stack, returnStack);
        }
    }

    handleFluidExtraction(player, stack, activeFluidType, currentFluidLevel) {
        const newStack = FluidHolderRecipes.getStack(stack, activeFluidType);
        
        if (!newStack || activeFluidType === SmelteryFuelType.EMPTY || activeFluidType === "empty") {
            return;
        }
        
        if (!y.isValid(newStack.return_item)) {
            return;
        }
        
        if (newStack.amount < 200) {
            sendTranslated(player, "ftb_tc.seared_tank.info.not_enough_space");
            return;
        }
        
        const currentNum = Number(currentFluidLevel) || 0;
        const newFluidLevel = currentNum - (Number(newStack.amount) / 200);
        
        if (newFluidLevel < 0) {
            sendTranslated(player, "ftb_tc.seared_tank.info.not_enough_fluid");
            return;
        }
        
        player.playSound("bucket.fill_lava", {
            location: this.block.location
        });
        
        updateBucket(player, stack, new ItemStack(newStack.return_item));
        
        this.setBlockFluidLevel(this.block, newFluidLevel);
        
        if (newFluidLevel === 0) {
            this.setTankFluidType(this.block, SmelteryFuelType.EMPTY);
        }
    }

    getLevelsFromFluidAmount(fluidAmount) {
        return Math.floor(Number(fluidAmount) / 200);
    }

    setBlockFluidLevel(tankBlock, level) {
        const numLevel = Number(level);
        if (numLevel === 0) {
            this.setTankFluidType(tankBlock, SmelteryFuelType.EMPTY);
        }
        const fluidLevel1 = Math.floor(numLevel / 10);
        const fluidLevel2 = numLevel % 10;
        zt.updateBlockState(tankBlock, TankHandler.PROPERTIES.FLUID_LEVEL_1, fluidLevel1);
        zt.updateBlockState(tankBlock, TankHandler.PROPERTIES.FLUID_LEVEL_2, fluidLevel2);
    }

    static getFluidLevels(level) {
        const numLevel = Number(level);
        const fluidLevel1 = Math.floor(numLevel / 10);
        const fluidLevel2 = numLevel % 10;
        return { level1: fluidLevel1, level2: fluidLevel2 };
    }

    getBlockFluidLevel() {
        const fluidLevel1 = zt.getBlockState(this.block.permutation, TankHandler.PROPERTIES.FLUID_LEVEL_1);
        const fluidLevel2 = zt.getBlockState(this.block.permutation, TankHandler.PROPERTIES.FLUID_LEVEL_2);
        
        if (fluidLevel1 === undefined || fluidLevel2 === undefined) {
            return undefined;
        }
        
        const stringValue = `${fluidLevel1}${fluidLevel2}`;
        return Number(stringValue);
    }

    getTankFluidType() {
        const fluidType = zt.getBlockState(this.block.permutation, TankHandler.PROPERTIES.FLUID_TYPE);
        
        if (fluidType === undefined || fluidType === "empty") {
            return SmelteryFuelType.EMPTY;
        }
        
        return fluidType;
    }

    setTankFluidType(tankBlock, fluidType) {
        zt.updateBlockState(tankBlock, TankHandler.PROPERTIES.FLUID_TYPE, fluidType);
    }
}

TankHandler.MAX_LEVEL = 20;
TankHandler.PROPERTIES = {
    FLUID_TYPE: "ftb_tc:fluid_type",
    FLUID_LEVEL_1: "ftb_tc:fluid_level_1",
    FLUID_LEVEL_2: "ftb_tc:fluid_level_2"
};

export { TankHandler };