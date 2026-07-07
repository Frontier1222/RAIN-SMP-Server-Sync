import { MelterLikeHandler } from './smeltery_type.js';
import { tc as Ot, BlockUtils as zt } from '../../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { SmelteryMaterials } from '../../recipes/recipes.js';

class MelterHandler extends MelterLikeHandler {
    constructor(block) {
        super();
        this.block = block;
    }
    static create(block) {
        if (!block || block.typeId !== "ftb_tc:melter") {
            throw new Error(`Invalid block type ${block.typeId} for MelterHandler`);
        }
        return new MelterHandler(block);
    }
    getFluidLevel(materialType) {
        return zt.getBlockState(this.block.permutation, MelterHandler.PROPERTIES.LIQUID_STAGE);
    }
    getMaterial() {
        const material = zt.getBlockState(this.block.permutation, MelterHandler.PROPERTIES.MATERIAL);
        return SmelteryMaterials.fromId(material);
    }
    getMaxFluidLevel() {
        return MelterHandler.MAX_LEVEL;
    }
    getNotBuiltMessage() {
        return "";
    }
    isBuilt() {
        return true;
    }
    setFluidLevel(materialType, level) {
        zt.updateBlockState(this.block, MelterHandler.PROPERTIES.LIQUID_STAGE, level);
    }
    setMaterial(materialType) {
        zt.updateBlockState(this.block, MelterHandler.PROPERTIES.MATERIAL, materialType.id);
    }
}
MelterHandler.MAX_LEVEL = 10;
MelterHandler.PROPERTIES = {
    LIQUID_STAGE: Ot("liquid_stage"),
    MATERIAL: Ot("material"),
};

export { MelterHandler };
