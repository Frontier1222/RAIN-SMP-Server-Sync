/** Shared land-claim permission helpers (public defaults + per-player overrides). */

import { world } from "@minecraft/server";
import { getAllGlobalClaims } from "./plotClaimCache.js";
import { isStaffPlayer } from "../systems/ranks.js";
import {
    isTester,
    isPlayerInCreative,
    isAdminClaim,
} from "./creativeRoleGuard.js";

export const PLAYER_PERM_LABELS = {
    protectBreak: "Break",
    protectPlace: "Place",
    protectLiquid: "Liquids",
    protectContainer: "Containers",
    protectDoors: "Doors",
    protectEnter: "Enter",
    protectEnderPearls: "Pearls",
    protectInteract: "Decor",
    protectEntityKill: "Mob Kill",
    protectCaptureCubes: "Capture Cubes",
    protectExplosion: "Explosions",
    protectFireSpread: "Fire Spread",
    protectPvp: "PVP",
    protectRaid: "Raids",
    allowHomes: "Set Home",
    blockRainGui: "Rain GUI",
};

export function resolvePlayerName(inputName) {
    const trimmed = String(inputName || "").trim();
    if (!trimmed) return "";

    const match = world.getAllPlayers().find(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) return match.name;

    return trimmed;
}

export function findPlayerPermRecord(plot, player) {
    if (!plot?.permissions?.players || !player) return null;

    const pName = player.name.toLowerCase();
    const players = plot.permissions.players;

    for (const key of Object.keys(players)) {
        const entry = players[key];
        if (key.toLowerCase() === pName || key === player.id) {
            return { key, entry };
        }
        if (entry && typeof entry === "object" && entry.playerId === player.id) {
            return { key, entry };
        }
    }

    return null;
}

export function getDefaultPerms(plot) {
    if (plot?.factionClaim) {
        syncFactionPublicToDefaultPermissions(plot);
    }
    return plot?.permissions?.default || plot?.permissions || {};
}

/** True when the player is in the faction that owns this claim. */
export function isFactionClaimMember(plot, player) {
    if (!plot?.factionClaim || !plot.ownerId || !player) return false;
    if (player.getDynamicProperty("faction") === plot.ownerId) return true;

    try {
        const factions = JSON.parse(world.getDynamicProperty("factions") || "[]");
        const fac = factions.find((f) => f.id === plot.ownerId);
        if (!fac) return false;

        const members = fac.members || [];
        if (members.includes(player.id)) return true;
        return members.map((m) => String(m).toLowerCase()).includes(player.name.toLowerCase());
    } catch (e) {
        return false;
    }
}

/** Maps legacy faction `permissions.public` toggles into `permissions.default.protect*`. */
export function syncFactionPublicToDefaultPermissions(plot) {
    if (!plot?.factionClaim) return plot;

    ensurePlotPublicPerms(plot);
    const pub = plot.permissions.public;
    const def = plot.permissions.default;

    if (pub.build !== undefined) {
        def.protectBreak = !pub.build;
        def.protectPlace = !pub.build;
    }
    if (pub.interact !== undefined) def.protectInteract = !pub.interact;
    if (pub.decorations !== undefined) def.protectInteract = !pub.decorations;
    if (pub.containers !== undefined) def.protectContainer = !pub.containers;
    if (pub.doors !== undefined) def.protectDoors = !pub.doors;
    if (pub.enter !== undefined) def.protectEnter = !pub.enter;
    if (pub.entityKill !== undefined) def.protectEntityKill = !pub.entityKill;
    if (pub.explosions !== undefined) def.protectExplosion = !pub.explosions;
    if (pub.pvp !== undefined) def.protectPvp = !pub.pvp;
    if (pub.homes !== undefined) def.allowHomes = !!pub.homes;

    if (!Array.isArray(plot.trusted)) plot.trusted = [];
    const guests = plot.permissions.guests || [];
    for (const guest of guests) {
        const name = String(guest || "").trim();
        if (!name) continue;
        const lower = name.toLowerCase();
        if (!plot.trusted.map((n) => String(n).toLowerCase()).includes(lower)) {
            plot.trusted.push(name);
        }
    }

    return plot;
}

/** Maps `permissions.default.protect*` back into legacy faction `permissions.public`. */
export function syncFactionDefaultToPublicPermissions(plot) {
    if (!plot?.factionClaim) return plot;

    ensurePlotPublicPerms(plot);
    const def = plot.permissions.default;
    const pub = plot.permissions.public;

    pub.build = def.protectBreak === false;
    pub.interact = def.protectInteract === false;
    pub.decorations = def.protectInteract === false;
    pub.containers = def.protectContainer === false;
    pub.doors = def.protectDoors === false;
    pub.enter = def.protectEnter === false;
    pub.entityKill = def.protectEntityKill === false;
    pub.explosions = def.protectExplosion === false;
    pub.pvp = def.protectPvp === false;
    pub.homes = def.allowHomes === true;

    return plot;
}

export function getPlayerPermValue(plot, player, permKey) {
    const record = findPlayerPermRecord(plot, player);
    if (record && typeof record.entry === "object" && record.entry[permKey] !== undefined) {
        return record.entry[permKey];
    }
    return undefined;
}

/** Parent claim for admin subclaims (walks parentId). */
export function getParentClaim(plot) {
    if (!plot?.parentId) return null;
    return (getAllGlobalClaims() || []).find((claim) => claim && claim.id === plot.parentId) || null;
}

/** Default permission on this claim, falling back to parent subclaims. */
export function getEffectiveClaimPermValue(plot, permKey) {
    let current = plot;
    while (current) {
        const defaultPerms = getDefaultPerms(current);
        if (defaultPerms[permKey] !== undefined) {
            return defaultPerms[permKey];
        }
        current = getParentClaim(current);
    }
    return undefined;
}

/** Per-player override on this claim, falling back to parent subclaims. */
export function getEffectivePlayerPermValue(plot, player, permKey) {
    let current = plot;
    while (current) {
        const value = getPlayerPermValue(current, player, permKey);
        if (value !== undefined) return value;
        current = getParentClaim(current);
    }
    return undefined;
}

/** True when claim default keeps protection on (protect* true or unset). */
export function isClaimProtectionEnabled(plot, permKey) {
    const value = getEffectiveClaimPermValue(plot, permKey);
    return value !== false;
}

/** True when PVP is disabled in this claim (respects subclaim inheritance). */
export function isPvpDisabledInClaim(plot) {
    return isClaimProtectionEnabled(plot, "protectPvp");
}

/**
 * True when the player may PVP in this claim.
 * Claim-wide only — owners, members, and per-player overrides cannot bypass a disabled-PVP claim.
 * Staff (non-tester) still bypass.
 */
export function isPvpAllowedInClaim(plot, player) {
    if (!plot || !player) return true;
    if (isStaffPlayer(player)) return true;

    return !isClaimProtectionEnabled(plot, "protectPvp");
}

function ensurePlotPublicPerms(plot) {
    if (!plot.permissions) plot.permissions = { default: {}, players: {} };
    if (!plot.permissions.default) plot.permissions.default = {};
    if (!plot.permissions.players) plot.permissions.players = {};
    if (!plot.permissions.public) plot.permissions.public = {};
}

/** True when the player may set a home inside this claim (owner, faction, or explicit allow). */
export function isHomeAllowedInClaim(plot, player) {
    if (!plot || !player) return true;

    if (plot.ownerId === player.id) return true;
    if (String(plot.ownerName || "").toLowerCase() === player.name.toLowerCase()) return true;

    if (plot.factionClaim) {
        try {
            const factions = JSON.parse(world.getDynamicProperty("factions") || "[]");
            const fac = factions.find((f) => f.id === plot.ownerId);
            if (fac) {
                const isLeader =
                    fac.ownerId === player.id ||
                    String(fac.ownerName || "").toLowerCase() === player.name.toLowerCase() ||
                    String(fac.leader || "").toLowerCase() === player.name.toLowerCase();
                const members = fac.members || [];
                if (
                    isLeader ||
                    members.includes(player.id) ||
                    members.map((m) => String(m).toLowerCase()).includes(player.name.toLowerCase())
                ) {
                    return true;
                }
            }
        } catch (e) {}
    }

    ensurePlotPublicPerms(plot);

    const playerValue = getPlayerPermValue(plot, player, "allowHomes");
    if (playerValue === true) return true;

    const defaultPerms = getDefaultPerms(plot);
    if (defaultPerms.allowHomes === true) return true;

    if (plot.permissions.public?.homes === true) return true;
    if ((plot.permissions.guests || []).map((g) => String(g).toLowerCase()).includes(player.name.toLowerCase())) {
        return true;
    }

    return false;
}

/** Admin Claim Editor: testers may build/break/open containers in survival (10k bypass). */
export function plotAllowsTesterBuildBypass(plot) {
    if (!plot) return false;
    if (plot.allowTesterBypass === true || plot.testerBypass === true) return true;
    return plot.permissions?.default?.allowTesterBypass === true;
}

/** Admin Claim Editor: testers may place/open bold-named or NBT shulkers in this claim. */
export function plotAllowsTesterShulkerBypass(plot) {
    if (!plot) return false;
    if (plot.allowTesterShulkerBypass === true) return true;
    return plot.permissions?.default?.allowTesterShulkerBypass === true;
}

/** Admin Claim Editor: no enter toast/sound for any player when enabled. */
export function plotHidesEnterToastForRole(plot, player) {
    if (!plot || !player) return false;

    return (
        plot.hideEnterToastForStaffRoles === true ||
        plot.permissions?.default?.hideEnterToastForStaffRoles === true
    );
}

/** Admin claims or claims with tester build bypass enabled. */
export function canTesterBypassRestrictedZone(player, plot) {
    if (!player || !plot || !isTester(player)) return false;
    return isAdminClaim(plot) || plotAllowsTesterBuildBypass(plot);
}

/** Tester build/break/container bypass on a claim (any gamemode). */
export function hasTesterClaimBuildBypass(plot, player) {
    return canTesterBypassRestrictedZone(player, plot);
}

/** Survival testers with build bypass — decor/containers included. */
export function hasTesterSurvivalBuildBypass(plot, player) {
    return (
        hasTesterClaimBuildBypass(plot, player) &&
        !isPlayerInCreative(player)
    );
}

/** Testers (any mode) bypass normal claim protection — creative builders use break/place handlers only. */
export function hasRoleClaimBypass(plot, player) {
    if (!plot || !player) return false;
    return hasTesterClaimBuildBypass(plot, player);
}

/** True when the player may perform the action (protect* is off). Inherits from parent subclaims. */
export function isClaimPermAllowed(plot, player, permKey) {
    const playerValue = getEffectivePlayerPermValue(plot, player, permKey);
    if (playerValue !== undefined) {
        return playerValue === false;
    }

    const defaultValue = getEffectiveClaimPermValue(plot, permKey);
    if (defaultValue !== undefined) {
        return defaultValue === false;
    }

    return false;
}

export function summarizePlayerPermissions(entry) {
    if (entry === true) return "Full access";
    if (!entry || typeof entry !== "object") return "No permissions";

    const allowed = [];
    for (const [key, label] of Object.entries(PLAYER_PERM_LABELS)) {
        if (key === "allowHomes") {
            if (entry[key] === true) allowed.push(label);
        } else if (entry[key] === false) {
            allowed.push(label);
        }
    }

    return allowed.length > 0 ? allowed.join(", ") : "No permissions";
}

export function buildPlayerPermObject(formValues, startIndex = 1) {
    return {
        protectBreak: !formValues[startIndex],
        protectPlace: !formValues[startIndex + 1],
        protectLiquid: !formValues[startIndex + 2],
        protectContainer: !formValues[startIndex + 3],
        protectDoors: !formValues[startIndex + 4],
        protectEnter: !formValues[startIndex + 5],
        protectEnderPearls: !formValues[startIndex + 6],
        protectInteract: !formValues[startIndex + 7],
        protectEntityKill: !formValues[startIndex + 8],
        protectCaptureCubes: !formValues[startIndex + 9],
        protectExplosion: !formValues[startIndex + 10],
        protectFireSpread: !formValues[startIndex + 11],
        protectPvp: !formValues[startIndex + 12],
        protectRaid: !formValues[startIndex + 13],
        allowHomes: !!formValues[startIndex + 14],
    };
}

export function appendPlayerPermToggles(modal, entry) {
    const defaults = entry && typeof entry === "object" ? entry : {};

    return modal
        .toggle("Allow Break Blocks", { defaultValue: defaults.protectBreak === false })
        .toggle("Allow Place Blocks", { defaultValue: defaults.protectPlace === false })
        .toggle("Allow Liquids (Water/Lava)", { defaultValue: defaults.protectLiquid === false })
        .toggle("Allow Open Containers", { defaultValue: defaults.protectContainer === false })
        .toggle("Allow Open Doors", { defaultValue: defaults.protectDoors === false })
        .toggle("Allow Players To Enter Claim", { defaultValue: defaults.protectEnter === false })
        .toggle("Allow Ender Pearls", { defaultValue: defaults.protectEnderPearls === false })
        .toggle("Allow Item Frames, Armor Stands & Signs Usage", {
            defaultValue: defaults.protectInteract === false,
        })
        .toggle("Allow Entity Killing", { defaultValue: defaults.protectEntityKill === false })
        .toggle("Allow Capture Cubes (Mob Capture)", { defaultValue: defaults.protectCaptureCubes === false })
        .toggle("Allow Explosions", { defaultValue: defaults.protectExplosion === false })
        .toggle("Allow Fire Spread", { defaultValue: defaults.protectFireSpread === false })
        .toggle("Allow PVP", { defaultValue: defaults.protectPvp === false })
        .toggle("Allow Raids", { defaultValue: defaults.protectRaid === false })
        .toggle("Allow Set Home Here", { defaultValue: defaults.allowHomes === true });
}

/** Full public-permission form for admin subclaims (creation + edit). */
export function appendSubclaimPublicPermToggles(modal, perms = {}) {
    const p = perms;

    return modal
        .toggle("Allow Public Break Blocks", { defaultValue: p.protectBreak === false })
        .toggle("Allow Public Place Blocks", { defaultValue: p.protectPlace === false })
        .toggle("Allow Public Liquids (Water/Lava)", { defaultValue: p.protectLiquid === false })
        .toggle("Allow Public Open Containers", { defaultValue: p.protectContainer === false })
        .toggle("Allow Public Open Doors", { defaultValue: p.protectDoors === false })
        .toggle("Allow Players To Enter Claim", { defaultValue: p.protectEnter === false })
        .toggle("Allow Ender Pearls", { defaultValue: p.protectEnderPearls === false })
        .toggle("Allow Item Frames, Armor Stands & Signs Usage", { defaultValue: p.protectInteract === false })
        .toggle("Allow Entity Killing", { defaultValue: p.protectEntityKill === false })
        .toggle("Allow Capture Cubes (Mob Capture)", { defaultValue: p.protectCaptureCubes === false })
        .toggle("Allow Explosions", { defaultValue: p.protectExplosion === false })
        .toggle("Allow Fire Spread", { defaultValue: p.protectFireSpread === false })
        .toggle("Disable PVP", { defaultValue: p.protectPvp ?? true })
        .toggle("Disable Raids", { defaultValue: p.protectRaid ?? true })
        .toggle("Allow Creative Builders", { defaultValue: p.allowBuilders === true });
}

export function buildSubclaimPublicPermObject(formValues, startIndex = 0) {
    return {
        protectBreak: !formValues[startIndex],
        protectPlace: !formValues[startIndex + 1],
        protectLiquid: !formValues[startIndex + 2],
        protectContainer: !formValues[startIndex + 3],
        protectDoors: !formValues[startIndex + 4],
        protectEnter: !formValues[startIndex + 5],
        protectEnderPearls: !formValues[startIndex + 6],
        protectInteract: !formValues[startIndex + 7],
        protectEntityKill: !formValues[startIndex + 8],
        protectCaptureCubes: !formValues[startIndex + 9],
        protectExplosion: !formValues[startIndex + 10],
        protectFireSpread: !formValues[startIndex + 11],
        protectPvp: formValues[startIndex + 12],
        protectRaid: formValues[startIndex + 13],
        allowBuilders: formValues[startIndex + 14],
    };
}
