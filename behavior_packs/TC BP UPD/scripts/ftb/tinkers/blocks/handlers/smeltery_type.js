import { SmelteryMaterials } from '../../recipes/recipes.js';

class MelterLikeHandler {
    decreesFluidLevel(materialType, amount) {
        const currentLevel = this.getFluidLevel(materialType);
        const newLevel = Math.max(currentLevel - amount, 0);
        this.setFluidLevel(materialType, newLevel);
        if (newLevel === 0) {
            this.setMaterial(SmelteryMaterials.EMPTY);
        }
    }
    increaseFluidLevel(materialType, amount) {
        const currentLevel = this.getFluidLevel(materialType);
        const newLevel = Math.min(currentLevel + amount, this.getMaxFluidLevel());
        this.setFluidLevel(materialType, newLevel);
        if (newLevel > 0) {
            this.setMaterial(materialType);
        }
    }
}

export { MelterLikeHandler };
