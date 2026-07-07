/** Tinkers Construct + sponge-like tools that bypass normal block break checks. */

export function isTinkersConstructItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    return (
        id.startsWith("ftb_tc:") ||
        id.startsWith("ftb:tc:") ||
        id.startsWith("tconstruct:")
    );
}

/** Tinkers blocks used to modify, repair, or rename tools. */
export function isTinkersWorkstationBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    const isTinkersBlock =
        id.startsWith("ftb_tc:") ||
        id.startsWith("ftb:tc:") ||
        id.startsWith("tconstruct:") ||
        id.includes("tinkers_construct");

    if (!isTinkersBlock && !id.includes("tinker")) return false;

    return (
        id.includes("table") ||
        id.includes("station") ||
        id.includes("anvil") ||
        id.includes("smith") ||
        id.includes("toolforge") ||
        id.includes("smeltery") ||
        id.includes("drain") ||
        id.includes("casting") ||
        id.includes("tank") ||
        id.includes("faucet") ||
        id.includes("modifi") ||
        id.includes("part_builder") ||
        id.includes("tinker")
    );
}

export function isSpongeLikeItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    return (
        id.includes("sponge") ||
        id === "minecraft:sponge" ||
        id === "minecraft:wet_sponge"
    );
}

/** Tinkers items that act as break-style tools (picks, hammers, swords, etc.).
 *  Excludes armor and food so those still work freely inside claims. */
export function isTinkersBreakStyleItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    const isTinkers = id.startsWith("ftb_tc:") || id.startsWith("ftb:tc:") || id.startsWith("tconstruct:");
    if (!isTinkers) return false;

    // Armor and consumables are not break-style tools.
    if (
        id.includes("helmet") || id.includes("chestplate") || id.includes("chest_plate") ||
        id.includes("legging") || id.includes("boot") || id.includes("armor") ||
        id.includes("food") || id.includes("stew") || id.includes("meal") || id.includes("salad")
    ) return false;

    const breakToolKeywords = [
        "pickaxe", "hammer", "excavator", "mattock", "vein_hammer", "broad_axe",
        "hand_axe", "shoel", "sword", "cleaver", "dagger", "scythe",
        "battleaxe", "tool",
    ];
    return breakToolKeywords.some((k) => id.includes(k));
}

export function isClaimBypassToolItem(typeId) {
    return isTinkersBreakStyleItem(typeId) || isSpongeLikeItem(typeId);
}

/** Plain item-use protection only applies to Tinkers break-style tools. */
export function isClaimBreakToolItemUse(typeId) {
    return isTinkersBreakStyleItem(typeId);
}

/** Which claim permission blocks this tool use (break-style tools). */
export function claimPermForToolUse(typeId) {
    return "protectBreak";
}
