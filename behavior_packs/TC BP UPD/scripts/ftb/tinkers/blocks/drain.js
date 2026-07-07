import { ItemStack } from '@minecraft/server';
import { sendTranslated, updateBucket } from '../utils.js';
import { isBlockPartOfSmeltery } from '../smeltery.js';
import { FluidHolderRecipes } from '../recipes/recipes.js';
import { BlockUtils as zt, tc as Ot, PlayerUtils as R, ItemUtils as y } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { SmelteryHandler } from './handlers/smeltery.js';
import { TCBlocks } from '../constants.js';

class SearedDrainBlockComponent {
    constructor() {
        this.onTick = (event, parameters) => {
            const block = event.block;
            const drainHandler = new DrainHandler(block);
            const state = zt.getBlockState(block.permutation, Ot("is_built"));
            const newState = drainHandler.hasValidSmeltery();
            if (state !== newState) {
                zt.updateBlockState(block, Ot("is_built"), newState);
            }
        };
    }
    onPlayerInteract(event, parameters) {
        const block = event.block;
        const player = event.player;
        const stack = R.getHeldItem(event.player);
        if (!stack) {
            return;
        }
        const drainHandler = new DrainHandler(block);
        const smelteryBlock = drainHandler.getSmelteryController();
        if (!smelteryBlock) {
            sendTranslated(player, "ftb_tc.drain.info.no_smeltery");
            return;
        }
        const smelteryHandler = SmelteryHandler.tryGet(smelteryBlock);
        if (!smelteryHandler) {
            sendTranslated(player, "ftb_tc.smeltery.info.no_entity");
            return;
        }
        if (!smelteryHandler.isBuilt()) {
            sendTranslated(player, "ftb_tc.smeltery.info.not_built");
            return;
        }
        const materialInSmelter = smelteryHandler.getMaterial();
        if (!materialInSmelter) {
            sendTranslated(player, "ftb_tc.drain.no_material");
            return;
        }
        const newStack = FluidHolderRecipes.getStackFromMaterial(stack, materialInSmelter);
        if (!newStack) {
            sendTranslated(player, "ftb_tc.seared_tank.info.not_valid_item");
            return;
        }
        // Check if the returned item is valid, This happens when the fluid holder can't hold fluid given
        if (!y.isValid(newStack.return_item)) {
            return;
        }
        const currentFluidLevel = smelteryHandler.getFluidLevel(materialInSmelter);
        const levelsToRemove = newStack.amount / 100;
        const newFluidLevel = currentFluidLevel - levelsToRemove;
        if (newFluidLevel < 0) {
            sendTranslated(player, "ftb_tc.seared_tank.info.not_enough_fluid");
            return;
        }
        player.playSound("bucket.fill_lava", {
            location: block.location
        });
        updateBucket(player, stack, new ItemStack(newStack.return_item));
        smelteryHandler.decreesFluidLevel(materialInSmelter, levelsToRemove);
    }
}
class DrainHandler {
    constructor(block) {
        this.block = block;
    }
    getSmelteryController() {
        let foundSmelters;
        // Chunk may be unloaded
        try {
            foundSmelters = zt.getBlocksInRange(this.block, 8, true, {
                includeTypes: [TCBlocks.SMELTERY_CONTROLLER]
            });
        }
        catch (e) {
            return undefined;
        }
        let smelteryBlock = undefined;
        for (const foundSmelter of foundSmelters) {
            const currentBlock = this.block.dimension.getBlock(foundSmelter);
            if (isBlockPartOfSmeltery(currentBlock, this.block.location)) {
                smelteryBlock = currentBlock;
            }
        }
        return smelteryBlock;
    }
    hasValidSmeltery() {
        const smelteryController = this.getSmelteryController();
        if (!smelteryController) {
            return false;
        }
        const smelteryHandler = SmelteryHandler.tryGet(smelteryController);
        return !(!smelteryHandler || !smelteryHandler.isBuilt());
    }
}

export { DrainHandler, SearedDrainBlockComponent };
