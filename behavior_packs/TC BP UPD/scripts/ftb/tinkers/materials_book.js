import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { PlayerUtils as R } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const BookNext = {
    materials_and_you: "ftb_tc:materials_and_you_0",
    materials_and_you_0: "ftb_tc:materials_and_you_1",
    materials_and_you_1: "ftb_tc:materials_and_you_2",
    materials_and_you_2: "ftb_tc:materials_and_you_3",
    materials_and_you_3: "ftb_tc:materials_and_you_4",
    materials_and_you_4: "ftb_tc:materials_and_you_5",
    materials_and_you_5: "ftb_tc:materials_and_you_6",
    materials_and_you_6: "ftb_tc:materials_and_you_7",
    materials_and_you_7: "ftb_tc:materials_and_you_8",
    materials_and_you_8: "ftb_tc:materials_and_you_9",
    materials_and_you_9: "ftb_tc:materials_and_you_10",
    materials_and_you_10: "ftb_tc:materials_and_you_11",
    materials_and_you_11: "ftb_tc:materials_and_you_12",
    materials_and_you_12: "ftb_tc:materials_and_you_13",
    materials_and_you_13: "ftb_tc:materials_and_you_14",
    materials_and_you_14: "ftb_tc:materials_and_you_15",
    materials_and_you_15: "ftb_tc:materials_and_you_16",
    materials_and_you_16: "ftb_tc:materials_and_you_17",
    materials_and_you_17: "ftb_tc:materials_and_you_18",
    materials_and_you_18: "ftb_tc:materials_and_you_19",
    materials_and_you_19: "ftb_tc:materials_and_you_20",
    materials_and_you_20: "ftb_tc:materials_and_you",
    gadgetry: "ftb_tc:gadgetry_0",
    gadgetry_0: "ftb_tc:gadgetry_1",
    gadgetry_1: "ftb_tc:gadgetry_2",
    gadgetry_2: "ftb_tc:gadgetry_3",
    gadgetry_3: "ftb_tc:gadgetry_4",
    gadgetry_4: "ftb_tc:gadgetry_5",
    gadgetry_5: "ftb_tc:gadgetry_6",
    gadgetry_6: "ftb_tc:gadgetry_7",
    gadgetry_7: "ftb_tc:gadgetry_8",
    gadgetry_8: "ftb_tc:gadgetry_9",
    gadgetry_9: "ftb_tc:gadgetry_10",
    gadgetry_10: "ftb_tc:gadgetry_11",
    gadgetry_11: "ftb_tc:gadgetry_12",
    gadgetry_12: "ftb_tc:gadgetry_13",
    gadgetry_13: "ftb_tc:gadgetry_14",
    gadgetry_14: "ftb_tc:gadgetry_15",
    gadgetry_15: "ftb_tc:gadgetry_16",
    gadgetry_16: "ftb_tc:gadgetry_17",
    gadgetry_17: "ftb_tc:gadgetry_18",
    gadgetry_18: "ftb_tc:gadgetry_19",
    gadgetry_19: "ftb_tc:gadgetry",
    puny_smelting: "ftb_tc:puny_smelting_0",
    puny_smelting_0: "ftb_tc:puny_smelting_1",
    puny_smelting_1: "ftb_tc:puny_smelting_2",
    puny_smelting_2: "ftb_tc:puny_smelting_3",
    puny_smelting_3: "ftb_tc:puny_smelting_4",
    puny_smelting_4: "ftb_tc:puny_smelting_5",
    puny_smelting_5: "ftb_tc:puny_smelting_6",
    puny_smelting_6: "ftb_tc:puny_smelting_7",
    puny_smelting_7: "ftb_tc:puny_smelting_8",
    puny_smelting_8: "ftb_tc:puny_smelting_9",
    puny_smelting_9: "ftb_tc:puny_smelting_10",
    puny_smelting_10: "ftb_tc:puny_smelting_11",
    puny_smelting_11: "ftb_tc:puny_smelting_12",
    puny_smelting_12: "ftb_tc:puny_smelting_13",
    puny_smelting_13: "ftb_tc:puny_smelting_14",
    puny_smelting_14: "ftb_tc:puny_smelting_15",
    puny_smelting_15: "ftb_tc:puny_smelting_16",
    puny_smelting_16: "ftb_tc:puny_smelting",
    mighty_smelting: "ftb_tc:mighty_smelting_0",
    mighty_smelting_0: "ftb_tc:mighty_smelting_1",
    mighty_smelting_1: "ftb_tc:mighty_smelting_2",
    mighty_smelting_2: "ftb_tc:mighty_smelting_3",
    mighty_smelting_3: "ftb_tc:mighty_smelting_4",
    mighty_smelting_4: "ftb_tc:mighty_smelting_5",
    mighty_smelting_5: "ftb_tc:mighty_smelting_6",
    mighty_smelting_6: "ftb_tc:mighty_smelting_7",
    mighty_smelting_7: "ftb_tc:mighty_smelting_8",
    mighty_smelting_8: "ftb_tc:mighty_smelting_9",
    mighty_smelting_9: "ftb_tc:mighty_smelting_10",
    mighty_smelting_10: "ftb_tc:mighty_smelting_11",
    mighty_smelting_11: "ftb_tc:mighty_smelting_12",
    mighty_smelting_12: "ftb_tc:mighty_smelting_13",
    mighty_smelting_13: "ftb_tc:mighty_smelting_14",
    mighty_smelting_14: "ftb_tc:mighty_smelting_15",
    mighty_smelting_15: "ftb_tc:mighty_smelting_16",
    mighty_smelting_16: "ftb_tc:mighty_smelting_17",
    mighty_smelting_17: "ftb_tc:mighty_smelting_18",
    mighty_smelting_18: "ftb_tc:mighty_smelting",
    modifiers: "ftb_tc:modifiers_0",
    modifiers_0: "ftb_tc:modifiers_1",
    modifiers_1: "ftb_tc:modifiers_2",
    modifiers_2: "ftb_tc:modifiers_3",
    modifiers_3: "ftb_tc:modifiers_4",
    modifiers_4: "ftb_tc:modifiers_5",
    modifiers_5: "ftb_tc:modifiers_6",
    modifiers_6: "ftb_tc:modifiers_7",
    modifiers_7: "ftb_tc:modifiers_8",
    modifiers_8: "ftb_tc:modifiers",
};
const BookPrev = {
    materials_and_you_0: "ftb_tc:materials_and_you",
    materials_and_you_1: "ftb_tc:materials_and_you_0",
    materials_and_you_2: "ftb_tc:materials_and_you_1",
    materials_and_you_3: "ftb_tc:materials_and_you_2",
    materials_and_you_4: "ftb_tc:materials_and_you_3",
    materials_and_you_5: "ftb_tc:materials_and_you_4",
    materials_and_you_6: "ftb_tc:materials_and_you_5",
    materials_and_you_7: "ftb_tc:materials_and_you_6",
    materials_and_you_8: "ftb_tc:materials_and_you_7",
    materials_and_you_9: "ftb_tc:materials_and_you_8",
    materials_and_you_10: "ftb_tc:materials_and_you_9",
    materials_and_you_11: "ftb_tc:materials_and_you_10",
    materials_and_you_12: "ftb_tc:materials_and_you_11",
    materials_and_you_13: "ftb_tc:materials_and_you_12",
    materials_and_you_14: "ftb_tc:materials_and_you_13",
    materials_and_you_15: "ftb_tc:materials_and_you_14",
    materials_and_you_16: "ftb_tc:materials_and_you_15",
    materials_and_you_17: "ftb_tc:materials_and_you_16",
    materials_and_you_18: "ftb_tc:materials_and_you_17",
    materials_and_you_19: "ftb_tc:materials_and_you_18",
    materials_and_you_20: "ftb_tc:materials_and_you_19",
    gadgetry_0: "ftb_tc:gadgetry",
    gadgetry_1: "ftb_tc:gadgetry_0",
    gadgetry_2: "ftb_tc:gadgetry_1",
    gadgetry_3: "ftb_tc:gadgetry_2",
    gadgetry_4: "ftb_tc:gadgetry_3",
    gadgetry_5: "ftb_tc:gadgetry_4",
    gadgetry_6: "ftb_tc:gadgetry_5",
    gadgetry_7: "ftb_tc:gadgetry_6",
    gadgetry_8: "ftb_tc:gadgetry_7",
    gadgetry_9: "ftb_tc:gadgetry_8",
    gadgetry_10: "ftb_tc:gadgetry_9",
    gadgetry_11: "ftb_tc:gadgetry_10",
    gadgetry_12: "ftb_tc:gadgetry_11",
    gadgetry_13: "ftb_tc:gadgetry_12",
    gadgetry_14: "ftb_tc:gadgetry_13",
    gadgetry_15: "ftb_tc:gadgetry_14",
    gadgetry_16: "ftb_tc:gadgetry_15",
    gadgetry_17: "ftb_tc:gadgetry_16",
    gadgetry_18: "ftb_tc:gadgetry_17",
    gadgetry_19: "ftb_tc:gadgetry_18",
    puny_smelting_0: "ftb_tc:puny_smelting",
    puny_smelting_1: "ftb_tc:puny_smelting_0",
    puny_smelting_2: "ftb_tc:puny_smelting_1",
    puny_smelting_3: "ftb_tc:puny_smelting_2",
    puny_smelting_4: "ftb_tc:puny_smelting_3",
    puny_smelting_5: "ftb_tc:puny_smelting_4",
    puny_smelting_6: "ftb_tc:puny_smelting_5",
    puny_smelting_7: "ftb_tc:puny_smelting_6",
    puny_smelting_8: "ftb_tc:puny_smelting_7",
    puny_smelting_9: "ftb_tc:puny_smelting_8",
    puny_smelting_10: "ftb_tc:puny_smelting_9",
    puny_smelting_11: "ftb_tc:puny_smelting_10",
    puny_smelting_12: "ftb_tc:puny_smelting_11",
    puny_smelting_13: "ftb_tc:puny_smelting_12",
    puny_smelting_14: "ftb_tc:puny_smelting_13",
    puny_smelting_15: "ftb_tc:puny_smelting_14",
    puny_smelting_16: "ftb_tc:puny_smelting_15",
    mighty_smelting_0: "ftb_tc:mighty_smelting",
    mighty_smelting_1: "ftb_tc:mighty_smelting_0",
    mighty_smelting_2: "ftb_tc:mighty_smelting_1",
    mighty_smelting_3: "ftb_tc:mighty_smelting_2",
    mighty_smelting_4: "ftb_tc:mighty_smelting_3",
    mighty_smelting_5: "ftb_tc:mighty_smelting_4",
    mighty_smelting_6: "ftb_tc:mighty_smelting_5",
    mighty_smelting_7: "ftb_tc:mighty_smelting_6",
    mighty_smelting_8: "ftb_tc:mighty_smelting_7",
    mighty_smelting_9: "ftb_tc:mighty_smelting_8",
    mighty_smelting_10: "ftb_tc:mighty_smelting_9",
    mighty_smelting_11: "ftb_tc:mighty_smelting_10",
    mighty_smelting_12: "ftb_tc:mighty_smelting_11",
    mighty_smelting_13: "ftb_tc:mighty_smelting_12",
    mighty_smelting_14: "ftb_tc:mighty_smelting_13",
    mighty_smelting_15: "ftb_tc:mighty_smelting_14",
    mighty_smelting_16: "ftb_tc:mighty_smelting_15",
    mighty_smelting_17: "ftb_tc:mighty_smelting_16",
    mighty_smelting_18: "ftb_tc:mighty_smelting_17",
    modifiers_0: "ftb_tc:modifiers",
    modifiers_1: "ftb_tc:modifiers_0",
    modifiers_2: "ftb_tc:modifiers_1",
    modifiers_3: "ftb_tc:modifiers_2",
    modifiers_4: "ftb_tc:modifiers_3",
    modifiers_5: "ftb_tc:modifiers_4",
    modifiers_6: "ftb_tc:modifiers_5",
    modifiers_7: "ftb_tc:modifiers_6",
    modifiers_8: "ftb_tc:modifiers_7",
};
world.beforeEvents.itemUse.subscribe((data) => {
    let player = data.source;
    const itemFullName = data.itemStack.typeId;
    const itemName = itemFullName.split(":")[1];
    if (BookNext[itemName] && player.isSneaking == false) {
        system.run(() => {
            R.overrideHeldItem(player, new ItemStack(BookNext[itemName]));
            player.runCommand("playsound item.book.page_turn @a ~~~");
        });
    }
    if (BookPrev[itemName] && player.isSneaking == true) {
        system.run(() => {
            R.overrideHeldItem(player, new ItemStack(BookPrev[itemName]));
            player.runCommand("playsound item.book.page_turn @a ~~~");
        });
    }
    if (data.itemStack.typeId == "ftb_tc:materials_and_you" &&
        player.isSneaking == true) {
        system.run(() => material_chapter(player));
    }
    if (data.itemStack.typeId == "ftb_tc:gadgetry" && player.isSneaking == true) {
        system.run(() => gadgetry_chapter(player));
    }
    if (data.itemStack.typeId == "ftb_tc:puny_smelting" &&
        player.isSneaking == true) {
        system.run(() => puny_smelting_chapter(player));
    }
    if (data.itemStack.typeId == "ftb_tc:mighty_smelting" &&
        player.isSneaking == true) {
        system.run(() => mighty_chapter(player));
    }
    if (data.itemStack.typeId == "ftb_tc:modifiers" &&
        player.isSneaking == true) {
        system.run(() => modifiers_chapter(player));
    }
});
function material_chapter(player) {
    const form = new ActionFormData()
        .title("Explore Materials and You!")
        .body("Choose a chapter to unlock the secrets of Tinkers' Construct")
        .button("Introduction", "textures/ftb/tinkers/items/patterns/pattern_blank")
        .button("Tier 1 Materials", "textures/items/leather")
        .button("Tools", "textures/ftb/tinkers/items/tools/tpk_coba_7535b9")
        .button("Material Traits", "textures/items/bone")
        .button("Tool Damage & Repair", "textures/ftb/tinkers/items/repair_kits/stone")
        .button("Tin", "textures/ftb/tinkers/items/materials/tin_ingot")
        .button("Further Reading", "textures/ftb/tinkers/items/tinkers_gadgetry")
        .button("Credits", "textures/items/banner_pattern")
        .button("§r§f§4Exit\n§7[ Click to Close ]");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_2");
            });
        }
        if (r.selection == 1) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_7");
            });
        }
        if (r.selection == 2) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_9");
            });
        }
        if (r.selection == 3) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_14");
            });
        }
        if (r.selection == 4) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_15");
            });
        }
        if (r.selection == 5) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_17");
            });
        }
        if (r.selection == 6) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_18");
            });
        }
        if (r.selection == 7) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:materials_and_you_20");
            });
        }
    });
}
function gadgetry_chapter(player) {
    const form = new ActionFormData()
        .title("Explore Tinkers' Gadgetry!")
        .body("Choose a chapter to unlock the secrets of Tinkers' Gadgetry!")
        .button("Introduction", "textures/ftb/tinkers/items/materials/sky_slime_ball")
        .button("Slime Islands", "textures/ftb/tinkers/blocks/slime/sapling_ender")
        .button("Slime Slings", "textures/ftb/tinkers/items/gadgets/earth_slime_sling")
        .button("Throwables", "textures/ftb/tinkers/items/gadgets/quartz_shuriken")
        .button("Armour", "textures/ftb/tinkers/items/armours/cobalt_helmet")
        .button("Potions", "textures/ftb/tinkers/items/potions/earth_slime_potion")
        .button("Drying Rack", "textures/ftb/tinkers/items/drying_rack")
        .button("Berry Bushes", "textures/ftb/tinkers/items/berries/copper_berries")
        .button("Cheese", "textures/ftb/tinkers/items/cheese_ingot")
        .button("§r§f§4Exit\n§7[ Click to Close ]");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_2");
            });
        }
        if (r.selection == 1) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_3");
            });
        }
        if (r.selection == 2) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_7");
            });
        }
        if (r.selection == 3) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_9");
            });
        }
        if (r.selection == 4) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_11");
            });
        }
        if (r.selection == 5) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_14");
            });
        }
        if (r.selection == 6) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_15");
            });
        }
        if (r.selection == 7) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_16");
            });
        }
        if (r.selection == 8) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:gadgetry_18");
            });
        }
    });
}
function puny_smelting_chapter(player) {
    const form = new ActionFormData()
        .title("Explore Puny Smelting!")
        .body("Choose a chapter to unlock the secrets of Puny Smelting.")
        .button("Introduction", "textures/ftb/tinkers/items/puny_smelting")
        .button("Grout & Seared Bricks", "textures/ftb/tinkers/items/materials/seared_brick")
        .button("The Melter", "textures/ftb/tinkers/items/smeltery/melter")
        .button("Moving Fluids", "textures/ftb/tinkers/items/can/copper_can_iron")
        .button("Casting", "textures/ftb/tinkers/items/casts/cast_pickaxe")
        .button("Alloy Crafting", "textures/ftb/tinkers/items/materials/raw/raw_pig_iron")
        .button("Tier 2 Materials", "textures/ftb/tinkers/items/materials/pig_iron_ingot")
        .button("Tier 2 Material Traits", "textures/ftb/tinkers/items/materials/rose_gold_ingot")
        .button("Mighty Smelting", "textures/ftb/tinkers/items/mighty_smelting")
        .button("§r§f§4Exit\n§7[ Click to Close ]");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_1");
            });
        }
        if (r.selection == 1) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_2");
            });
        }
        if (r.selection == 2) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_4");
            });
        }
        if (r.selection == 3) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_5");
            });
        }
        if (r.selection == 4) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_8");
            });
        }
        if (r.selection == 5) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_12");
            });
        }
        if (r.selection == 6) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_13");
            });
        }
        if (r.selection == 7) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_15");
            });
        }
        if (r.selection == 8) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:puny_smelting_16");
            });
        }
    });
}
function mighty_chapter(player) {
    const form = new ActionFormData()
        .title("Explore Mighty Smelting!")
        .body("Choose a chapter to unlock the secrets of Tinkers' Construct")
        .button("Introduction", "textures/ftb/tinkers/items/mighty_smelting")
        .button("Tinkers Anvil", "textures/ftb/tinkers/items/smelters_anvil")
        .button("Smeltery Components", "textures/ftb/tinkers/items/smeltery/seared_drain")
        .button("Building the Smeltery", "textures/ftb/tinkers/items/smeltery/controller")
        .button("Using the Smeltery", "textures/ftb/tinkers/items/smeltery/seared_tank")
        .button("Alloys", "textures/ftb/tinkers/items/alloy_crafter")
        .button("The Nether", "textures/ftb/tinkers/items/heads/blaze_head")
        .button("Tier 3 Materials", "textures/ftb/tinkers/items/materials/cobalt_ingot")
        .button("Blazing Lava", "textures/ftb/tinkers/items/bucket/bucket_blaze")
        .button("Tier 4 Materials", "textures/ftb/tinkers/items/materials/queens_slime_ingot")
        .button("Tier 3 & 4 \nMaterial Traits", "textures/ftb/tinkers/items/materials/manyullyn_ingot")
        .button("§r§f§4Exit\n§7[ Click to Close ]");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_1");
            });
        }
        if (r.selection == 1) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_2");
            });
        }
        if (r.selection == 2) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_4");
            });
        }
        if (r.selection == 3) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_6");
            });
        }
        if (r.selection == 4) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_7");
            });
        }
        if (r.selection == 5) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_9");
            });
        }
        if (r.selection == 6) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_10");
            });
        }
        if (r.selection == 7) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_11");
            });
        }
        if (r.selection == 8) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_14");
            });
        }
        if (r.selection == 9) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_15");
            });
        }
        if (r.selection == 10) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:mighty_smelting_18");
            });
        }
    });
}
function modifiers_chapter(player) {
    const form = new ActionFormData()
        .title("Explore Mighty Smelting!")
        .body("Choose a chapter to unlock the secrets of Tinkers' Construct")
        .button("Introduction", "textures/ftb/tinkers/items/modifiers")
        .button("Crafting", "textures/blocks/crafting_table_top")
        .button("Modifiers", "textures/ftb/tinkers/items/modifiers/empty_modifier")
        .button("Worktable", "textures/ftb/tinkers/items/worktable")
        .button("Remove Modifiers", "textures/ftb/tinkers/items/modifiers/remove_modifier")
        .button("Final Notes", "textures/items/pattern")
        .button("§r§f§4Exit\n§7[ Click to Close ]");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:modifiers_2");
            });
        }
        if (r.selection == 1) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:modifiers_3");
            });
        }
        if (r.selection == 2) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:modifiers_4");
            });
        }
        if (r.selection == 3) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:modifiers_6");
            });
        }
        if (r.selection == 4) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:modifiers_7");
            });
        }
        if (r.selection == 5) {
            system.run(() => {
                player.runCommand("replaceitem entity @s slot.weapon.mainhand 0 ftb_tc:modifiers_8");
            });
        }
    });
}
