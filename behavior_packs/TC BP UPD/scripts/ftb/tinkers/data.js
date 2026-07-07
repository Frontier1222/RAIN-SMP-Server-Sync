const boneEntityConversions = {
    "minecraft:zombie": "minecraft:skeleton",
    "minecraft:husk": "minecraft:skeleton",
    "minecraft:drowned": "minecraft:stray",
    "minecraft:pig": "minecraft:zoglin",
    "minecraft:horse": "minecraft:skeleton_horse"
};
const leatherExtraDrop = createChancedDrop("minecraft:leather", 0.33);
const tannedExtraDrops = {
    "minecraft:cow": leatherExtraDrop,
    "minecraft:mooshroom": leatherExtraDrop,
    "minecraft:llama": leatherExtraDrop,
    "minecraft:trader_llama": leatherExtraDrop,
    "minecraft:hoglin": leatherExtraDrop,
    "minecraft:horse": leatherExtraDrop,
    "minecraft:mule": leatherExtraDrop,
    "minecraft:rabbit": createChancedDrop("minecraft:rabbit_hide", 0.33),
};
const cleaverLootCommand = (table) => `loot spawn ~ ~ ~ loot "ftb/tinkers/cleaver/${table}"`;
const cleaverExtraDrops = {
    "minecraft:zombie": cleaverLootCommand("zombie"),
    "minecraft:skeleton": cleaverLootCommand("skeleton"),
    "minecraft:creeper": cleaverLootCommand("creeper"),
    "minecraft:blaze": cleaverLootCommand("blaze"),
    "minecraft:enderman": cleaverLootCommand("enderman"),
    "minecraft:stray": cleaverLootCommand("stray"),
    "minecraft:husk": cleaverLootCommand("husk"),
    "minecraft:drowned": cleaverLootCommand("drowned"),
    "minecraft:spider": cleaverLootCommand("spider"),
    "minecraft:cave_spider": cleaverLootCommand("cave_spider"),
    "minecraft:piglin_brute": cleaverLootCommand("piglin_brute"),
    "minecraft:zombie_pigman": cleaverLootCommand("zombie_pigman"),
    "minecraft:chicken": cleaverLootCommand("chicken"),
    "minecraft:cow": cleaverLootCommand("cow"),
    "minecraft:piglin": cleaverLootCommand("piglin"),
    "minecraft:mooshroom": cleaverLootCommand("mooshroom"),
    "minecraft:cod": cleaverLootCommand("cod"),
    "minecraft:glow_squid": cleaverLootCommand("glow_squid"),
    "minecraft:pig": cleaverLootCommand("pig"),
    "minecraft:pufferfish": cleaverLootCommand("pufferfish"),
    "minecraft:salmon": cleaverLootCommand("salmon"),
    "minecraft:sheep": cleaverLootCommand("sheep"),
    "minecraft:tropical_fish": cleaverLootCommand("tropical_fish"),
    "minecraft:turtle": cleaverLootCommand("turtle"),
    "minecraft:squid": cleaverLootCommand("squid"),
};
const arditeTablePrefix = "ftb/tinkers/ardite";
const charcoalTable = `${arditeTablePrefix}/charcoal`;
const smeltingDropTables = {
    // Logs
    "minecraft:oak_log": charcoalTable,
    "minecraft:spruce_log": charcoalTable,
    "minecraft:birch_log": charcoalTable,
    "minecraft:jungle_log": charcoalTable,
    "minecraft:acacia_log": charcoalTable,
    "minecraft:dark_oak_log": charcoalTable,
    "minecraft:mangrove_log": charcoalTable,
    "minecraft:cherry_log": charcoalTable,
    "ftb_tc:greenheart_log": charcoalTable,
    "ftb_tc:skyroot_log": charcoalTable,
    "ftb_tc:scarletshroom_log": charcoalTable,
    "minecraft:stripped_oak_log": charcoalTable,
    "minecraft:stripped_spruce_log": charcoalTable,
    "minecraft:stripped_birch_log": charcoalTable,
    "minecraft:stripped_jungle_log": charcoalTable,
    "minecraft:stripped_acacia_log": charcoalTable,
    "minecraft:stripped_dark_oak_log": charcoalTable,
    "minecraft:stripped_mangrove_log": charcoalTable,
    "minecraft:stripped_cherry_log": charcoalTable,
    "ftb_tc:greenheart_stripped_log": charcoalTable,
    "ftb_tc:skyroot_stripped_log": charcoalTable,
    "ftb_tc:scarletshroom_stripped_log": charcoalTable,
    // Not logs
    "minecraft:kelp": `${arditeTablePrefix}/dried_kelp`,
    "minecraft:sand": `${arditeTablePrefix}/glass`,
    "minecraft:cactus": `${arditeTablePrefix}/green_dye`,
    // Ores
    "minecraft:copper_ore": `${arditeTablePrefix}/ingot_copper`,
    "minecraft:deepslate_copper_ore": `${arditeTablePrefix}/ingot_copper`,
    "minecraft:gold_ore": `${arditeTablePrefix}/ingot_gold`,
    "minecraft:deepslate_gold_ore": `${arditeTablePrefix}/ingot_gold`,
    "minecraft:iron_ore": `${arditeTablePrefix}/ingot_iron`,
    "minecraft:deepslate_iron_ore": `${arditeTablePrefix}/ingot_iron`,
    "ftb_tc:ardite_ore": `${arditeTablePrefix}/ingot_ardite`,
    "ftb_tc:cobalt_ore": `${arditeTablePrefix}/ingot_cobalt`,
    // Not ores
    "minecraft:sea_pickle": `${arditeTablePrefix}/lime_dye`,
    "minecraft:netherrack": `${arditeTablePrefix}/netherbrick`,
    "minecraft:ancient_debris": `${arditeTablePrefix}/netherite_scrap`,
    "minecraft:chorus_flower": `${arditeTablePrefix}/popped_chorus`,
    "minecraft:cobblestone": `${arditeTablePrefix}/stone`,
    "minecraft:stone": `${arditeTablePrefix}/stone`,
    "minecraft:clay": `${arditeTablePrefix}/bricks`,
    "minecraft:black_terracotta": `${arditeTablePrefix}/black_terracotta`,
    "minecraft:blue_terracotta": `${arditeTablePrefix}/blue_terracotta`,
    "minecraft:brown_terracotta": `${arditeTablePrefix}/brown_terracotta`,
    "minecraft:cyan_terracotta": `${arditeTablePrefix}/cyan_terracotta`,
    "minecraft:green_terracotta": `${arditeTablePrefix}/green_terracotta`,
    "minecraft:light_blue_terracotta": `${arditeTablePrefix}/light_blue_terracotta`,
    "minecraft:lime_terracotta": `${arditeTablePrefix}/lime_terracotta`,
    "minecraft:magenta_terracotta": `${arditeTablePrefix}/magenta_terracotta`,
    "minecraft:orange_terracotta": `${arditeTablePrefix}/orange_terracotta`,
    "minecraft:pink_terracotta": `${arditeTablePrefix}/pink_terracotta`,
    "minecraft:purple_terracotta": `${arditeTablePrefix}/purple_terracotta`,
    "minecraft:red_terracotta": `${arditeTablePrefix}/red_terracotta`,
    "minecraft:light_gray_terracotta": `${arditeTablePrefix}/silver_terracotta`,
    "minecraft:white_terracotta": `${arditeTablePrefix}/white_terracotta`,
    "minecraft:yellow_terracotta": `${arditeTablePrefix}/yellow_terracotta`,
    "minecraft:gray_terracotta": `${arditeTablePrefix}/gray_terracotta`,
    "minecraft:basalt": `${arditeTablePrefix}/basalt`,
    "minecraft:sandstone": `${arditeTablePrefix}/sandstone`,
    "minecraft:red_sandstone": `${arditeTablePrefix}/red_sandstone`,
    "minecraft:sponge": `${arditeTablePrefix}/sponge`,
    "ftb_tc:grout": `${arditeTablePrefix}/grout`,
};
const unexpectedDropsConversion = {
    "minecraft:stone": "minecraft:cobblestone",
    "minecraft:raw_iron": "minecraft:iron_ore",
    "minecraft:raw_gold": "minecraft:gold_ore",
    "minecraft:raw_copper": "minecraft:copper_ore",
    "minecraft:clay": "minecraft:clay_ball",
    "ftb_tc:raw_ardite": "ftb_tc:ardite_ore",
    "ftb_tc:raw_cobalt": "ftb_tc:cobalt_ore",
};
const smeltingConflictBlacklist = [
    "minecraft:andesite",
    "minecraft:diorite",
    "minecraft:granite"
];
const summonerEntitySpawns = {
    "minecraft:stone": "minecraft:silverfish",
    "minecraft:end_stone": "minecraft:endermite",
};
const cropToDropTable = {
    "minecraft:wheat": "minecraft:wheat",
    "minecraft:carrots": "minecraft:carrot",
    "minecraft:potatoes": "minecraft:potato",
    "minecraft:beetroot": "minecraft:beetroot",
    "minecraft:melon_block": "minecraft:melon_slice",
    "minecraft:pumpkin": "minecraft:pumpkin_seeds",
    "minecraft:cocoa": "minecraft:cocoa_beans",
    "minecraft:leaves": "minecraft:apple",
    "minecraft:brown_mushroom_block": "minecraft:brown_mushroom",
    "minecraft:red_mushroom_block": "minecraft:red_mushroom",
};
const extraXpDropBlocks = [
    "minecraft:quartz_ore",
    "minecraft:coal_ore",
    "minecraft:deepslate_coal_ore",
    "minecraft:copper_ore",
    "minecraft:deepslate_copper_ore",
    "minecraft:lapis_ore",
    "minecraft:deepslate_lapis_ore",
    "minecraft:sculk"
];
/**
 * Create a chanced drop
 */
function createChancedDrop(item, chance) {
    return {
        chance: chance,
        item: item
    };
}

export { boneEntityConversions, cleaverExtraDrops, cropToDropTable, extraXpDropBlocks, smeltingConflictBlacklist, smeltingDropTables, summonerEntitySpawns, tannedExtraDrops, unexpectedDropsConversion };
