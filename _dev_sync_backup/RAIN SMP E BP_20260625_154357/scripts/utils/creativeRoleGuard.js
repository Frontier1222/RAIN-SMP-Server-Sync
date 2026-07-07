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

const CREATIVE_ROLE_TAG = "rain_creative_role";
const WORLD_BUILDER_ROLE_TAG = "world_builder";
/** Gamertags treated as testers without the `tester` tag — edit here only. */
const HARDCODED_TESTERS = ["Itmecatt2058"].map((name) => name.toLowerCase());
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
    return !!player?.hasTag("staff") && !isTester(player);
}

export function isWorldBuilderRole(player) {
    return !!player?.hasTag(WORLD_BUILDER_ROLE_TAG);
}

function hasBuilderOrTesterRole(player) {
    if (isWorldBuilderRole(player)) return false;
    return isTester(player) || !!player?.hasTag("creative_builder");
}

export function isPlayerInCreative(player) {
    if (!player) return false;
    if (player.hasTag(CREATIVE_ROLE_TAG)) return true;

    const mode = readPlayerGamemode(player);
    if (mode === "creative") return true;

    try {
        const raw = player.getGameMode?.() ?? player.gameMode;
        if (gamemodeEnumToKey(raw) === "creative") return true;
    } catch (e) { }

    return false;
}

function resolveLiveGamemodeKey(player) {
    const mode = readPlayerGamemode(player);
    if (mode !== "unknown") return mode;

    try {
        const raw = player.getGameMode?.() ?? player.gameMode;
        const key = gamemodeEnumToKey(raw);
        if (key) {
            rememberPlayerGamemode(player, key);
            return key;
        }
    } catch (e) { }

    return "unknown";
}

/** Sync tag from live gamemode — reliable in beforeEvents on Realms. */
export function syncCreativeRoleTag(player) {
    if (!player || !hasBuilderOrTesterRole(player) || isTrueStaff(player)) return;

    const mode = resolveLiveGamemodeKey(player);
    if (mode === "creative") {
        if (!player.hasTag(CREATIVE_ROLE_TAG)) player.addTag(CREATIVE_ROLE_TAG);
        return;
    }
    if (mode !== "unknown" && player.hasTag(CREATIVE_ROLE_TAG)) {
        player.removeTag(CREATIVE_ROLE_TAG);
    }
}

export function setCreativeRoleTag(player, active) {
    if (!player || !hasBuilderOrTesterRole(player) || isTrueStaff(player)) return;
    if (active) {
        if (!player.hasTag(CREATIVE_ROLE_TAG)) player.addTag(CREATIVE_ROLE_TAG);
        rememberPlayerGamemode(player, "creative");
    } else if (player.hasTag(CREATIVE_ROLE_TAG)) {
        player.removeTag(CREATIVE_ROLE_TAG);
    }
}

export function isRestrictedCreativeRole(player) {
    if (!player || !isPlayerInCreative(player)) return false;
    if (isTrueStaff(player)) return false;
    return hasBuilderOrTesterRole(player);
}

/** Reliable in beforeEvents — tag, remembered gamemode, or live read. */
export function shouldBlockCreativeRoleDrop(player) {
    if (!player || isTrueStaff(player)) return false;
    if (!hasBuilderOrTesterRole(player)) return false;
    if (player.hasTag(CREATIVE_ROLE_TAG)) return true;

    const remembered = getRememberedGamemode(player);
    if (remembered === "creative") return true;

    return readPlayerGamemode(player) === "creative";
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
        (plot.isSubclaim === true && (ownerId === "server" || ownerName === "server"))
    );
}

/** Server-owned / flagged admin zones OR staff-enabled via Admin Claim Editor. */
export function allowsCreativeBuilderPlot(plot) {
    if (!plot) return false;
    if (isAdminClaim(plot)) return true;

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
 * - allowed: in admin claim on a normal block; skip plot break protection
 * - not_applicable: not a restricted creative role
 */
export function resolveRestrictedCreativeBreak(player, block, cancelEvent) {
    syncCreativeRoleTag(player);
    if (!isRestrictedCreativeRole(player)) return "not_applicable";

    const blockId = String(block?.typeId || "").toLowerCase();

    if (!canCreativeRoleBuildAt(player, block.location)) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "creative_admin_only",
                "You can only break blocks in Admin Claims while in Creative.",
                "Builders & testers · admin claims only"
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
 * - allowed: in admin claim on an allowed block; skip plot place protection
 * - not_applicable: not a restricted creative role
 */
export function resolveRestrictedCreativePlace(player, block, cancelEvent) {
    syncCreativeRoleTag(player);
    if (!isRestrictedCreativeRole(player)) return "not_applicable";

    if (!canCreativeRoleBuildAt(player, block.location)) {
        cancelEvent.cancel = true;
        system.run(() => {
            denyRestrictedCreative(
                player,
                "creative_admin_only",
                "You can only place blocks in Admin Claims while in Creative.",
                "Builders & testers · admin claims only"
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
    syncCreativeRoleTag(player);
    if (!isRestrictedCreativeRole(player)) return false;
    if (canCreativeRoleBuildAt(player, location)) return false;

    system.run(() => {
        denyRestrictedCreative(
            player,
            "creative_admin_only",
            `You can only ${actionName} in Admin Claims while in Creative.`,
            "Builders & testers · admin claims only"
        );
    });
    return true;
}

export function blockRestrictedCreativeBlockInteract(player, blockId, cancelEvent) {
    syncCreativeRoleTag(player);
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
    syncCreativeRoleTag(player);
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
