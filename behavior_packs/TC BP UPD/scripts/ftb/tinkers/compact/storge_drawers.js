import { world, system } from '@minecraft/server';
import { SmelteryRecipes, SmelteryMaterials } from '../recipes/recipes.js';
import { sieves as lt, tc as Ot } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { MinecraftItemTypes } from '../minecraft_vanilla_data.js';
import { TCItems } from '../constants.js';

function registerRecipe(topSlot, bottomSlot, bottomSlotCount) {
    system.sendScriptEvent("ftb_sd:register_compacting_recipe", JSON.stringify({
        topSlot: topSlot,
        bottomSlot: bottomSlot,
        bottomSlotCount: bottomSlotCount
    }));
}
function registerBasicMaterial(material, hasNugget = true) {
    const block = Ot(material + "_block");
    const ingot = Ot(material + "_ingot");
    const nugget = Ot(material + "_nugget");
    registerRecipe(block, ingot, 9);
    if (hasNugget) {
        registerRecipe(ingot, nugget, 9);
    }
}
world.afterEvents.worldLoad.subscribe((event) => {
    registerBasicMaterial("amethyst_bronze");
    registerBasicMaterial("ardite");
    registerBasicMaterial("cobalt");
    registerBasicMaterial("hepatizon");
    registerBasicMaterial("manyullyn");
    registerBasicMaterial("pig_iron");
    registerBasicMaterial("queens_slime");
    registerBasicMaterial("rose_gold");
    registerBasicMaterial("slimesteel");
    registerBasicMaterial("bronze");
    registerBasicMaterial("tin");
    registerBasicMaterial("cheese", false);
    registerRecipe(MinecraftItemTypes.Diamond, TCItems.DIAMOND_SHARD, 9);
    registerRecipe(MinecraftItemTypes.Emerald, TCItems.EMERALD_SHARD, 9);
    registerRecipe(TCItems.RAW_TIN, TCItems.TIN_SCRAP, 4);
    registerRecipe(TCItems.RAW_COBALT, TCItems.COBALT_SCRAP, 4);
    registerRecipe(TCItems.RAW_ARIDTE, TCItems.ARDITE_SCRAP, 4);
    SmelteryRecipes.registerSet(SmelteryMaterials.EMERALD, {
        [lt("raw_emerald")]: 1,
    });
    SmelteryRecipes.registerSet(SmelteryMaterials.DIAMOND, {
        [lt("raw_diamond")]: 1,
    });
});
