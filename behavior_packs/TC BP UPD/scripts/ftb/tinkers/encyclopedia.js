import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';

world.beforeEvents.itemUse.subscribe((data) => {
    let player = data.source;
    if (data.itemStack.typeId == "ftb_tc:encyclopedia") {
        system.run(() => encyclopedia_main(player));
    }
});
function encyclopedia_main(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.main.title", with: ["\n"] })
        .body({ translate: "encyclopedia.main.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.intro", with: ["\n"] }, "textures/ui/icon_book_writable")
        .button({ translate: "encyclopedia.button.tools", with: ["\n"] }, "textures/ui/icon_iron_pickaxe")
        .button({ translate: "encyclopedia.button.tier1", with: ["\n"] }, "textures/ftb/tinkers/books/dust_selectable_1")
        .button({ translate: "encyclopedia.button.tier2", with: ["\n"] }, "textures/ftb/tinkers/books/dust_selectable_2")
        .button({ translate: "encyclopedia.button.tier3", with: ["\n"] }, "textures/ftb/tinkers/books/dust_selectable_3")
        .button({ translate: "encyclopedia.button.tier4", with: ["\n"] }, "textures/ftb/tinkers/books/dust_selectable_4")
        .button({ translate: "encyclopedia.button.exit", with: ["\n"] }, "textures/ui/redX1");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_intro(player));
        }
        if (r.selection == 1) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 2) {
            system.run(() => encyclopedia_tier1(player));
        }
        if (r.selection == 3) {
            system.run(() => encyclopedia_tier2(player));
        }
        if (r.selection == 4) {
            system.run(() => encyclopedia_tier3(player));
        }
        if (r.selection == 5) {
            system.run(() => encyclopedia_tier4(player));
        }
    });
}
function encyclopedia_intro(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.intro", with: ["\n"] })
        .body({ translate: "encyclopedia.intro.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_main(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_main(player));
        }
    });
}
function encyclopedia_pickaxe(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.pickaxe", with: ["\n"] })
        .body({ translate: "encyclopedia.pickaxe.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_tools(player));
        }
    });
}
function encyclopedia_axe(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.axe", with: ["\n"] })
        .body({ translate: "encyclopedia.axe.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_tools(player));
        }
    });
}
function encyclopedia_shoel(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.shoel", with: ["\n"] })
        .body({ translate: "encyclopedia.shoel.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_tools(player));
        }
    });
}
function encyclopedia_dagger(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.dagger", with: ["\n"] })
        .body({ translate: "encyclopedia.dagger.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_tools(player));
        }
    });
}
function encyclopedia_sword(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.sword", with: ["\n"] })
        .body({ translate: "encyclopedia.sword.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_tools(player));
        }
    });
}
function encyclopedia_cleaver(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.cleaver", with: ["\n"] })
        .body({ translate: "encyclopedia.cleaver.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_tools(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_tools(player));
        }
    });
}
function encyclopedia_tools(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.tools.title", with: ["\n"] })
        .body({ translate: "encyclopedia.tools.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.pickaxe", with: ["\n"] }, "textures/ftb/tinkers/items/tools/tpk_a_bron_eab7f5")
        .button({ translate: "encyclopedia.button.axe", with: ["\n"] }, "textures/ftb/tinkers/items/tools/tax_r_gold_ca6d5b")
        .button({ translate: "encyclopedia.button.shoel", with: ["\n"] }, "textures/ftb/tinkers/items/tools/tsh_ardi_4de192")
        .button({ translate: "encyclopedia.button.dagger", with: ["\n"] }, "textures/ftb/tinkers/items/tools/tdg_iron_5bcf5f")
        .button({ translate: "encyclopedia.button.sword", with: ["\n"] }, "textures/ftb/tinkers/items/tools/ts_bone_ba194b")
        .button({ translate: "encyclopedia.button.cleaver", with: ["\n"] }, "textures/ftb/tinkers/items/tools/tcl_a_bron_1a948d")
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_main(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_pickaxe(player));
        }
        if (r.selection == 1) {
            system.run(() => encyclopedia_axe(player));
        }
        if (r.selection == 2) {
            system.run(() => encyclopedia_shoel(player));
        }
        if (r.selection == 3) {
            system.run(() => encyclopedia_dagger(player));
        }
        if (r.selection == 4) {
            system.run(() => encyclopedia_sword(player));
        }
        if (r.selection == 5) {
            system.run(() => encyclopedia_cleaver(player));
        }
        if (r.selection == 6) {
            system.run(() => encyclopedia_main(player));
        }
    });
}
function encyclopedia_tier1(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.tier1.title", with: ["\n"] })
        .body({ translate: "encyclopedia.tier1.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.wood", with: ["\n"] }, "textures/blocks/planks_oak")
        .button({ translate: "encyclopedia.button.stone", with: ["\n"] }, "textures/blocks/stone")
        .button({ translate: "encyclopedia.button.bone", with: ["\n"] }, "textures/items/bone")
        .button({ translate: "encyclopedia.button.tier1_traits", with: ["\n"] }, "textures/ui/RTX_Sparkle")
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_main(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_wood(player));
        }
        if (r.selection == 1) {
            system.run(() => encyclopedia_stone(player));
        }
        if (r.selection == 2) {
            system.run(() => encyclopedia_bone(player));
        }
        if (r.selection == 3) {
            system.run(() => encyclopedia_tier1_traits(player));
        }
        if (r.selection == 4) {
            system.run(() => encyclopedia_main(player));
        }
    });
}
function encyclopedia_wood(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.wood", with: ["\n"] })
        .body({ translate: "encyclopedia.wood.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier1(player));
        }
    });
}
function encyclopedia_stone(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.stone", with: ["\n"] })
        .body({ translate: "encyclopedia.stone.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier1(player));
        }
    });
}
function encyclopedia_bone(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.bone", with: ["\n"] })
        .body({ translate: "encyclopedia.bone.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier1(player));
        }
    });
}
function encyclopedia_tier1_traits(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.tier1_traits", with: ["\n"] })
        .body({ translate: "encyclopedia.tier1_traits.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier1(player));
        }
    });
}
function encyclopedia_tier2(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.tier2.title", with: ["\n"] })
        .body({ translate: "encyclopedia.tier2.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.iron", with: ["\n"] }, "textures/items/iron_ingot")
        .button({ translate: "encyclopedia.button.gold", with: ["\n"] }, "textures/items/gold_ingot")
        .button({ translate: "encyclopedia.button.pig_iron", with: ["\n"] }, "textures/ftb/tinkers/items/materials/pig_iron_ingot")
        .button({ translate: "encyclopedia.button.rose_gold", with: ["\n"] }, "textures/ftb/tinkers/items/materials/rose_gold_ingot")
        .button({ translate: "encyclopedia.button.tier2_traits", with: ["\n"] }, "textures/ui/RTX_Sparkle")
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_main(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_iron(player));
        }
        if (r.selection == 1) {
            system.run(() => encyclopedia_gold(player));
        }
        if (r.selection == 2) {
            system.run(() => encyclopedia_pig_iron(player));
        }
        if (r.selection == 3) {
            system.run(() => encyclopedia_rose_gold(player));
        }
        if (r.selection == 4) {
            system.run(() => encyclopedia_tier2_traits(player));
        }
        if (r.selection == 5) {
            system.run(() => encyclopedia_main(player));
        }
    });
}
function encyclopedia_iron(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.iron", with: ["\n"] })
        .body({ translate: "encyclopedia.iron.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier2(player));
        }
    });
}
function encyclopedia_gold(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.gold", with: ["\n"] })
        .body({ translate: "encyclopedia.gold.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier2(player));
        }
    });
}
function encyclopedia_pig_iron(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.pig_iron", with: ["\n"] })
        .body({ translate: "encyclopedia.pig_iron.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier2(player));
        }
    });
}
function encyclopedia_rose_gold(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.rose_gold", with: ["\n"] })
        .body({ translate: "encyclopedia.rose_gold.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier2(player));
        }
    });
}
function encyclopedia_tier2_traits(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.tier2_traits", with: ["\n"] })
        .body({ translate: "encyclopedia.tier2_traits.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier2(player));
        }
    });
}
function encyclopedia_tier3(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.tier3.title", with: ["\n"] })
        .body({ translate: "encyclopedia.tier3.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.amethyst_bronze", with: ["\n"] }, "textures/ftb/tinkers/items/materials/amethyst_bronze_ingot")
        .button({ translate: "encyclopedia.button.diamond", with: ["\n"] }, "textures/items/diamond")
        .button({ translate: "encyclopedia.button.cobalt", with: ["\n"] }, "textures/ftb/tinkers/items/materials/cobalt_ingot")
        .button({ translate: "encyclopedia.button.slimesteel", with: ["\n"] }, "textures/ftb/tinkers/items/materials/slimesteel_ingot")
        .button({ translate: "encyclopedia.button.ardite", with: ["\n"] }, "textures/ftb/tinkers/items/materials/ardite_ingot")
        .button({ translate: "encyclopedia.button.tier3_traits", with: ["\n"] }, "textures/ui/RTX_Sparkle")
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_main(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_amethyst_bronze(player));
        }
        if (r.selection == 1) {
            system.run(() => encyclopedia_diamond(player));
        }
        if (r.selection == 2) {
            system.run(() => encyclopedia_cobalt(player));
        }
        if (r.selection == 3) {
            system.run(() => encyclopedia_slimesteel(player));
        }
        if (r.selection == 4) {
            system.run(() => encyclopedia_ardite(player));
        }
        if (r.selection == 5) {
            system.run(() => encyclopedia_tier3_traits(player));
        }
        if (r.selection == 6) {
            system.run(() => encyclopedia_main(player));
        }
    });
}
function encyclopedia_amethyst_bronze(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.amethyst_bronze", with: ["\n"] })
        .body({ translate: "encyclopedia.amethyst_bronze.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier3(player));
        }
    });
}
function encyclopedia_diamond(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.diamond", with: ["\n"] })
        .body({ translate: "encyclopedia.diamond.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier3(player));
        }
    });
}
function encyclopedia_cobalt(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.cobalt", with: ["\n"] })
        .body({ translate: "encyclopedia.cobalt.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier3(player));
        }
    });
}
function encyclopedia_slimesteel(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.slimesteel", with: ["\n"] })
        .body({ translate: "encyclopedia.slimesteel.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier3(player));
        }
    });
}
function encyclopedia_ardite(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.ardite", with: ["\n"] })
        .body({ translate: "encyclopedia.ardite.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier3(player));
        }
    });
}
function encyclopedia_tier3_traits(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.tier3_traits", with: ["\n"] })
        .body({ translate: "encyclopedia.tier3_traits.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier3(player));
        }
    });
}
function encyclopedia_tier4(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.tier4.title", with: ["\n"] })
        .body({ translate: "encyclopedia.tier4.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.queens_slime_ingot", with: ["\n"] }, "textures/ftb/tinkers/items/materials/queens_slime_ingot")
        .button({ translate: "encyclopedia.button.manyullyn", with: ["\n"] }, "textures/ftb/tinkers/items/materials/manyullyn_ingot")
        .button({ translate: "encyclopedia.button.hepatizon", with: ["\n"] }, "textures/ftb/tinkers/items/materials/hepatizon_ingot")
        .button({ translate: "encyclopedia.button.netherite", with: ["\n"] }, "textures/items/netherite_ingot")
        .button({ translate: "encyclopedia.button.tier4_traits", with: ["\n"] }, "textures/ui/RTX_Sparkle")
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.canceled) {
            system.run(() => encyclopedia_main(player));
        }
        if (r.selection == 0) {
            system.run(() => encyclopedia_queens_slime(player));
        }
        if (r.selection == 1) {
            system.run(() => encyclopedia_manyullyn(player));
        }
        if (r.selection == 2) {
            system.run(() => encyclopedia_hepatizon(player));
        }
        if (r.selection == 3) {
            system.run(() => encyclopedia_netherite(player));
        }
        if (r.selection == 4) {
            system.run(() => encyclopedia_tier4_traits(player));
        }
        if (r.selection == 6) {
            system.run(() => encyclopedia_main(player));
        }
    });
}
function encyclopedia_queens_slime(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.queens_slime", with: ["\n"] })
        .body({ translate: "encyclopedia.queens_slime.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier4(player));
        }
    });
}
function encyclopedia_manyullyn(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.manyullyn", with: ["\n"] })
        .body({ translate: "encyclopedia.manyullyn.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier4(player));
        }
    });
}
function encyclopedia_hepatizon(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.hepatizon", with: ["\n"] })
        .body({ translate: "encyclopedia.hepatizon.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier4(player));
        }
    });
}
function encyclopedia_netherite(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.netherite", with: ["\n"] })
        .body({ translate: "encyclopedia.netherite.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier4(player));
        }
    });
}
function encyclopedia_tier4_traits(player) {
    const form = new ActionFormData()
        .title({ translate: "encyclopedia.button.tier4_traits", with: ["\n"] })
        .body({ translate: "encyclopedia.tier4_traits.body", with: ["\n"] })
        .button({ translate: "encyclopedia.button.back", with: ["\n"] }, "textures/ui/recap_glyph_color_2x");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => encyclopedia_tier4(player));
        }
    });
}
