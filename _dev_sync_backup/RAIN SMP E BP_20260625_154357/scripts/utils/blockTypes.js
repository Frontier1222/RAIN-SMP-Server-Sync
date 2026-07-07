import { isTinkersWorkstationBlock } from "./tinkersClaim.js";

const WORKSTATION_BLOCK_IDS = new Set([
    "minecraft:anvil",
    "minecraft:chipped_anvil",
    "minecraft:damaged_anvil",
    "minecraft:grindstone",
    "minecraft:enchanting_table",
    "minecraft:smithing_table",
    "minecraft:loom",
    "minecraft:cartography_table",
    "minecraft:stonecutter",
]);

export function isAnvilBlock(blockId) {
    return WORKSTATION_BLOCK_IDS.has(String(blockId || "").toLowerCase());
}

/** Workstations used for renaming, enchanting, smithing, etc. — never treat as storage containers. */
export function isClaimWorkstationBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    return WORKSTATION_BLOCK_IDS.has(id) || isTinkersWorkstationBlock(id);
}

/** Standing, wall, and hanging sign blocks. */
export function isSignBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    return id.includes("sign") || id.includes("hanging_sign");
}

/** Shelves / lecterns / bookshelves — not signs (sign text uses place trust, not decor interact). */
export function isDecorInteractBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    if (isSignBlock(id)) return false;

    return (
        id === "minecraft:chiseled_bookshelf" ||
        id.includes("shelf") ||
        id.includes("bookshelf") ||
        id.includes("lectern")
    );
}

/** Storage blocks with inventories — not workstations like anvils or enchanting tables. */
export function isStorageContainerBlock(blockId) {
    const id = String(blockId || "").toLowerCase();

    const containerTypes = [
        "minecraft:chest",
        "minecraft:trapped_chest",
        "minecraft:barrel",
        "minecraft:ender_chest",
        "minecraft:furnace",
        "minecraft:blast_furnace",
        "minecraft:smoker",
        "minecraft:dropper",
        "minecraft:dispenser",
        "minecraft:hopper",
        "minecraft:brewing_stand",
        "minecraft:beacon",
        "minecraft:crafter",
    ];

    return (
        containerTypes.includes(id) ||
        id.includes("copper_chest") ||
        id.includes("shulker_box")
    );
}

/** Blocks builders/testers must not open/use in creative (containers, workstations, shelves, mod tables). */
export function isRestrictedUsableBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    if (!id) return false;

    if (isStorageContainerBlock(id)) return true;

    // Claim workstations stay usable for renames, enchanting, smithing, etc.
    if (isClaimWorkstationBlock(id)) return false;

    return (
        id.includes("bookshelf") ||
        id.includes("_shelf") ||
        id.endsWith(":shelf") ||
        id.includes("lectern") ||
        id.includes("tinker") ||
        id.includes("tinkers") ||
        id.includes("tconstruct") ||
        id.includes("crafting_table") ||
        id.includes("composter") ||
        id.includes("beehive") ||
        id.includes("bee_nest") ||
        id.includes("cauldron") ||
        id.includes("campfire") ||
        id.includes("jukebox") ||
        id.includes("bell") ||
        id.includes("chiseled_bookshelf")
    );
}

export function isDecorPlacementBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    return (
        id.includes("item_frame") ||
        id.includes("glow_item_frame") ||
        id === "minecraft:frame" ||
        id === "minecraft:glow_frame" ||
        id.includes("armor_stand")
    );
}

export function isAxeItem(itemId) {
    const id = String(itemId || "").toLowerCase();
    return id.endsWith("_axe");
}

const LIQUID_BUCKET_IDS = new Set([
    "minecraft:water_bucket",
    "minecraft:lava_bucket",
    "minecraft:powder_snow_bucket",
    "ulkd_ess:water_bucket",
    "ulkd_ess:lava_bucket",
]);

/** Filled buckets that place liquids (vanilla + essentials big buckets). */
export function isLiquidBucketItem(itemId) {
    const id = String(itemId || "").toLowerCase();
    if (!id || id === "minecraft:bucket") return false;
    if (LIQUID_BUCKET_IDS.has(id)) return true;
    if (id.endsWith("_water_bucket") || id.endsWith("_lava_bucket")) return true;
    if (id.includes("water_bucket") || id.includes("lava_bucket")) return true;
    if (id.includes("big_water") || id.includes("big_lava")) return true;
    return false;
}

const LIQUID_BLOCK_IDS = new Set([
    "minecraft:water",
    "minecraft:flowing_water",
    "minecraft:lava",
    "minecraft:flowing_lava",
]);

export function isLiquidBlock(blockId) {
    return LIQUID_BLOCK_IDS.has(String(blockId || "").toLowerCase());
}

/** Logs, wood, stems, hyphae, and bamboo blocks that can be stripped with an axe. */
export function isStrippableWoodBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    if (!id || id.includes("stripped")) return false;

    return (
        id.includes("_log") ||
        id.includes("_wood") ||
        id.endsWith("_stem") ||
        id.endsWith("_hyphae") ||
        id === "minecraft:bamboo_block"
    );
}

export function isGravestoneBlock(blockOrId) {
    const id = typeof blockOrId === "string" ? blockOrId : blockOrId?.typeId;
    return String(id || "").toLowerCase() === "ae_sg:gravestone";
}

/** Legacy ae_sg death graves — used only for cleanup. */
export function isDeathGravestone(block) {
    if (!isGravestoneBlock(block)) return false;

    try {
        return block.permutation?.getState("ae_sg:player_placed") === false;
    } catch (e) {
        return true;
    }
}
