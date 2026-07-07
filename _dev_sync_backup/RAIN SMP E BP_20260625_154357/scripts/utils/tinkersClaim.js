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

export function isClaimBypassToolItem(typeId) {
    return isTinkersConstructItem(typeId) || isSpongeLikeItem(typeId);
}

/** Which claim permission blocks this tool use (break-style tools). */
export function claimPermForToolUse(typeId) {
    return "protectBreak";
}
