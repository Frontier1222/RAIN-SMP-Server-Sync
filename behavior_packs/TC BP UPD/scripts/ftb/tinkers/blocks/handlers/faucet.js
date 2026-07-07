import { BlockUtils as zt, tc as Ot } from '../../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { TCBlocks } from '../../constants.js';

class FaucetHandler {
    constructor(block, smelteryHandler) {
        this.block = block;
        this.smelteryHandler = smelteryHandler;
    }
    static create(block, melterHandler) {
        if (!block || block.typeId !== TCBlocks.FAUCET) {
            throw new Error(`Invalid block type ${block.typeId} for FaucetHandler`);
        }
        return new FaucetHandler(block, melterHandler);
    }
    getMaterialInSmelter() {
        return this.smelteryHandler.getMaterial();
    }
    getAmountInSmelter(materialType) {
        return this.smelteryHandler.getFluidLevel(materialType);
    }
    decreesSmelteryFluidLevel(materialType, amount) {
        this.smelteryHandler.decreesFluidLevel(materialType, amount);
    }
    increesSmelteryFluidLevel(materialType, amount) {
        this.smelteryHandler.increaseFluidLevel(materialType, amount);
    }
    setMaterial(type) {
        const level = type.materialList;
        const fluidLevel1 = Math.floor(level / 10);
        const fluidLevel2 = level % 10;
        zt.updateBlockState(this.block, FaucetHandler.PROPERTIES.FLUID_TYPE_1, fluidLevel1);
        zt.updateBlockState(this.block, FaucetHandler.PROPERTIES.FLUID_TYPE_2, fluidLevel2);
    }
    setFlowState(state) {
        zt.updateBlockState(this.block, FaucetHandler.PROPERTIES.FLOW_STATE, state);
    }
    getFlowState() {
        return zt.getBlockState(this.block.permutation, FaucetHandler.PROPERTIES.FLOW_STATE);
    }
}
FaucetHandler.PROPERTIES = {
    FLUID_TYPE_1: Ot("fluid_type_1"),
    FLUID_TYPE_2: Ot("fluid_type_2"),
    FLOW_STATE: Ot("flow_state")
};
var FlowState;
(function (FlowState) {
    FlowState[FlowState["OFF"] = 0] = "OFF";
    FlowState[FlowState["SHORT"] = 1] = "SHORT";
    FlowState[FlowState["LONG"] = 2] = "LONG";
})(FlowState || (FlowState = {}));

export { FaucetHandler, FlowState };
