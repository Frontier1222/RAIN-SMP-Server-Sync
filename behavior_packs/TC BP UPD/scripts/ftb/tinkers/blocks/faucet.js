import { system } from '@minecraft/server';
import { sendTranslated } from '../utils.js';
import { FaucetBasinRecipes, SmelteryMaterials, FaucetTableRecipes } from '../recipes/recipes.js';
import { StringTransforms as Xt, BlockUtils as zt, tc as Ot } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { FlowState, FaucetHandler } from './handlers/faucet.js';
import { DrainHandler } from './drain.js';
import { SmelteryHandler } from './handlers/smeltery.js';
import { MelterHandler } from './handlers/melter.js';
import { TCBlocks } from '../constants.js';
import { MinecraftBlockTypes } from '../minecraft_vanilla_data.js';

class FaucetBlockComponent {
    constructor() {
        this.onPlayerInteract = (event, parameters) => {
            const block = event.block;
            const player = event.player;
            const blockUnder = block.below(1);
            const blockundertype = BLOCK_UNDER_TYPES[blockUnder?.typeId];
            if (!blockUnder || blockundertype === undefined) {
                sendTranslated(player, "ftb_tc.faucet.no_block_below");
                return;
            }
            const handler = createFaucetHandler(block, player);
            if (!handler) {
                return;
            }
            if (handler.getFlowState() !== FlowState.OFF) {
                sendTranslated(player, "ftb_tc.faucet.already_active");
                return;
            }
            const materialInSmelter = handler.getMaterialInSmelter();
            if (!materialInSmelter) {
                sendTranslated(player, "ftb_tc.drain.no_material");
                return;
            }
            blockundertype.onAction(blockUnder, handler, player);
        };
        this.onTick = (event, parameters) => {
            const block = event.block;
            const blockAbove = block.above(1);
            if (blockAbove?.typeId !== MinecraftBlockTypes.Lever) {
                return;
            }
            if (blockAbove.getRedstonePower() === 0) {
                return;
            }
            const blockUnder = block.below(1);
            const blockundertype = BLOCK_UNDER_TYPES[blockUnder?.typeId];
            if (!blockUnder || blockundertype === undefined) {
                return;
            }
            const handler = createFaucetHandler(block, undefined);
            if (!handler) {
                return;
            }
            if (handler.getFlowState() !== FlowState.OFF) {
                return;
            }
            const materialInSmelter = handler.getMaterialInSmelter();
            if (!materialInSmelter) {
                return;
            }
            blockundertype.onAction(blockUnder, handler, undefined);
        };
    }
}
function createFaucetHandler(block, player) {
    const direction = Xt.capitalize(zt.getBlockState(block.permutation, "minecraft:cardinal_direction"));
    const blockFromDirection = zt.getBlockFromDirection(block, direction);
    if (!blockFromDirection) {
        return undefined;
    }
    const connection = FAUCET_CONNECTIONS[blockFromDirection.typeId];
    if (!connection) {
        return undefined;
    }
    const smelteryHandler = connection.connect(blockFromDirection);
    if (typeof smelteryHandler === "string") {
        if (player) {
            sendTranslated(player, smelteryHandler);
        }
        return undefined;
    }
    return FaucetHandler.create(block, smelteryHandler);
}
class DrainConnection {
    connect(block) {
        const drainHandler = new DrainHandler(block);
        const smelteryController = drainHandler.getSmelteryController();
        if (!smelteryController) {
            return "ftb_tc.drain.info.no_smeltery";
        }
        const smelteryHandler = SmelteryHandler.tryGet(smelteryController);
        if (!smelteryHandler || !smelteryHandler.isBuilt()) {
            return "ftb_tc.drain.info.no_smeltery";
        }
        return smelteryHandler;
    }
}
class MelterConnection {
    connect(block) {
        return MelterHandler.create(block);
    }
}
class MelterProxyConnection {
    connect(block) {
        const blockUnder = block.below(1);
        if (!blockUnder || blockUnder.typeId !== TCBlocks.MELTER) {
            return "ftb_tc.melter.no_melter_below";
        }
        return MelterHandler.create(blockUnder);
    }
}
class CastingBasinBlockUnderType {
    constructor() {
        this.onAction = (block, faucetHandler, player) => {
            const materialInSmelter = faucetHandler.getMaterialInSmelter();
            if (!materialInSmelter) {
                if (player) {
                    sendTranslated(player, "ftb_tc.drain.no_material");
                }
                return;
            }
            const number = this.getCastingBasinCurrentId(block);
            const recipe = FaucetBasinRecipes.getRecipe(materialInSmelter, number);
            if (!recipe) {
                if (player) {
                    sendTranslated(player, "ftb_tc.faucet.no_recipe");
                }
                return;
            }
            const amountInSmelter = faucetHandler.getAmountInSmelter(materialInSmelter);
            if (amountInSmelter === undefined || amountInSmelter < 9) {
                if (player) {
                    sendTranslated(player, "ftb_tc.faucet.not_enough_material");
                }
                return;
            }
            faucetHandler.decreesSmelteryFluidLevel(materialInSmelter, 9);
            faucetHandler.setMaterial(materialInSmelter);
            faucetHandler.setFlowState(FlowState.LONG);
            this.setCastingBasinCurrentId(block, recipe.outputState);
            system.runTimeout(() => {
                if (!block.isValid || block?.typeId !== TCBlocks.CASTING_BASIN) {
                    return;
                }
                faucetHandler.setMaterial(SmelteryMaterials.EMPTY);
                faucetHandler.setFlowState(FlowState.OFF);
            }, 20);
        };
    }
    setCastingBasinCurrentId(block, id) {
        zt.updateBlockStates(block, {
            [Ot("type")]: id[0],
            [Ot("material_1")]: id[1],
            [Ot("material_2")]: id[2]
        });
    }
    getCastingBasinCurrentId(block) {
        const number1 = zt.getBlockState(block.permutation, Ot("type"));
        const number2 = zt.getBlockState(block.permutation, Ot("material_1"));
        const number3 = zt.getBlockState(block.permutation, Ot("material_2"));
        return [number1, number2, number3];
    }
}
class CastingTableBlockUnderType {
    constructor() {
        this.onAction = (block, faucetHandler, player) => {
            const currentId = this.getCastingTableCurrentId(block);
            const materialInSmelter = faucetHandler.getMaterialInSmelter();
            const recipe1 = FaucetTableRecipes.getRecipe(currentId, materialInSmelter);
            if (!recipe1) {
                if (player) {
                    sendTranslated(player, "ftb_tc.faucet.no_recipe");
                }
                return;
            }
            const amountInSmelter = faucetHandler.getAmountInSmelter(materialInSmelter);
            if (amountInSmelter < 2) {
                if (player) {
                    sendTranslated(player, "ftb_tc.faucet.not_enough_material");
                }
                return;
            }
            faucetHandler.decreesSmelteryFluidLevel(materialInSmelter, 2);
            faucetHandler.setMaterial(materialInSmelter);
            faucetHandler.setFlowState(FlowState.SHORT);
            this.setCastingTableCurrentId(block, recipe1.outputState);
            system.runTimeout(() => {
                if (!block.isValid || block?.typeId !== TCBlocks.CASTING_TABLE) {
                    return;
                }
                faucetHandler.setMaterial(SmelteryMaterials.EMPTY);
                faucetHandler.setFlowState(FlowState.OFF);
            }, 20);
        };
    }
    setCastingTableCurrentId(block, id) {
        zt.updateBlockStates(block, {
            [Ot("state_1")]: id[0],
            [Ot("state_2")]: id[1],
            [Ot("state_3")]: id[2]
        });
    }
    getCastingTableCurrentId(block) {
        const number1 = zt.getBlockState(block.permutation, Ot("state_1"));
        const number2 = zt.getBlockState(block.permutation, Ot("state_2"));
        const number3 = zt.getBlockState(block.permutation, Ot("state_3"));
        return [number1, number2, number3];
    }
}
const BLOCK_UNDER_TYPES = {
    [TCBlocks.CASTING_TABLE]: new CastingTableBlockUnderType(),
    [TCBlocks.CASTING_BASIN]: new CastingBasinBlockUnderType(),
};
const FAUCET_CONNECTIONS = {
    [TCBlocks.DRAIN]: new DrainConnection(),
    [TCBlocks.MELTER]: new MelterConnection(),
    [TCBlocks.MELTER_PROXY]: new MelterProxyConnection()
};

export { FaucetBlockComponent };
