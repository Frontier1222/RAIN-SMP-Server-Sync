import { GameMode, system } from "@minecraft/server";
import { getGlobalPlotAtLocation, getGlobalPlotsAtLocation } from "./plotClaimCache.js";
import {
    isStorageContainerBlock,
    isClaimWorkstationBlock,
    isRestrictedUsableBlock,
    isDecorPlacementBlock,
} from "./blockTypes.js";
import { isRainGuiItem } from "./rainGui.js";
import { notify } from "./realmPerf.js";
import { isStaffPlayer } from "../systems/ranks.js";

const CREATIVE_ROLE_TAG = "rain_creative_role";
const WORLD_BUILDER_ROLE_TAG = "world_builder";
const BUILDER_VAULT_ACTIVE_DP = "builder_vault_active";
export const HARDCODED_CREATIVE_BUILDER_NAMES = [
    "Unplugged1234",
    "CrownedChaos146",
    "Waffle rat5771",
];
const HARDCODED_CREATIVE_BUILDERS = new Set(
    HARDCODED_CREATIVE_BUILDER_NAMES.map((name) => name.trim().toLowerCase())
);
const HARDCODED_TESTERS = ["Itmecatt2058", "Ravenslash16"].map((name) => name.toLowerCase());
const playerGamemodes = new Map();

function gamemodeEnumToKey(mode) {
    if (mode == null) return null;
    if (mode === GameMode.creative || mode === GameMode.Creative) return "creative";
    if (mode === GameMode.survival || mode === GameMode.Survival) return "survival";
    if (mode === GameMode.adventure || mode === GameMode.Adventure) return "adventure";
    if (mode === GameMode.spectator || mode === GameMode.Spectator) return "spectator";

    const name = String(mode).toLowerCase();
    if (name.includes("creative")) return "creative";
    if (name.includes("survival")) return "survival";
    if (name.includes("adventure")) return "adventure";
    if (name.includes("spectator")) return "spectator";
    return null;
}

export function readPlayerGamemode(player) {
    if (!player) return "unknown";

    try {
        const raw = player.getGameMode?.() ?? player.gameMode;
        const key = gamemodeEnumToKey(raw);
        if (key) {
            playerGamemodes.set(player.id, key);
            return key;
        }
    } catch (e) { }

    return playerGamemodes.get(player.id) ?? "unknown";
}

export function rememberPlayerGamemode(player, modeKey) {
    if (!player?.id || !modeKey || modeKey === "unknown") return;
    playerGamemodes.set(player.id, modeKey);
}

export function getRememberedGamemode(player) {
    if (!player?.id) return undefined;
    return playerGamemodes.get(player.id);
}

export function forgetPlayerGamemode(playerId) {
    if (playerId) playerGamemodes.delete(playerId);
}

export function isTester(player) {
    return !!player && (player.hasTag("tester") || HARDCODED_TESTERS.includes(String(player.name || "").toLowerCase()));
}

function isTrueStaff(player) {
    return isStaffPlayer(player) && !isTester(player);
}

/** Staff bypass restrictions only when they are not an assigned builder/tester. */
function shouldBypassCreativeRestrictions(player) {
    if (!player) return true;
    if (isWorldBuilderRole(player)) return true;
    if (isCreativeBuilderTagged(player)) return false;
    if (isTester(player)) return false;
    return isTrueStaff(player);
}

export function isHardcodedCreativeBuilder(playerOrName) {
    const name = typeof playerOrName === "string" ? playerOrName : playerOrName?.name;
    return HARDCODED_CREATIVE_BUILDERS.has(String(name || "").trim().toLowerCase());
}

export function syncCreativeBuilderAccessTag(player) {
    if (!player) return false;

    const allowed = isHardcodedCreativeBuilder(player);
    const vaultActive = !!player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP);
    let changed = false;

    try {
        if (allowed && !player.hasTag("creative_builder")) {
            player.addTag("creative_builder");
            changed = true;
        } else if (!allowed && !vaultActive && player.hasTag("creative_builder")) {
            player.removeTag("creative_builder");
            changed = true;
        }
    } catch (e) {}

    return changed;
}

export function isCreativeBuilderTagged(player) {
    if (!player || isWorldBuilderRole(player)) return false;
    syncCreativeBuilderAccessTag(player);

    // Keep an old active vault session recognized until its inventory is restored.
    return isHardcodedCreativeBuilder(player) || !!player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP);
}

export function isWorldBuilderRole(player) {
    return !!player?.hasTag(WORLD_BUILDER_ROLE_TAG);
}

function hasBuilderOrTesterRole(player) {
    if (isWorldBuilderRole(player)) return false;
    return isTester(player) || isCreativeBuilderTagged(player);
}

function readDirectGamemodeKey(player) {
    if (!player) return null;
    try {
        const raw = player.getGameMode?.() ?? player.gameMode;
        return gamemodeEnumToKey(raw);
    } catch (e) {
        return null;
    }
}

export function isCreativeBuilderSessionActive(player) {
    return !!player?.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP);
}

/** Reliable creative detection for tagged builders — tag/session based, not rank. */
export function isCreativeBuilderInCreative(player) {
    if (!isCreativeBuilderTagged(player)) return isPlayerInCreative(player);
    if (player.hasTag(CREATIVE_ROLE_TAG)) return true;
    if (isCreativeBuilderSessionActive(player)) return true;
    if (getRememberedGamemode(player) === "creative") return true;
    if (readDirectGamemodeKey(player) === "creative") return true;
    return readPlayerGamemode(player) === "creative";
}

export function isPlayerInCreative(player) {
    if (!player) return false;
    if (player.hasTag(CREATIVE_ROLE_TAG)) return true;

    // Realm: stashed builder vault means creative session is active even when readback fails.
    if (isCreativeBuilderTagged(player) && player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP)) {
        return true;
    }

    const remembered = getRememberedGamemode(player);
    if (remembered === "creative") return true;

    const direct = readDirectGamemodeKey(player);
    if (direct === "creative") return true;

    return readPlayerGamemode(player) === "creative";
}

function primeRestrictedCreativeState(player) {
    if (!player || shouldBypassCreativeRestrictions(player)) return;
    if (!hasBuilderOrTesterRole(player)) return;

    syncCreativeRoleTag(player);

    const inCreative = isCreativeBuilderTagged(player)
        ? isCreativeBuilderInCreative(player)
        : isPlayerInCreative(player);
    if (!inCreative) return;
    if (player.hasTag(CREATIVE_ROLE_TAG)) return;

    try {
        player.addTag(CREATIVE_ROLE_TAG);
    } catch (e) { }
}

/** Sync tag from live gamemode — never strip an active builder session on flaky Realm readback. */
export function syncCreativeRoleTag(player) {
    if (!player || !hasBuilderOrTesterRole(player) || shouldBypassCreativeRestrictions(player)) return;

    const direct = readDirectGamemodeKey(player);
    const vaultActive = isCreativeBuilderTagged(player) && !!player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP);
    const rememberedCreative = getRememberedGamemode(player) === "creative";
    const sessionActive = vaultActive || (rememberedCreative && player.hasTag(CREATIVE_ROLE_TAG));
    const builderCreative =
        isCreativeBuilderTagged(player) &&
        (sessionActive || direct === "creative" || rememberedCreative);

    if (direct === "creative" || sessionActive || builderCreative) {
        if (!player.hasTag(CREATIVE_ROLE_TAG)) player.addTag(CREATIVE_ROLE_TAG);
        if (direct === "creative" || vaultActive || builderCreative) rememberPlayerGamemode(player, "creative");
        return;
    }

    if (direct && direct !== "creative" && !vaultActive) {
        if (player.hasTag(CREATIVE_ROLE_TAG)) player.removeTag(CREATIVE_ROLE_TAG);
        rememberPlayerGamemode(player, direct);
    }
}

export function setCreativeRoleTag(player, active) {
    if (!player || !hasBuilderOrTesterRole(player) || shouldBypassCreativeRestrictions(player)) return;
    if (active) {
        if (!player.hasTag(CREATIVE_ROLE_TAG)) player.addTag(CREATIVE_ROLE_TAG);
        rememberPlayerGamemode(player, "creative");
    } else if (player.hasTag(CREATIVE_ROLE_TAG)) {
        player.removeTag(CREATIVE_ROLE_TAG);
    }
}

export function isRestrictedCreativeRole(player) {
    if (!player || shouldBypassCreativeRestrictions(player)) return false;
    if (!hasBuilderOrTesterRole(player)) return false;
    if (isCreativeBuilderTagged(player)) return isCreativeBuilderInCreative(player);
    return isPlayerInCreative(player);
}

/** Reliable in beforeEvents — tag, remembered gamemode, or live read. */
export function shouldBlockCreativeRoleDrop(player) {
    if (!player || shouldBypassCreativeRestrictions(player)) return false;
    if (!hasBuilderOrTesterRole(player)) return false;
    if (isCreativeBuilderTagged(player)) return isCreativeBuilderInCreative(player);
    return isPlayerInCreative(player);
}

export function isAdminClaim(plot) {
    if (!plot) return false;

    const ownerName = String(plot.ownerName || "").toLowerCase();
    const ownerId = String(plot.ownerId || "").toLowerCase();

    return (
        ownerName === "server" ||
        ownerId === "server" ||
        plot.isAdminClaim === true ||
        plot.adminClaim === true ||
        plot.isServerClaim === true ||
        plot.serverClaim === true ||
        (plot.isSubclaim === true && (ownerId === "server" || ownerName === "server"))
    );
}

/** Claims staff flagged via Admin Claim Editor or subclaim "Allow Creative Builders". */
export function allowsCreativeBuilderPlot(plot) {
    if (!plot) return false;

    if (plot.allowCreativeBuilder === true || plot.allowCreativeBuilders === true) return true;
    if (plot.allowBuilder === true || plot.allowBuilders === true) return true;
    if (plot.allowCreative === true || plot.creativeAccess === true) return true;

    if (plot.permissions) {
        if (plot.permissions.allowCreativeBuilder === true || plot.permissions.allowBuilders === true) return true;
        if (plot.permissions.default) {
            if (plot.permissions.default.allowCreativeBuilder === true) return true;
            if (plot.permissions.default.allowBuilders === true) return true;
            if (plot.permissions.default.allowCreative === true) return true;
        }
    }

    return false;
}

function plotHasTesterBuildBypass(plot) {
    if (!plot) return false;
    if (plot.allowTesterBypass === true || plot.testerBypass === true) return true;
    return plot.permissions?.default?.allowTesterBypass === true;
}

function creativeBuildDeniedCopy(player, actionVerb, { includeBlocksWord = true } = {}) {
    const action = includeBlocksWord ? `${actionVerb} blocks` : actionVerb;
    if (isCreativeBuilderTagged(player)) {
        return {
            message: `You can only ${action} in Creative Builder claims while in Creative.`,
            hint: "Staff: enable builders on the claim in Admin Claim Editor",
        };
    }
    return {
        message: `You can only ${action} in Admin Claims or Tester-enabled claims while in Creative.`,
        hint: "Testers · admin claims or claim bypass required",
    };
}

export function canCreativeRoleBuildAt(player, location) {
    if (!isRestrictedCreativeRole(player)) return true;

    const dimId = player.dimension.id;
    const plots = getGlobalPlotsAtLocation(location, dimId);
    if (plots?.length) {
        return plots.some(
            (plot) =>
                allowsCreativeBuilderPlot(plot) ||
                (isTester(player) && plotHasTesterBuildBypass(plot))
        );
    }

    const plot = getGlobalPlotAtLocation(location, dimId);
    return (
        allowsCreativeBuilderPlot(plot) ||
        (isTester(player) && plotHasTesterBuildBypass(plot))
    );
}

export function denyRestrictedCreative(player, key, message, hint = "") {
    notify(player, key, `§r§c§l[RESTRICTED]§r §c${message}`, hint, "note.bass");
}

export function isRestrictedCreativeItem(itemId) {
    const id = String(itemId || "").toLowerCase();
    if (!id || isRainGuiItem({ typeId: id })) return false;

    return (
        id.includes("spawn_egg") ||
        id.includes("splash_potion") ||
        id.includes("lingering_potion") ||
        id.includes("experience_bottle") ||
        id.includes("armor_stand") ||
        id.includes("item_frame") ||
        id.includes("glow_item_frame") ||
        id === "minecraft:frame" ||
        id === "minecraft:glow_frame" ||
        id.includes("enchanted_book") ||
        id.includes("tnt") ||
        id.includes("end_crystal") ||
        id.includes("respawn_anchor")
    );
}

export function isRestrictedDecorEntity(typeId) {
    const id = String(typeId || "").toLowerCase();
    return (
        id.includes("item_frame") ||
        id.includes("glow_item_frame") ||
        id.includes("armor_stand")
    );
}

export function isRestrictedEntityContainer(typeId) {
    const id = String(typeId || "").toLowerCase();
    return (
        isRestrictedDecorEntity(id) ||
        id === "minecraft:allay" ||
        id.includes("donkey") ||
        id.includes("mule") ||
        id.includes("llama") ||
        id.includes("minecart") ||
        id.includes("villager") ||
        id.includes("npc")
    );
}

export function isRestrictedCreativeBreakBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    return (
        isStorageContainerBlock(id) ||
        isClaimWorkstationBlock(id) ||
        isDecorPlacementBlock(id) ||
        id.includes("frame") ||
        id.includes("armor_stand")
    );
}

/**
 * Restricted creative break rules.
 * - blocked: cancelled; stop processing
 * - allowed: in a creative builder claim on a normal block; skip plot break protection
 * - not_applicable: not a restricted creative role
 */
export function resolveRestrictedCreativeBreak(player, block, cancelEvent) {
    primeRestrictedCreativeState(player);
    if (!isRestrictedCreativeRole(player)) return "not_applicable";

    const blockId = String(block?.typeId || "").toLowerCase();

    if (!canCreativeRoleBuildAt(player, block.location)) {
        cancelEvent.cancel = true;
        const denied = creativeBuildDeniedCopy(player, "break");
        system.run(() => {
            denyRestrictedCreative(
                player,
                "creative_builder_claim_only",
                denied.message,
                denied.hint
            );
        });
        return "blocked";
    }

    if (isRestrictedCreativeBreakBlock(blockId)) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "anti_abuse_container_break",
                "You cannot break containers, workstations, or decor in Creative mode."
            );
        });
        return "blocked";
    }

    return "allowed";
}

/**
 * Restricted creative place rules.
 * - blocked: cancelled; stop processing
 * - allowed: in a creative builder claim on an allowed block; skip plot place protection
 * - not_applicable: not a restricted creative role
 */
export function resolveRestrictedCreativePlace(player, block, cancelEvent) {
    primeRestrictedCreativeState(player);
    if (!isRestrictedCreativeRole(player)) return "not_applicable";

    if (!canCreativeRoleBuildAt(player, block.location)) {
        cancelEvent.cancel = true;
        const denied = creativeBuildDeniedCopy(player, "place");
        system.run(() => {
            denyRestrictedCreative(
                player,
                "creative_builder_claim_only",
                denied.message,
                denied.hint
            );
        });
        return "blocked";
    }

    if (blockRestrictedCreativePlace(player, block.typeId, cancelEvent)) {
        return "blocked";
    }

    return "allowed";
}

/** Returns true when the action was blocked (caller should cancel). */
export function enforceCreativeRoleAdminClaimOnly(player, location, actionName) {
    primeRestrictedCreativeState(player);
    if (!isRestrictedCreativeRole(player)) return false;
    if (canCreativeRoleBuildAt(player, location)) return false;

    const denied = creativeBuildDeniedCopy(player, actionName, { includeBlocksWord: false });
    system.run(() => {
        denyRestrictedCreative(
            player,
            "creative_builder_claim_only",
            denied.message,
            denied.hint
        );
    });
    return true;
}

export function blockRestrictedCreativeBlockInteract(player, blockId, cancelEvent) {
    primeRestrictedCreativeState(player);
    if (!isRestrictedCreativeRole(player)) return false;

    const id = String(blockId || "").toLowerCase();

    if (isRestrictedUsableBlock(id)) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "anti_abuse_usable",
                "Containers, workstations, and shelves are locked in Creative mode."
            );
        });
        return true;
    }

    if (isDecorPlacementBlock(id) || id.includes("frame") || id.includes("armor_stand")) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "anti_abuse_frame_use",
                "You cannot put items on Item Frames or Armor Stands."
            );
        });
        return true;
    }

    return false;
}

export function blockRestrictedCreativePlace(player, blockId, cancelEvent) {
    primeRestrictedCreativeState(player);
    if (!isRestrictedCreativeRole(player)) return false;

    const id = String(blockId || "").toLowerCase();

    if (isDecorPlacementBlock(id)) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "anti_abuse_decor_place",
                "Item Frames and Armor Stands are locked in Creative mode."
            );
        });
        return true;
    }

    if (isStorageContainerBlock(id)) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "anti_abuse_container_place",
                "You cannot place containers in Creative mode."
            );
        });
        return true;
    }

    if (id.includes("tnt") || id.includes("respawn_anchor")) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(player, "anti_abuse_tnt", "You cannot place explosives in Creative mode.");
        });
        return true;
    }

    return false;
}

export {
    isStorageContainerBlock,
    isRestrictedUsableBlock,
    isDecorPlacementBlock,
};

/**
 * Removes the stale `rain_creative_role` tag from a player who no longer holds
 * a builder or tester role. Called on spawn/respawn so leftover tags from a
 * previous session don't grant unintended Creative-mode build access.
 * @param {import('@minecraft/server').Player} player
 */
export function stripStaleCreativeRoleTag(player) {
    if (!player) return;
    try {
        if (player.hasTag(CREATIVE_ROLE_TAG) && !hasBuilderOrTesterRole(player)) {
            player.removeTag(CREATIVE_ROLE_TAG);
        }
    } catch (e) {}
}
