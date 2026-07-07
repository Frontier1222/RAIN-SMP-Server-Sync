import { SmelteryFuelType } from './types/smeltery.js';
import { areArraysEqualStrict } from '../utils.js';
import { PartType, CastType } from './types/drain.js';
import { tc as Ot, mc as Nt, Keys as ct, namespace as b } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { MinecraftItemTypes, MinecraftBlockTypes } from '../minecraft_vanilla_data.js';
import { TCBlocks, TCItems } from '../constants.js';

class SmelteryMaterials {
    static addMaterial(id, blockId, materialList, fluidType) {
        const material = {
            id: id,
            blockId: blockId,
            materialList: materialList,
            fuelType: fluidType
        };
        this.materials.push(material);
        return material;
    }
    static fromId(id) {
        for (const material of SmelteryMaterials.materials) {
            if (material.id === id) {
                return material;
            }
        }
        return undefined;
    }
    static fromMaterialList(materialList) {
        for (const material of SmelteryMaterials.materials) {
            if (material.materialList === materialList) {
                return material;
            }
        }
        return undefined;
    }
    static numberArray(material) {
        const fluidLevel1 = Math.floor(material.materialList / 10);
        const fluidLevel2 = material.materialList % 10;
        return [fluidLevel1, fluidLevel2];
    }
}
SmelteryMaterials.materials = [];
SmelteryMaterials.EMPTY = SmelteryMaterials.addMaterial("empty", "minecraft:air", 0, SmelteryFuelType.LAVA);
SmelteryMaterials.AMETHYST_BRONZE = SmelteryMaterials.addMaterial("amethyst_bronze", Ot("amethyst_bronze_block"), 1, SmelteryFuelType.LAVA);
SmelteryMaterials.ARDITE = SmelteryMaterials.addMaterial("ardite", Ot("ardite_block"), 2, SmelteryFuelType.LAVA);
SmelteryMaterials.COBALT = SmelteryMaterials.addMaterial("cobalt", Ot("cobalt_block"), 3, SmelteryFuelType.LAVA);
SmelteryMaterials.COPPER = SmelteryMaterials.addMaterial("copper", Nt("copper_block"), 4, SmelteryFuelType.LAVA);
SmelteryMaterials.DIAMOND = SmelteryMaterials.addMaterial("diamond", Nt("diamond_block"), 5, SmelteryFuelType.LAVA);
SmelteryMaterials.EMERALD = SmelteryMaterials.addMaterial("emerald", Nt("emerald_block"), 6, SmelteryFuelType.LAVA);
SmelteryMaterials.GOLD = SmelteryMaterials.addMaterial("gold", Nt("gold_block"), 7, SmelteryFuelType.LAVA);
SmelteryMaterials.HEPATIZON = SmelteryMaterials.addMaterial("hepatizon", Ot("hepatizon_block"), 8, SmelteryFuelType.BLAZE);
SmelteryMaterials.IRON = SmelteryMaterials.addMaterial("iron", Nt("iron_block"), 9, SmelteryFuelType.LAVA);
SmelteryMaterials.MANYULLYN = SmelteryMaterials.addMaterial("manyullyn", Ot("manyullyn_block"), 10, SmelteryFuelType.BLAZE);
SmelteryMaterials.NETHERITE = SmelteryMaterials.addMaterial("netherite", Nt("netherite_block"), 11, SmelteryFuelType.BLAZE);
SmelteryMaterials.PIG_IRON = SmelteryMaterials.addMaterial("pig_iron", Ot("pig_iron_block"), 12, SmelteryFuelType.LAVA);
SmelteryMaterials.QUEENS_SLIME = SmelteryMaterials.addMaterial("queens_slime", Ot("queens_slime_block"), 13, SmelteryFuelType.BLAZE);
SmelteryMaterials.ROSE_GOLD = SmelteryMaterials.addMaterial("rose_gold", Ot("rose_gold_block"), 14, SmelteryFuelType.LAVA);
SmelteryMaterials.SLIMESTEEL = SmelteryMaterials.addMaterial("slimesteel", Ot("slimesteel_block"), 15, SmelteryFuelType.LAVA);
SmelteryMaterials.EARTH_SLIME = SmelteryMaterials.addMaterial("earth_slime", Nt("slime"), 16, SmelteryFuelType.LAVA);
SmelteryMaterials.ENDER_SLIME = SmelteryMaterials.addMaterial("ender_slime", Ot("ender_slime"), 17, SmelteryFuelType.LAVA);
SmelteryMaterials.SCARLET_SLIME = SmelteryMaterials.addMaterial("scarlet_slime", Ot("scarlet_essence"), 18, SmelteryFuelType.LAVA);
SmelteryMaterials.SKY_SLIME = SmelteryMaterials.addMaterial("sky_slime", Ot("sky_slime"), 19, SmelteryFuelType.LAVA);
SmelteryMaterials.TIN = SmelteryMaterials.addMaterial("tin", Ot("tin_block"), 20, SmelteryFuelType.LAVA);
SmelteryMaterials.BRONZE = SmelteryMaterials.addMaterial("bronze", Ot("bronze_block"), 21, SmelteryFuelType.LAVA);
class SmelteryRecipes {
    static registerFullOreSet(material, value) {
        this.registerOreSet(material, value, value, value, value);
    }
    static registerOreSet(material, raw, rawBlock, ingot, block) {
        const base = material.id;
        SmelteryRecipes.registerSet(material, {
            [b(raw, "raw_" + base)]: 1,
            [b(rawBlock, "raw_" + base + "_block")]: 9,
            [b(ingot, base + "_ingot")]: 1,
            [b(block, base + "_block")]: 9
        });
    }
    static registerSet(material, values) {
        for (const [input, outputAmount] of Object.entries(values)) {
            SmelteryRecipes.register(input, material, outputAmount, "bucket.fill_lava", true);
        }
    }
    static register(input, outputType, outputAmount, sound, usesFuel, returnItem) {
        const recipe = {
            input: input,
            outputType: outputType,
            outputAmount: outputAmount,
            sound: sound,
            useFuel: usesFuel,
            returnItem: returnItem
        };
        this.RECIPES.push(recipe);
        return recipe;
    }
    static registerRecipe(recipe) {
        this.RECIPES.push(recipe);
    }
    static fromInput(input) {
        for (const recipe of this.RECIPES) {
            if (recipe.input === input) {
                return recipe;
            }
        }
        return undefined;
    }
}
SmelteryRecipes.RECIPES = [];
(() => {
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.AMETHYST_BRONZE, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.ARDITE, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.COBALT, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.COPPER, ct.MINECRAFT);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.DIAMOND, ct.MINECRAFT);
    SmelteryRecipes.registerSet(SmelteryMaterials.DIAMOND, {
        [Nt("diamond")]: 1,
        [Nt("diamond_block")]: 9
    });
    SmelteryRecipes.registerSet(SmelteryMaterials.EMERALD, {
        [Nt("emerald")]: 1,
        [Nt("emerald_block")]: 9
    });
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.GOLD, ct.MINECRAFT);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.HEPATIZON, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.IRON, ct.MINECRAFT);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.MANYULLYN, ct.TINKERS);
    SmelteryRecipes.registerSet(SmelteryMaterials.NETHERITE, {
        [Nt("netherite_ingot")]: 1,
        [Nt("netherite_block")]: 9
    });
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.PIG_IRON, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.ROSE_GOLD, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.QUEENS_SLIME, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.SLIMESTEEL, ct.TINKERS);
    SmelteryRecipes.registerSet(SmelteryMaterials.EARTH_SLIME, {
        [TCBlocks.CONGEALED_EARTH_SLIME]: 4,
        [MinecraftItemTypes.SlimeBall]: 1,
        [MinecraftBlockTypes.Slime]: 9
    });
    SmelteryRecipes.registerSet(SmelteryMaterials.ENDER_SLIME, {
        [TCBlocks.CONGEALED_ENDER_SLIME]: 4,
        [TCItems.ENDER_SLIME_BALL]: 1,
        [TCBlocks.ENDER_SLIME_BLOCK]: 9
    });
    SmelteryRecipes.registerSet(SmelteryMaterials.SCARLET_SLIME, {
        [TCBlocks.CONGEALED_SCARLET_SLIME]: 4,
        [TCItems.SCARLET_SLIME_BALL]: 1,
        [TCBlocks.SCARLET_SLIME_BLOCK]: 9
    });
    SmelteryRecipes.registerSet(SmelteryMaterials.SKY_SLIME, {
        [TCBlocks.CONGEALED_SKY_SLIME]: 4,
        [TCItems.SKY_SLIME_BALL]: 1,
        [TCBlocks.SKY_SLIME_BLOCK]: 9
    });
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.TIN, ct.TINKERS);
    SmelteryRecipes.registerFullOreSet(SmelteryMaterials.BRONZE, ct.TINKERS);
    SmelteryRecipes.registerSet(SmelteryMaterials.NETHERITE, {
        [Ot("raw_netherite")]: 1,
        [Ot("raw_netherite_block")]: 9
    });
    for (const materialsKey in SmelteryMaterials.materials) {
        const material = SmelteryMaterials.materials[materialsKey];
        SmelteryRecipes.register(Ot("bucket_" + material.id), material, 10, "bucket.empty_lava", false, Nt("bucket"));
        SmelteryRecipes.register(Ot("copper_can_" + material.id), material, 2, "bucket.empty_lava", false, Ot("copper_can_empty"));
        SmelteryRecipes.register(Ot("iron_can_" + material.id), material, 1, "bucket.empty_lava", false, Ot("iron_can_empty"));
    }
})();
class FluidStorageRecipes {
    static register(itemId, fluid, amount, seared_tank, return_item) {
        this.RECIPES.push({
            itemId: itemId,
            fluid: fluid,
            amount: amount,
            seared_tank: seared_tank,
            return_item: return_item
        });
    }
    static getComponentFromStack(stack) {
        if (!stack.hasComponent("ftb_tc:fluid_storage")) {
            for (const recipe of FluidStorageRecipes.RECIPES) {
                if (recipe.itemId === stack.typeId) {
                    return recipe;
                }
            }
            return undefined;
        }
        const customComponentParameters = stack.getComponent("ftb_tc:fluid_storage");
        const jsonValue = customComponentParameters.customComponentParameters.params;
        return JSON.parse(JSON.stringify(jsonValue));
    }
}
FluidStorageRecipes.RECIPES = [];
(() => {
    // Vanilla Buckets
    FluidStorageRecipes.register("minecraft:lava_bucket", SmelteryFuelType.LAVA, 1000, true, "minecraft:bucket");
    FluidStorageRecipes.register("minecraft:water_bucket", SmelteryFuelType.WATER, 1000, true, "minecraft:bucket");
    
    // Tinkers' Blazing Lava Bucket
    FluidStorageRecipes.register("ftb_tc:bucket_blaze", SmelteryFuelType.BLAZE, 1000, true, "minecraft:bucket");
    
    // Copper Cans
    FluidStorageRecipes.register("ftb_tc:copper_can_lava", SmelteryFuelType.LAVA, 200, true, "ftb_tc:copper_can_empty");
    FluidStorageRecipes.register("ftb_tc:copper_can_water", SmelteryFuelType.WATER, 200, true, "ftb_tc:copper_can_empty");
    FluidStorageRecipes.register("ftb_tc:copper_can_blaze", SmelteryFuelType.BLAZE, 200, true, "ftb_tc:copper_can_empty");
})();

class FluidHolderRecipes {
    static getStack(stack, fluidType) {
        // If the item doesn't use the custom dynamic component, check hardcoded items:
        if (!stack.hasComponent("ftb_tc:fluid_holder")) {
            
            // 1. Vanilla Bucket Extraction
            if (stack.typeId === "minecraft:bucket") {
                switch (fluidType) {
                    case SmelteryFuelType.LAVA:
                        return { amount: 1000, return_item: "minecraft:lava_bucket" };
                    case SmelteryFuelType.WATER:
                        return { amount: 1000, return_item: "minecraft:water_bucket" };
                    case SmelteryFuelType.BLAZE:
                        return { amount: 1000, return_item: Ot("bucket_blaze") };
                }
            }
            
            // 2. Copper Can Extraction
            if (stack.typeId === "ftb_tc:copper_can_empty") {
                switch (fluidType) {
                    case SmelteryFuelType.LAVA:
                        return { amount: 200, return_item: "ftb_tc:copper_can_lava" };
                    case SmelteryFuelType.WATER:
                        return { amount: 200, return_item: "ftb_tc:copper_can_water" };
                    case SmelteryFuelType.BLAZE:
                        return { amount: 200, return_item: "ftb_tc:copper_can_blaze" };
                }
            }

            // 3. Iron Can Extraction (Optional)
            if (stack.typeId === "ftb_tc:iron_can_empty") {
                switch (fluidType) {
                    case SmelteryFuelType.LAVA:
                        return { amount: 200, return_item: "ftb_tc:iron_can_lava" };
                    case SmelteryFuelType.WATER:
                        return { amount: 200, return_item: "ftb_tc:iron_can_water" };
                    case SmelteryFuelType.BLAZE:
                        return { amount: 200, return_item: "ftb_tc:iron_can_blaze" };
                }
            }

            // 4. Blaze Head Extraction (blaze fluid only)
            if (stack.typeId === "minecraft:blaze_head" || stack.typeId === "ftb_tc:blaze_head_item") {
                if (fluidType === SmelteryFuelType.BLAZE) {
                    return { amount: 1000, return_item: Ot("bucket_blaze") };
                }
            }
            
            return undefined;
        }
        
        // Dynamic component fallback (Keep this exactly the same)
        const customComponentParameters = stack.getComponent("ftb_tc:fluid_holder");
        const jsonValue = customComponentParameters.customComponentParameters.params;
        const parse = JSON.parse(JSON.stringify(jsonValue));
        return {
            amount: parse.amount,
            return_item: parse.return_item.replace("{fluid_type}", fluidType)
        };
    }
    
    static getStackFromMaterial(stack, materialType) {
        if (!stack.hasComponent("ftb_tc:fluid_holder")) {
            if (stack.typeId === "minecraft:bucket") {
                return {
                    amount: 1000,
                    return_item: Ot("bucket_" + materialType.id)
                };
            }
            if (
                (stack.typeId === "minecraft:blaze_head" || stack.typeId === "ftb_tc:blaze_head_item") &&
                materialType?.fuelType === SmelteryFuelType.BLAZE
            ) {
                return {
                    amount: 1000,
                    return_item: Ot("bucket_blaze")
                };
            }
            return undefined;
        }
        const customComponentParameters = stack.getComponent("ftb_tc:fluid_holder");
        const jsonValue = customComponentParameters.customComponentParameters.params;
        const parse = JSON.parse(JSON.stringify(jsonValue));
        return {
            amount: parse.amount,
            return_item: parse.return_item.replace("{fluid_type}", materialType.id)
        };
    }
}
class FaucetTableRecipes {
    static registerPartType(partType, castType, id) {
        const part = {
            partType: partType,
            castType: castType,
            id: id
        };
        this.PART_TYPES.push(part);
        return part;
    }
    static castPartId(partType, castType) {
        for (const part of this.PART_TYPES) {
            if (part.partType === partType && part.castType === castType) {
                return part;
            }
        }
        return undefined;
    }
    static registerDrainRecipeTyped(partType, castType, fluidType, outputState) {
        const part = this.castPartId(partType, castType);
        if (!part) {
            throw new Error(`Part type ${partType} with cast type ${castType} not found.`);
        }
        return this.registerDrainRecipe(outputState, fluidType, part.id);
    }
    static registerDrainRecipe(outputState, fluid, wantedState) {
        const recipe = {
            outputState: outputState,
            fluid: fluid,
            wantedState: wantedState,
        };
        this.RECIPES.push(recipe);
        return recipe;
    }
    static getRecipe(currentState, fluid) {
        for (const recipe of this.RECIPES) {
            if (recipe.fluid.id === fluid.id && areArraysEqualStrict(recipe.wantedState, currentState)) {
                return recipe;
            }
        }
        return undefined;
    }
}
FaucetTableRecipes.RECIPES = [];
FaucetTableRecipes.PART_TYPES = [];
(() => {
    // Sand Casts
    FaucetTableRecipes.registerPartType(PartType.AXE, CastType.SAND, [0, 1, 1]);
    FaucetTableRecipes.registerPartType(PartType.PICKAXE, CastType.SAND, [0, 1, 2]);
    FaucetTableRecipes.registerPartType(PartType.ROD, CastType.SAND, [0, 1, 3]);
    FaucetTableRecipes.registerPartType(PartType.SWORD, CastType.SAND, [0, 1, 4]);
    FaucetTableRecipes.registerPartType(PartType.GUARD, CastType.SAND, [0, 1, 5]);
    FaucetTableRecipes.registerPartType(PartType.DAGGER, CastType.SAND, [0, 1, 6]);
    FaucetTableRecipes.registerPartType(PartType.CROSSGUARD, CastType.SAND, [0, 1, 7]);
    FaucetTableRecipes.registerPartType(PartType.CLEAVER, CastType.SAND, [0, 1, 8]);
    FaucetTableRecipes.registerPartType(PartType.CLEAVER_GUARD, CastType.SAND, [0, 1, 9]);
    FaucetTableRecipes.registerPartType(PartType.REPAIR_KIT, CastType.SAND, [0, 1, 10]);
    FaucetTableRecipes.registerPartType(PartType.INGOT, CastType.SAND, [0, 1, 11]);
    FaucetTableRecipes.registerPartType(PartType.DIAMOND, CastType.SAND, [0, 1, 12]);
    FaucetTableRecipes.registerPartType(PartType.EMERALD, CastType.SAND, [0, 1, 13]);
    FaucetTableRecipes.registerPartType(PartType.BUCKET, CastType.SAND, [0, 1, 14]);
    FaucetTableRecipes.registerPartType(PartType.SHOEL, CastType.SAND, [3, 9, 12]);
    // Red Sand Casts
    FaucetTableRecipes.registerPartType(PartType.AXE, CastType.RED_SAND, [1, 3, 15]);
    FaucetTableRecipes.registerPartType(PartType.PICKAXE, CastType.RED_SAND, [1, 4, 0]);
    FaucetTableRecipes.registerPartType(PartType.ROD, CastType.RED_SAND, [1, 4, 1]);
    FaucetTableRecipes.registerPartType(PartType.SWORD, CastType.RED_SAND, [1, 4, 2]);
    FaucetTableRecipes.registerPartType(PartType.GUARD, CastType.RED_SAND, [1, 4, 3]);
    FaucetTableRecipes.registerPartType(PartType.DAGGER, CastType.RED_SAND, [1, 4, 4]);
    FaucetTableRecipes.registerPartType(PartType.CROSSGUARD, CastType.RED_SAND, [1, 4, 5]);
    FaucetTableRecipes.registerPartType(PartType.CLEAVER, CastType.RED_SAND, [1, 4, 6]);
    FaucetTableRecipes.registerPartType(PartType.CLEAVER_GUARD, CastType.RED_SAND, [1, 4, 7]);
    FaucetTableRecipes.registerPartType(PartType.REPAIR_KIT, CastType.RED_SAND, [1, 4, 8]);
    FaucetTableRecipes.registerPartType(PartType.INGOT, CastType.RED_SAND, [1, 4, 9]);
    FaucetTableRecipes.registerPartType(PartType.DIAMOND, CastType.RED_SAND, [1, 4, 10]);
    FaucetTableRecipes.registerPartType(PartType.EMERALD, CastType.RED_SAND, [1, 4, 11]);
    FaucetTableRecipes.registerPartType(PartType.BUCKET, CastType.RED_SAND, [1, 4, 12]);
    FaucetTableRecipes.registerPartType(PartType.SHOEL, CastType.RED_SAND, [3, 11, 6]);
    // Casts (Metal)
    FaucetTableRecipes.registerPartType(PartType.AXE, CastType.CAST, [2, 7, 11]);
    FaucetTableRecipes.registerPartType(PartType.PICKAXE, CastType.CAST, [2, 7, 12]);
    FaucetTableRecipes.registerPartType(PartType.ROD, CastType.CAST, [2, 7, 13]);
    FaucetTableRecipes.registerPartType(PartType.SWORD, CastType.CAST, [2, 7, 14]);
    FaucetTableRecipes.registerPartType(PartType.GUARD, CastType.CAST, [2, 7, 15]);
    FaucetTableRecipes.registerPartType(PartType.DAGGER, CastType.CAST, [2, 8, 0]);
    FaucetTableRecipes.registerPartType(PartType.CROSSGUARD, CastType.CAST, [2, 8, 1]);
    FaucetTableRecipes.registerPartType(PartType.CLEAVER, CastType.CAST, [2, 8, 2]);
    FaucetTableRecipes.registerPartType(PartType.CLEAVER_GUARD, CastType.CAST, [2, 8, 3]);
    FaucetTableRecipes.registerPartType(PartType.REPAIR_KIT, CastType.CAST, [2, 8, 4]);
    FaucetTableRecipes.registerPartType(PartType.INGOT, CastType.CAST, [2, 8, 5]);
    FaucetTableRecipes.registerPartType(PartType.DIAMOND, CastType.CAST, [2, 8, 6]);
    FaucetTableRecipes.registerPartType(PartType.EMERALD, CastType.CAST, [2, 8, 7]);
    FaucetTableRecipes.registerPartType(PartType.BUCKET, CastType.CAST, [2, 8, 8]);
    FaucetTableRecipes.registerPartType(PartType.SHOEL, CastType.CAST, [3, 13, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 1, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.ARDITE, [0, 2, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.COBALT, [0, 2, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 2, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.GOLD, [0, 2, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 2, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.IRON, [0, 2, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 2, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 2, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 2, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 2, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 2, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 2, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.ARDITE, [0, 2, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.COBALT, [0, 2, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 2, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.GOLD, [0, 2, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 3, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.IRON, [0, 3, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 3, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 3, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 3, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 3, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 3, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 3, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.ARDITE, [0, 3, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.COBALT, [0, 3, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 3, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.GOLD, [0, 3, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 3, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.IRON, [0, 3, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 3, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 3, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 4, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 4, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 4, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 4, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.ARDITE, [0, 4, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.COBALT, [0, 4, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 4, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.GOLD, [0, 4, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 4, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.IRON, [0, 4, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 4, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 4, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 4, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 4, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 4, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 4, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.ARDITE, [0, 5, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.COBALT, [0, 5, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 5, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.GOLD, [0, 5, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 5, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.IRON, [0, 5, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 5, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 5, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 5, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 5, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 5, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 5, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.ARDITE, [0, 5, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.COBALT, [0, 5, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 5, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.GOLD, [0, 5, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 6, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.IRON, [0, 6, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 6, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 6, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 6, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 6, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 6, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 6, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.ARDITE, [0, 6, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.COBALT, [0, 6, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 6, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.GOLD, [0, 6, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 6, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.IRON, [0, 6, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 6, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 6, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 7, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 7, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 7, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 7, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.ARDITE, [0, 7, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.COBALT, [0, 7, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 7, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.GOLD, [0, 7, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 7, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.IRON, [0, 7, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 7, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 7, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 7, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 7, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 7, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 7, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.ARDITE, [0, 8, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.COBALT, [0, 8, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 8, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.GOLD, [0, 8, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 8, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.IRON, [0, 8, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 8, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 8, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 8, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 8, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 8, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 8, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.ARDITE, [0, 8, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.COBALT, [0, 8, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 8, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.GOLD, [0, 8, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 9, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.IRON, [0, 9, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 9, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 9, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 9, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 9, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 9, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [0, 9, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.ARDITE, [0, 9, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.COBALT, [0, 9, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.COPPER, [0, 9, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 9, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.GOLD, [0, 9, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.HEPATIZON, [0, 9, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.IRON, [0, 9, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.MANYULLYN, [0, 9, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.NETHERITE, [0, 10, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.PIG_IRON, [0, 10, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [0, 10, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [0, 10, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [0, 10, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DIAMOND, CastType.SAND, SmelteryMaterials.DIAMOND, [0, 10, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.EMERALD, CastType.SAND, SmelteryMaterials.EMERALD, [0, 10, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.BUCKET, CastType.SAND, SmelteryMaterials.IRON, [0, 10, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 4, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 4, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 4, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 5, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 5, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 5, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 5, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 5, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 5, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 5, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 5, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 5, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 5, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 5, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 5, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 5, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 5, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 5, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 5, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 6, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 6, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 6, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 6, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 6, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 6, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 6, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 6, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 6, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 6, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 6, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 6, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 6, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 6, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 6, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 6, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 7, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 7, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 7, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 7, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 7, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 7, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 7, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 7, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 7, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 7, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 7, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 7, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 7, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 7, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 7, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 7, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 8, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 8, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 8, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 8, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 8, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 8, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 8, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 8, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 8, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 8, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 8, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 8, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 8, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 8, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 8, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 8, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 9, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 9, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 9, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 9, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 9, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [1, 9, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [1, 9, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.COBALT, [1, 9, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [1, 9, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.GOLD, [1, 9, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [1, 9, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.IRON, [1, 9, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [1, 9, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [1, 9, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [1, 9, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [1, 9, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [1, 10, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 0, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 0, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 0, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [4, 0, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.GOLD, [4, 0, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [4, 0, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.IRON, [4, 0, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 1, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 1, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 1, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 2, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 2, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 2, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 2, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 2, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 2, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 2, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 2, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 2, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 2, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 2, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 2, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [4, 2, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.ARDITE, [4, 2, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.COBALT, [4, 2, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 8, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.ARDITE, [2, 8, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.COBALT, [2, 8, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 8, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.GOLD, [2, 8, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 8, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.IRON, [2, 8, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 9, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 9, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 9, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 9, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 9, 4]);
    // Cast Pickaxe
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 9, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.ARDITE, [2, 9, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.COBALT, [2, 9, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 9, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.GOLD, [2, 9, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 9, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.IRON, [2, 9, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 9, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 9, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 9, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 9, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 10, 0]);
    // Cast Rod
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 10, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.ARDITE, [2, 10, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.COBALT, [2, 10, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 10, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.GOLD, [2, 10, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 10, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.IRON, [2, 10, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 10, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 10, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 10, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 10, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 10, 12]);
    // Cast Sword
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 10, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.ARDITE, [2, 10, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.COBALT, [2, 10, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 11, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.GOLD, [2, 11, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 11, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.IRON, [2, 11, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 11, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 11, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 11, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 11, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 11, 8]);
    // Cast Guard
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 11, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.ARDITE, [2, 11, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.COBALT, [2, 11, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 11, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.GOLD, [2, 11, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 11, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.IRON, [2, 11, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 12, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 12, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 12, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 12, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 12, 4]);
    // Cast Dagger
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 12, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.ARDITE, [2, 12, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.COBALT, [2, 12, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 12, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.GOLD, [2, 12, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 12, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.IRON, [2, 12, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 12, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 12, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 12, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 12, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 13, 0]);
    // Cast Crossguard
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 13, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.ARDITE, [2, 13, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.COBALT, [2, 13, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 13, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.GOLD, [2, 13, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 13, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.IRON, [2, 13, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 13, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 13, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 13, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 13, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 13, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 13, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.ARDITE, [2, 13, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.COBALT, [2, 13, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 14, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.GOLD, [2, 14, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 14, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.IRON, [2, 14, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 14, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 14, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 14, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 14, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 14, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 14, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.ARDITE, [2, 14, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.COBALT, [2, 14, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 14, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.GOLD, [2, 14, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 14, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.IRON, [2, 14, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 15, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 15, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 15, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 15, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [2, 15, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [2, 15, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.ARDITE, [2, 15, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.COBALT, [2, 15, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.DIAMOND, [2, 15, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.GOLD, [2, 15, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.HEPATIZON, [2, 15, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.IRON, [2, 15, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.MANYULLYN, [2, 15, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.PIG_IRON, [2, 15, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [2, 15, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [2, 15, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [3, 0, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [3, 0, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.ARDITE, [3, 0, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.COBALT, [3, 0, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.COPPER, [3, 0, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.DIAMOND, [3, 0, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.GOLD, [3, 0, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.HEPATIZON, [3, 0, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.IRON, [3, 0, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.MANYULLYN, [3, 0, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.NETHERITE, [3, 0, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.PIG_IRON, [3, 0, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [3, 0, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [3, 0, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [3, 0, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DIAMOND, CastType.CAST, SmelteryMaterials.DIAMOND, [3, 0, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.EMERALD, CastType.CAST, SmelteryMaterials.EMERALD, [3, 1, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.BUCKET, CastType.CAST, SmelteryMaterials.IRON, [3, 1, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.AMETHYST_BRONZE, [3, 9, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.ARDITE, [3, 9, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.COBALT, [3, 9, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.DIAMOND, [3, 10, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.GOLD, [3, 10, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.HEPATIZON, [3, 10, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.IRON, [3, 10, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.MANYULLYN, [3, 10, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.PIG_IRON, [3, 10, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.QUEENS_SLIME, [3, 10, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.ROSE_GOLD, [3, 10, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.SAND, SmelteryMaterials.SLIMESTEEL, [3, 10, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.AMETHYST_BRONZE, [3, 11, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.ARDITE, [3, 11, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.COBALT, [3, 11, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.DIAMOND, [3, 11, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.GOLD, [3, 11, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.HEPATIZON, [3, 11, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.IRON, [3, 11, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.MANYULLYN, [3, 11, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.PIG_IRON, [3, 11, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.QUEENS_SLIME, [3, 12, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.ROSE_GOLD, [3, 12, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.RED_SAND, SmelteryMaterials.SLIMESTEEL, [3, 12, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.AMETHYST_BRONZE, [3, 13, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.ARDITE, [3, 13, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.COBALT, [3, 13, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.DIAMOND, [3, 13, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.GOLD, [3, 13, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.HEPATIZON, [3, 13, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.IRON, [3, 13, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.MANYULLYN, [3, 13, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.PIG_IRON, [3, 13, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.QUEENS_SLIME, [3, 13, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.ROSE_GOLD, [3, 13, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SHOEL, CastType.CAST, SmelteryMaterials.SLIMESTEEL, [3, 13, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.SAND, SmelteryMaterials.BRONZE, [3, 15, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 6]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 7]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 8]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 9]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 10]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 11]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.RED_SAND, SmelteryMaterials.BRONZE, [4, 0, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.AXE, CastType.CAST, SmelteryMaterials.BRONZE, [4, 1, 12]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.PICKAXE, CastType.CAST, SmelteryMaterials.BRONZE, [4, 1, 13]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.ROD, CastType.CAST, SmelteryMaterials.BRONZE, [4, 1, 14]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.SWORD, CastType.CAST, SmelteryMaterials.BRONZE, [4, 1, 15]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.GUARD, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 0]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.DAGGER, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 1]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CROSSGUARD, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 2]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 3]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.CLEAVER_GUARD, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 4]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.REPAIR_KIT, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 5]);
    FaucetTableRecipes.registerDrainRecipeTyped(PartType.INGOT, CastType.CAST, SmelteryMaterials.BRONZE, [4, 2, 6]);
    FaucetTableRecipes.registerDrainRecipe([2, 7, 11], SmelteryMaterials.GOLD, [2, 15, 5]);
    FaucetTableRecipes.registerDrainRecipe([2, 7, 12], SmelteryMaterials.GOLD, [2, 6, 0]); // Pickaxe Head
    FaucetTableRecipes.registerDrainRecipe([2, 7, 13], SmelteryMaterials.GOLD, [2, 6, 1]); // Large Handle (Rod)
    FaucetTableRecipes.registerDrainRecipe([2, 7, 14], SmelteryMaterials.GOLD, [2, 6, 2]); // Sword Blade
    FaucetTableRecipes.registerDrainRecipe([2, 7, 15], SmelteryMaterials.GOLD, [2, 6, 3]); // Sword Guard
    FaucetTableRecipes.registerDrainRecipe([2, 8, 0], SmelteryMaterials.GOLD, [2, 6, 4]); // Dagger Blade
    FaucetTableRecipes.registerDrainRecipe([2, 8, 1], SmelteryMaterials.GOLD, [2, 6, 5]); // Crossguard
    FaucetTableRecipes.registerDrainRecipe([2, 8, 2], SmelteryMaterials.GOLD, [2, 6, 6]); // Cleaver Blade
    FaucetTableRecipes.registerDrainRecipe([2, 8, 3], SmelteryMaterials.GOLD, [2, 6, 7]); // Cleaver Guard
    FaucetTableRecipes.registerDrainRecipe([2, 8, 4], SmelteryMaterials.GOLD, [2, 6, 8]); // Repair Item
    FaucetTableRecipes.registerDrainRecipe([2, 8, 5], SmelteryMaterials.GOLD, [2, 6, 9]); // Seared Brick
    FaucetTableRecipes.registerDrainRecipe([2, 8, 6], SmelteryMaterials.GOLD, [2, 6, 10]); // Diamond
    FaucetTableRecipes.registerDrainRecipe([2, 8, 7], SmelteryMaterials.GOLD, [2, 6, 11]); // Emerald
    FaucetTableRecipes.registerDrainRecipe([2, 8, 8], SmelteryMaterials.GOLD, [2, 6, 12]); // Bucket
    FaucetTableRecipes.registerDrainRecipe([3, 12, 15], SmelteryMaterials.GOLD, [3, 13, 1]);
    FaucetTableRecipes.registerDrainRecipe([2, 6, 9], SmelteryMaterials.GOLD, [3, 13, 1]);
})();
class FaucetBasinRecipes {
    static getRecipe(material, currentState) {
        for (const recipe of this.POUR_RECIPES) {
            if (recipe.material.id === material.id && areArraysEqualStrict(recipe.wantedState, currentState)) {
                return recipe;
            }
        }
        return undefined;
    }
    static registerPourRecipe(material, outputState) {
        return this.registerRecipe(this.EMPTY_STATE, outputState, material);
    }
    static registerRecipe(wantedState, outputState, material) {
        const recipe = {
            wantedState: wantedState,
            outputState: outputState,
            material: material
        };
        this.POUR_RECIPES.push(recipe);
        return recipe;
    }
}
FaucetBasinRecipes.POUR_RECIPES = [];
FaucetBasinRecipes.EMPTY_STATE = [0, 0, 0];
(() => {
    for (const material of SmelteryMaterials.materials) {
        const arrayValue = SmelteryMaterials.numberArray(material);
        const outputState = [1, arrayValue[0], arrayValue[1]];
        FaucetBasinRecipes.registerPourRecipe(material, outputState);
    }
    FaucetBasinRecipes.registerRecipe([0, 0, 3], [0, 0, 4], SmelteryMaterials.COPPER); // Smeltery Controller
    FaucetBasinRecipes.registerRecipe([0, 0, 5], [0, 2, 2], SmelteryMaterials.ENDER_SLIME); // Slime Boots Recipe
    FaucetBasinRecipes.registerRecipe([0, 0, 6], [0, 2, 3], SmelteryMaterials.ENDER_SLIME); // Slime Pants Recipe
    FaucetBasinRecipes.registerRecipe([0, 0, 7], [0, 2, 4], SmelteryMaterials.ENDER_SLIME); // Slime Chest Recipe
    FaucetBasinRecipes.registerRecipe([0, 0, 8], [0, 2, 5], SmelteryMaterials.ENDER_SLIME); // Slime Helmet Recipe
})();

export { FaucetBasinRecipes, FaucetTableRecipes, FluidHolderRecipes, FluidStorageRecipes, SmelteryMaterials, SmelteryRecipes };
