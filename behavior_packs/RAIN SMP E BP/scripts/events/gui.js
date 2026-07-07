import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { system, world, Player, ItemStack } from '@minecraft/server';
import { acceptTpaRequest, createTpaRequest, rejectTpaRequest } from '../systems/tpaRequests.js';
import { openAuctionHouse } from '../systems/auction/gui/index.js';
import { showPlayerStats } from '../systems/stats.js';
import {
    getCombatRemainingSeconds,
    getTeleportCooldownRemainingSeconds,
    isInCombat,
    startTeleportCooldown,
} from '../utils/teleport.js';
import {
    removeFromGlobalClaims,
    saveGlobalClaim,
    getAllGlobalClaims,
    rebuildGlobalClaimChunkCache,
    syncOwnedPlotsFromGlobal,
    isValidClaimPlot,
    rebalanceAllClaimBuckets,
    healCorruptClaimBuckets,
    equipPlotClaimWand,
} from './plot/plotHelpers.js';
import {
    appendPlayerPermToggles,
    appendSubclaimPublicPermToggles,
    buildPlayerPermObject,
    buildSubclaimPublicPermObject,
    resolvePlayerName,
    summarizePlayerPermissions,
    isHomeAllowedInClaim,
    syncFactionPublicToDefaultPermissions,
    syncFactionDefaultToPublicPermissions,
} from '../utils/claimPermissions.js';
import { enforcePlotEnterDenyForClaim, enforcePlotEnterDenyForPlayer, markPlayerEnterRestricted, clearPlayerEnterRestricted } from './plot/plotProtection.js';
import { notify, toast, toastError, toastSuccess, toastInfo } from '../utils/realmPerf.js';

function teleportPlayerToClaim(player, dim, x, y, z, onDone) {
    try {
        player.addEffect("slow_falling", 200, { showParticles: false });
        player.teleport(
            { x: Math.floor(x) + 0.5, y, z: Math.floor(z) + 0.5 },
            { dimension: dim }
        );
    } catch (e) { }
    onDone?.();
}
import { isPrisonGuiBlocked, denyPrisonGuiUse } from '../utils/prison.js';
import { isOperatorPlayer, isRainGuiBlocked, isStaffPlayer, syncProtectedRoleTags } from '../systems/ranks.js';
import { syncPlayerRainGuiGlint, isRainGuiMinigamePlayer } from "../utils/rainGui.js";

const DEFAULT_DAILY_REWARD_ITEMS = ['minecraft:diamond', 'minecraft:emerald', 'minecraft:gold_ingot', 'minecraft:iron_ingot'];
const DAILY_REWARD_ITEMS_KEY = 'daily_reward_items';
const DAILY_REWARD_AMOUNT_KEY = 'daily_reward_amount';

function clampInt(v, min, max, fallback) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function getDailyRewardItems() {
    const raw = world.getDynamicProperty(DAILY_REWARD_ITEMS_KEY);
    const items = JSON.parse(raw || 'null');
    if (Array.isArray(items) && items.length) return items;
    return DEFAULT_DAILY_REWARD_ITEMS.slice();
}

function setDailyRewardItems(items) {
    const cleaned = (items || []).filter(v => v).map(v => String(v).trim()).filter(v => v);
    world.setDynamicProperty(DAILY_REWARD_ITEMS_KEY, JSON.stringify(cleaned));
}

function getDailyRewardAmount() {
    return clampInt(world.getDynamicProperty(DAILY_REWARD_AMOUNT_KEY), 1, 64, 1);
}

function setDailyRewardAmount(amount) {
    world.setDynamicProperty(DAILY_REWARD_AMOUNT_KEY, clampInt(amount, 1, 64, 1));
}

function sendError(player, message, key = "gui_error") {
    toastError(player, message, key);
}

function sendSuccess(player, message, key = "gui_success") {
    toastSuccess(player, message, key);
}

const FORM_OPEN_DELAY_TICKS = 2;
const MAX_FORM_BUSY_RETRIES = 5;
const ADMIN_HOMES_INDEX_KEY = "admin_homes_index_v1";
const MAX_DYNAMIC_PROPERTY_STRING_BYTES = 32767;
const TARGET_DYNAMIC_PROPERTY_STRING_BYTES = 30000;

function parseJsonArray(raw, fallback = []) {
    try {
        const parsed = JSON.parse(raw || "[]");
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

function sanitizeHomeForAdminIndex(home) {
    if (!home || typeof home !== "object") return null;
    const x = Number(home.x);
    const y = Number(home.y);
    const z = Number(home.z);
    return {
        id: String(home.id || Date.now()),
        name: String(home.name || "Home"),
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        z: Number.isFinite(z) ? z : 0,
        dimension: String(home.dimension || "minecraft:overworld"),
    };
}

function readAdminHomesIndex() {
    const raw = world.getDynamicProperty(ADMIN_HOMES_INDEX_KEY);
    let parsed = [];
    try {
        parsed = JSON.parse(raw || "[]");
    } catch (e) {
        parsed = [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object");
}

function writeAdminHomesIndex(entries) {
    const cleaned = Array.isArray(entries) ? entries.slice() : [];
    cleaned.sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0));

    while (cleaned.length > 0) {
        const payload = JSON.stringify(cleaned);
        if (payload.length <= TARGET_DYNAMIC_PROPERTY_STRING_BYTES) {
            try {
                world.setDynamicProperty(ADMIN_HOMES_INDEX_KEY, payload);
                return true;
            } catch (e) {
                console.warn(`[RAIN GUI] admin homes index write failed: ${e}`);
                return false;
            }
        }
        cleaned.pop();
    }

    try {
        world.setDynamicProperty(ADMIN_HOMES_INDEX_KEY, "[]");
        return true;
    } catch (e) {
        console.warn(`[RAIN GUI] admin homes index reset failed: ${e}`);
        return false;
    }
}

function syncAdminHomesIndexForPlayer(player, homes) {
    if (!player?.id) return;
    const cleanedHomes = (Array.isArray(homes) ? homes : [])
        .map(sanitizeHomeForAdminIndex)
        .filter(Boolean);

    const index = readAdminHomesIndex().filter((entry) => entry.playerId !== player.id);
    if (cleanedHomes.length > 0) {
        index.push({
            playerId: player.id,
            playerName: player.name,
            homes: cleanedHomes,
            updatedAt: Date.now(),
        });
    }
    return writeAdminHomesIndex(index);
}

function refreshAdminHomesIndexFromOnlinePlayers() {
    const onlinePlayers = world.getAllPlayers();
    const indexById = new Map();
    for (const entry of readAdminHomesIndex()) {
        if (!entry?.playerId) continue;
        indexById.set(entry.playerId, entry);
    }

    for (const online of onlinePlayers) {
        const homes = parseJsonArray(online.getDynamicProperty("homes"), []);
        const cleanedHomes = homes.map(sanitizeHomeForAdminIndex).filter(Boolean);
        if (cleanedHomes.length > 0) {
            indexById.set(online.id, {
                playerId: online.id,
                playerName: online.name,
                homes: cleanedHomes,
                updatedAt: Date.now(),
            });
        } else {
            indexById.delete(online.id);
        }
    }

    const entries = Array.from(indexById.values());
    writeAdminHomesIndex(entries);
    return entries;
}

function normalizeHomeName(value, fallback = "Home") {
    const text = String(value ?? "").trim();
    return (text || fallback).slice(0, 40);
}

function saveHomesForPlayer(player, homes) {
    if (!player?.isValid) return false;
    const cleaned = (Array.isArray(homes) ? homes : [])
        .map(sanitizeHomeForAdminIndex)
        .filter(Boolean)
        .slice(0, 15);
    const payload = JSON.stringify(cleaned);
    if (payload.length > MAX_DYNAMIC_PROPERTY_STRING_BYTES) {
        sendError(player, "§cYour homes list is too large to save.");
        return false;
    }
    try {
        player.setDynamicProperty("homes", payload);
        syncAdminHomesIndexForPlayer(player, cleaned);
        return true;
    } catch (e) {
        console.warn(`[RAIN GUI] homes save failed for ${player.name}: ${e}`);
        sendError(player, "§cCould not save your homes. Try again.");
        return false;
    }
}

function getAdminHomeRows(search = "") {
    const needle = String(search || "").trim().toLowerCase();
    const rows = [];
    for (const entry of readAdminHomesIndex()) {
        const ownerName = String(entry.playerName || "Unknown");
        const ownerId = String(entry.playerId || "");
        const homes = Array.isArray(entry.homes) ? entry.homes : [];
        for (const home of homes) {
            const normalized = sanitizeHomeForAdminIndex(home);
            if (!normalized) continue;
            const haystack = `${ownerName} ${normalized.name} ${normalized.dimension}`.toLowerCase();
            if (needle && !haystack.includes(needle)) continue;
            rows.push({
                ownerName,
                ownerId,
                ...normalized,
            });
        }
    }

    rows.sort((a, b) => {
        const ownerCmp = a.ownerName.localeCompare(b.ownerName);
        if (ownerCmp !== 0) return ownerCmp;
        return a.name.localeCompare(b.name);
    });

    return rows;
}

function reopenMainOnGuiError(player, err) {
    console.warn(`[RAIN GUI] ${err}`);
    if (!player?.isValid) return;
    sendError(player, "§cMenu error. Returning to main menu.");
    system.run(() => {
        if (!player?.isValid) return;
        openMainMenu(player);
    });
}

function showFormSafe(player, form, onResult, onCancel, _retries = 0) {
    if (!player?.isValid) return;
    system.runTimeout(() => {
        if (!player.isValid) return;
        form.show(player)
            .then((res) => {
                if (!player.isValid) return;
                if (res.canceled) {
                    // UserBusy means the game was still processing a previous interaction.
                    // Retry up to MAX_FORM_BUSY_RETRIES times instead of dismissing the form.
                    if (res.cancelationReason === 'UserBusy' && _retries < MAX_FORM_BUSY_RETRIES) {
                        showFormSafe(player, form, onResult, onCancel, _retries + 1);
                        return;
                    }
                    try {
                        onCancel?.(res);
                    } catch (e) {
                        reopenMainOnGuiError(player, e);
                    }
                    return;
                }
                system.run(() => {
                    if (!player.isValid) return;
                    try {
                        onResult?.(res);
                    } catch (e) {
                        reopenMainOnGuiError(player, e);
                    }
                });
            })
            .catch((e) => reopenMainOnGuiError(player, e));
    }, FORM_OPEN_DELAY_TICKS);
}

function runGuiMenuAction(player, action) {
    if (!action || !player?.isValid) return;
    system.run(() => {
        if (!player.isValid) return;
        try {
            const result = action();
            if (result && typeof result.then === "function") {
                result.catch((e) => {
                    console.warn(`[RAIN GUI] async action: ${e}`);
                    if (!player?.isValid) return;
                    sendError(player, "§cThat menu failed to open.");
                });
            }
        } catch (e) {
            reopenMainOnGuiError(player, e);
        }
    });
}

function ensurePlotPermissionsDefault(plot) {
    if (!plot.permissions) {
        plot.permissions = { default: {}, players: {}, public: {} };
    }
    if (!plot.permissions.default) {
        plot.permissions.default = {};
    }
    if (!plot.permissions.players) {
        plot.permissions.players = {};
    }
    if (!plot.permissions.public) {
        plot.permissions.public = {};
    }
}

function parseOwnedPlots(player) {
    const raw = player.getDynamicProperty("owned_plots");
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return null;
    }
}

function getPermPlayerLabel(plot, key) {
    const entry = plot?.permissions?.players?.[key];
    if (entry?.displayName) return entry.displayName;
    if (entry?.playerId) {
        const online = world.getAllPlayers().find((p) => p.id === entry.playerId);
        if (online) return online.name;
    }
    return key;
}

function persistClaim(plot, ownerPlayer, ownerPlots) {
    ensurePlotPermissionsDefault(plot);

    if (!isValidClaimPlot(plot)) {
        if (ownerPlayer) {
            sendError(ownerPlayer, "§cClaim data is invalid and could not be saved.");
        }
        return false;
    }

    if (!saveGlobalClaim(plot)) {
        if (ownerPlayer) {
            sendError(ownerPlayer, "§cCould not save claim to world data. Staff: use §eRepair Claim Storage§c in Land Claim, or Recover Claims.");
        }
        return false;
    }

    rebuildGlobalClaimChunkCache(true);

    if (ownerPlayer && ownerPlots) {
        const idx = ownerPlots.findIndex((p) => p.id === plot.id);
        if (idx > -1) {
            ownerPlots[idx] = plot;
        } else {
            ownerPlots.push(plot);
        }
        try {
            ownerPlayer.setDynamicProperty("owned_plots", JSON.stringify(ownerPlots));
        } catch (e) {
            if (ownerPlayer) {
                sendError(ownerPlayer, "§cClaim saved to world, but your personal claim list failed to update.");
            }
            return false;
        }
    } else {
        const owner = world.getAllPlayers().find((p) => p.id === plot.ownerId);
        if (owner) {
            let plots = parseOwnedPlots(owner);
            if (plots === null) plots = [];
            const idx = plots.findIndex((p) => p.id === plot.id);
            if (idx > -1) {
                plots[idx] = plot;
            } else {
                plots.push(plot);
            }
            try {
                owner.setDynamicProperty("owned_plots", JSON.stringify(plots));
            } catch (e) {
                if (ownerPlayer) {
                    sendError(ownerPlayer, "§cClaim saved to world, but the owner's personal list failed to update.");
                }
            }
        }
    }

    system.run(() => enforcePlotEnterDenyForClaim(plot));
    return true;
}

function persistSubclaim(subclaim) {
    ensurePlotPermissionsDefault(subclaim);

    if (!saveGlobalClaim(subclaim)) {
        return false;
    }

    rebuildGlobalClaimChunkCache(true);
    system.run(() => enforcePlotEnterDenyForClaim(subclaim));
    return true;
}

function getParentClaimForSubclaim(subclaim) {
    if (!subclaim?.parentId) return null;
    return (getAllGlobalClaims() || []).find(c => c && c.id === subclaim.parentId) || null;
}

function loadFactionsData() {
    try {
        return JSON.parse(world.getDynamicProperty("factions") || "[]");
    } catch (e) {
        return [];
    }
}

function saveFactionsData(factions) {
    world.setDynamicProperty("factions", JSON.stringify(factions));
}

function updateFactionClaimRecord(factionId, claim) {
    const factions = loadFactionsData();
    const facIdx = factions.findIndex((f) => f.id === factionId);
    if (facIdx < 0) return false;

    const claims = factions[facIdx].claims || [];
    const claimIdx = claims.findIndex((c) => c && c.id === claim.id);
    if (claimIdx >= 0) claims[claimIdx] = claim;
    else claims.push(claim);

    factions[facIdx].claims = claims;
    saveFactionsData(factions);
    return true;
}

function removeFactionClaimRecord(factionId, claimId) {
    const factions = loadFactionsData();
    const fac = factions.find((f) => f.id === factionId);
    if (!fac?.claims) return false;

    fac.claims = fac.claims.filter((c) => c && c.id !== claimId);
    saveFactionsData(factions);
    return true;
}

function removeClaimFully(claim, notifyOwner = true) {
    removeFromGlobalClaims(claim);
    rebuildGlobalClaimChunkCache(true);

    if (claim.factionClaim) {
        removeFactionClaimRecord(claim.ownerId, claim.id);
        return;
    }

    const owner = world.getAllPlayers().find((p) => p.id === claim.ownerId);
    if (!owner || !notifyOwner) return;

    let ownerPlots = parseOwnedPlots(owner);
    if (ownerPlots === null) ownerPlots = [];

    const idx = ownerPlots.findIndex((p) => p.id === claim.id);
    if (idx < 0) return;

    ownerPlots.splice(idx, 1);
    owner.setDynamicProperty("owned_plots", JSON.stringify(ownerPlots));
    toastError(
        owner,
        `§c[Admin] Your plot "${claim.name}" was forcibly deleted by a Staff Member.`,
        "plot_admin_delete"
    );
}

function persistFactionClaim(plot, faction) {
    syncFactionDefaultToPublicPermissions(plot);
    syncFactionPublicToDefaultPermissions(plot);
    if (faction) updateFactionClaimRecord(faction.id, plot);
    return persistClaim(plot, null, null);
}

function openClaimPermissionsHub(player, selectedPlot, onBack, persistOverride) {
    const persist = persistOverride || ((claim) => persistClaim(claim, null, null));

    const permMenu = new ActionFormData()
        .title("bd.action:Manage Permissions")
        .button("§dPublic Permissions")
        .button("§ePlayer Permissions")
        .button("§7Back");

    system.runTimeout(() => {
        permMenu.show(player).then((pres) => {
            if (pres.canceled || pres.selection === 2) return onBack?.();

            player.playSound("random.pop");
            ensurePlotPermissionsDefault(selectedPlot);
            if (selectedPlot.factionClaim) syncFactionPublicToDefaultPermissions(selectedPlot);

            if (!selectedPlot.permissions.default) {
                selectedPlot.permissions.default = {
                    protectBreak: true,
                    protectPlace: true,
                    protectLiquid: true,
                    protectContainer: true,
                    protectDoors: true,
                    protectEnter: false,
                    protectEnderPearls: true,
                    protectExplosion: true,
                    protectFireSpread: true,
                    protectPvp: true,
                    protectInteract: true,
                    protectEntityKill: true,
                };
            }

            if (pres.selection === 0) {
                const defPerms = selectedPlot.permissions.default;
                const modal = new ModalFormData().title("bd.modal:Public Permissions");
                appendPlayerPermToggles(modal, defPerms);

                
                system.runTimeout(() => {
                    modal.show(player).then((res) => {
                        if (res.canceled) return openClaimPermissionsHub(player, selectedPlot, onBack, persist);

                        player.playSound("random.pop");
                        selectedPlot.permissions.default = buildPlayerPermObject(res.formValues, 0);

                        if (selectedPlot.factionClaim) {
                            syncFactionDefaultToPublicPermissions(selectedPlot);
                        }

                        if (!persist(selectedPlot)) {
                            sendError(player, "§cCould not save permissions.");
                        } else {
                            sendSuccess(player, "§aPublic permissions updated.");
                        }
                        openClaimPermissionsHub(player, selectedPlot, onBack, persist);
                    });
                }, 2);
                return;
            }

            openPlayerPermissionsMenu(player, selectedPlot, {
                onBack: () => openClaimPermissionsHub(player, selectedPlot, onBack, persist),
                persist,
            });
        });
    }, 2);
}

function startFactionClaimWand(player, faction) {
    player.setDynamicProperty("claim_for_faction", faction.id);
    try { player.addTag("plot_making"); } catch (e) { }

    if (!equipPlotClaimWand(player)) {
        sendError(player, "§cUnable to equip faction claim wand.");
        player.removeTag("plot_making");
        player.setDynamicProperty("claim_for_faction", undefined);
        return;
    }

    notify(
        player,
        "fac_claim_start",
        "§e§l[FACTION CLAIM]§r",
        "§eClaiming activated.\n§7A wooden axe has been equipped.",
        "random.pop"
    );
}

function getFactionById(factionId) {
    return loadFactionsData().find((f) => f.id === factionId) || null;
}

function resolveFactionClaim(faction, claimId) {
    const global = (getAllGlobalClaims() || []).find((c) => c && c.id === claimId);
    if (global) return global;
    return (faction?.claims || []).find((c) => c && c.id === claimId) || null;
}

function openFactionClaimsListMenu(player, faction) {
    const freshFaction = getFactionById(faction.id) || faction;
    const claimsForm = new ActionFormData().title("bd.action:Faction Claims");
    claimsForm.button("§aClaim New Plot\n§7Use Faction Claim Wand");

    const claims = freshFaction.claims || [];
    claims.forEach((c) => claimsForm.button(`§e${c.name || c.id}`));
    claimsForm.button("§7Back");

    system.runTimeout(() => {
        claimsForm.show(player).then((cr) => {
            if (cr.canceled || cr.selection === claims.length + 1) return openFactionsMenu(player);

            if (cr.selection === 0) {
                startFactionClaimWand(player, freshFaction);
                return;
            }

            const selectedClaim = resolveFactionClaim(freshFaction, claims[cr.selection - 1]?.id);
            if (!selectedClaim) {
                sendError(player, "§cThat faction claim could not be found.");
                return openFactionClaimsListMenu(player, freshFaction);
            }

            openFactionClaimManageMenu(player, freshFaction, selectedClaim, () => openFactionClaimsListMenu(player, freshFaction));
        });
    }, 3);
}

function openFactionClaimManageMenu(player, faction, claim, onBack) {
    const manageForm = new ActionFormData()
        .title(`bd.action:Faction Claim: ${claim.name || claim.id}`)
        .button("§aRename Claim")
        .button("§bManage Permissions")
        .button("§cDelete Claim")
        .button("§7Back");

    system.runTimeout(() => {
        manageForm.show(player).then((mres) => {
            if (mres.canceled || mres.selection === 3) return onBack?.();

            player.playSound("random.pop");

            if (mres.selection === 0) {
                const renameForm = new ModalFormData()
                    .title("bd.modal:Rename Faction Claim")
                    .textField("New Name", "Enter new name", { defaultValue: claim.name || "" });

                system.runTimeout(() => {
                    renameForm.show(player).then((rres) => {
                        if (rres.canceled) return openFactionClaimManageMenu(player, faction, claim, onBack);

                        player.playSound("random.pop");
                        claim.name = String(rres.formValues[0] || "").trim() || claim.name;

                        if (!persistFactionClaim(claim, faction)) {
                            sendError(player, "§cCould not save claim rename.");
                        } else {
                            sendSuccess(player, "§eFaction claim renamed.");
                        }
                        openFactionClaimManageMenu(player, faction, claim, onBack);
                    });
                }, 2);
                return;
            }

            if (mres.selection === 1) {
                return openClaimPermissionsHub(
                    player,
                    claim,
                    () => openFactionClaimManageMenu(player, faction, claim, onBack),
                    (plot) => persistFactionClaim(plot, faction)
                );
            }

            const confirm = new ActionFormData()
                .title("bd.action:Delete Faction Claim")
                .body(`§cDelete "${claim.name || claim.id}"?\n§7This cannot be undone.`)
                .button("§cYes, Delete")
                .button("§7Cancel");

            system.runTimeout(() => {
                confirm.show(player).then((confirmRes) => {
                    if (confirmRes.canceled || confirmRes.selection === 1) {
                        return openFactionClaimManageMenu(player, faction, claim, onBack);
                    }

                    player.playSound("random.pop");
                    removeClaimFully(claim, false);
                    sendSuccess(player, "§eFaction claim deleted.");
                    openFactionClaimsListMenu(player, faction);
                });
            }, 2);
        });
    }, 2);
}

function getAllSubclaimsSorted() {
    return (getAllGlobalClaims() || [])
        .filter(c => c && c.isSubclaim === true)
        .sort((a, b) => {
            const byParent = String(a.parentName || a.parentId || "").localeCompare(String(b.parentName || b.parentId || ""));
            if (byParent !== 0) return byParent;
            return String(a.name || "").localeCompare(String(b.name || ""));
        });
}

function openAdminClaimEditor(player, plot, onDone) {
    syncProtectedRoleTags(player);
    if (!isOperatorPlayer(player)) {
        sendError(player, "§cOperator only.");
        return onDone?.();
    }

    ensurePlotPermissionsDefault(plot);

    const allowBuilders = plot.permissions.default.allowBuilders === true;
    const allowTesterBuild = plot.permissions.default.allowTesterBypass === true;
    const allowTesterShulker = plot.permissions.default.allowTesterShulkerBypass === true;
    const hideEnterToast = plot.permissions.default.hideEnterToastForStaffRoles === true;

    const editor = new ModalFormData()
        .title("bd.modal:Admin Claim Editor")
        .toggle("§eAllow Creative Builders to edit this claim?", {
            defaultValue: allowBuilders
        })
        .toggle("§eAllow Tester Build/Break Bypass (10k zone)?\n§7Survival build, break, containers", {
            defaultValue: allowTesterBuild
        })
        .toggle("§eAllow Tester Bold/NBT Shulker Bypass?\n§7Bold-named & modified shulker boxes", {
            defaultValue: allowTesterShulker
        })
        .toggle("§eHide enter toast for all players?\n§7No enter message or sound on this claim", {
            defaultValue: hideEnterToast
        });

    system.runTimeout(() => {
        editor.show(player).then(bres => {
            if (bres.canceled) return onDone?.();

            player.playSound("random.pop");

            plot.permissions.default.allowBuilders = bres.formValues[0];
            plot.permissions.default.allowTesterBypass = bres.formValues[1];
            plot.permissions.default.allowTesterShulkerBypass = bres.formValues[2];
            plot.permissions.default.hideEnterToastForStaffRoles = bres.formValues[3];

            system.run(() => {
                if (!persistClaim(plot, player)) {
                    sendError(player, "§cCould not save claim to world data. Staff: use §eRepair Claim Storage§c in Land Claim, or Recover Claims.");
                    return onDone?.();
                }

                notify(
                    player,
                    "claim_editor_saved",
                    "§a§l[CLAIM EDITOR]§r",
                    `§a${plot.name || "Claim"} updated.\n` +
                        `§7Builders: §f${bres.formValues[0] ? "ON" : "OFF"} §8| ` +
                        `§7Tester build: §f${bres.formValues[1] ? "ON" : "OFF"} §8| ` +
                        `§7Shulker bypass: §f${bres.formValues[2] ? "ON" : "OFF"} §8| ` +
                        `§7Silent enter: §f${bres.formValues[3] ? "ON" : "OFF"}`,
                    "random.levelup"
                );

                onDone?.();
            });
        });
    }, 2);
}

function rtp(player) {
    if (isInCombat(player)) {
        sendError(player, `§cYou are in combat! Wait ${getCombatRemainingSeconds(player)}s.`);
        return false;
    }

    const cd = getTeleportCooldownRemainingSeconds(player);
    if (cd > 0) {
        sendError(player, `§cTeleport cooldown: ${cd}s`);
        return false;
    }
    startTeleportCooldown(player);
    player.addTag("queue_rtp");
    notify(player, "gui_rtp_start", "§e§l[RTP]§r", "§eSearching for a safe location...", "random.pop");
    system.runTimeout(() => player.playSound('random.pop'), 5);
    return true;
}

// ==========================================
// MENU FUNCTIONS
// ==========================================

export function openMainMenu(player) {
    if (isRainGuiMinigamePlayer(player)) return;

    if (isPrisonGuiBlocked(player)) {
        denyPrisonGuiUse(player);
        return;
    }

    if (isRainGuiBlocked(player)) {
        notify(player, "rain_gui_blocked", "§c§l[BLOCKED]§r", "§cYour role cannot use the Rain GUI.", "note.bass");
        return;
    }

    const menuEntries = [
        { label: '§r§6Auction House', icon: 'textures/bd/icons/download', action: () => openAuctionHouse(player) },
        { label: '§r§aTPA', icon: 'textures/bd/icons/tpa', action: () => openTpaMenu(player) },
        { label: '§r§bRTP', icon: 'textures/bd/icons/rtp', action: () => rtp(player) },
        { label: '§r§6Warps', icon: 'textures/bd/icons/warps', action: () => openWarpMenu(player) },
        { label: '§r§cFactions', icon: 'textures/bd/icons/factions', action: () => openFactionsMenu(player) },
        { label: '§r§eHomes', icon: 'textures/bd/icons/home', action: () => openHomesMenu(player) },
        { label: '§r§9Land Claim', icon: 'textures/bd/icons/land', action: () => openLandClaimMenu(player) },
        { label: '§r§dDaily Rewards', icon: 'textures/bd/icons/daily', action: () => openDailyRewardsMenu(player) },
        { label: '§r§bStats', icon: 'textures/bd/icons/info', action: () => showPlayerStats(player) },
        { label: '§r§6Bounty', icon: 'textures/items/gold_ingot', action: () => openBountyMenu(player) },
        { label: '§r§eCourt Case', icon: 'textures/bd/icons/courtcase', action: () => openCourtCaseMenu(player) },
        { label: '§r§cReport', icon: 'textures/items/paper', action: () => openReportMenu(player) },
    ];

    const mainForm = new ActionFormData()
        .title('bd.main:§r§d§lRAIN SMP GUI');

    for (const entry of menuEntries) {
        mainForm.button(entry.label, entry.icon);
    }

    showFormSafe(
        player,
        mainForm,
        (res) => {
            const selection = Number(res.selection);
            const entry = Number.isInteger(selection) ? menuEntries[selection] : undefined;
            if (!entry?.action) {
                sendError(player, "§cThat menu option is unavailable.");
                return openMainMenu(player);
            }
            try {
                player.playSound("random.pop");
            } catch (e) {}
            runGuiMenuAction(player, entry.action);
        },
        () => {}
    );
}

function openBountyMenu(player) {
    const form = new ActionFormData()
        .title('bd.action:§6Bounty')
        .body('§7View active bounties and place rewards on players.\n§8Coming soon.')
        .button('§7Back', 'textures/items/gold_ingot');

    showFormSafe(player, form, () => openMainMenu(player), () => openMainMenu(player));
}

function openCourtCaseMenu(player) {
    const form = new ActionFormData()
        .title('bd.action:§eCourt Case')
        .body('§7Submit cases, view hearings, and check court records.\n§8Coming soon.')
        .button('§7Back', 'textures/bd/icons/courtcase');

    showFormSafe(player, form, () => openMainMenu(player), () => openMainMenu(player));
}

function openReportMenu(player) {
    const form = new ActionFormData()
        .title('bd.action:§cReport')
        .body('§7Report rule breaks or player issues to staff.\n§8Coming soon.')
        .button('§7Back', 'textures/items/paper');

    showFormSafe(player, form, () => openMainMenu(player), () => openMainMenu(player));
}


function openTpaMenu(player) {
    const tpaForm = new ActionFormData()
        .title("bd.action:TPA Menu")
        .button("§aSend TPA Request")
        .button("§eAccept Pending TPA")
        .button("§cDeny Pending TPA")
        .button("§7Back");

    showFormSafe(
        player,
        tpaForm,
        (res) => {
            player.playSound('random.pop');

            if (res.selection === 0) {
                const players = world.getAllPlayers().filter(p => p !== player);
                if (players.length === 0) {
                    sendError(player, 'No other players online.');
                    return openTpaMenu(player);
                }
                const listForm = new ActionFormData().title('bd.action:Select Player');
                players.forEach(p => listForm.button('§a' + p.name));
                listForm.button('§7Back');
                
                system.runTimeout(() => {
                    listForm.show(player).then(listRes => {
                        if (listRes.canceled) return openTpaMenu(player);
                        player.playSound('random.pop');
                        if (listRes.selection === players.length) return openTpaMenu(player);
                        
                        const target = players[listRes.selection];
                        if (createTpaRequest(player, target)) {
                            sendSuccess(player, `§eTPA request sent to ${target.name}`);
                            toastInfo(target, `§e${player.name} wants to teleport to you. Open the GUI to Accept/Reject!`, "tpa_invite");
                        }
                    });
                }, 2);
            } 
            else if (res.selection === 1) {
                acceptTpaRequest(player);
                openTpaMenu(player);
            }
            else if (res.selection === 2) {
                rejectTpaRequest(player);
                openTpaMenu(player);
            }
            else if (res.selection === 3) {
                openMainMenu(player);
            }
        },
        () => openMainMenu(player)
    );
}

function openWarpMenu(player) {
    const warps = parseJsonArray(world.getDynamicProperty('warps'));
    const warpForm = new ActionFormData().title('bd.action:Select Warp');
    warps.forEach(w => warpForm.button('§6' + w.name));
    
    if (isStaffPlayer(player)) warpForm.button('§dManage Warps');
    warpForm.button('§7Back');
    
    showFormSafe(
        player,
        warpForm,
        (res) => {
            player.playSound('random.pop');
            
            const isStaffBtn = isStaffPlayer(player) && res.selection === warps.length;
            const isBackBtn = res.selection === warps.length + (isStaffPlayer(player) ? 1 : 0);
            
            if (isBackBtn) return openMainMenu(player);
            
            if (isStaffBtn) {
                const manageForm = new ActionFormData().title('bd.action:Manage Warps');
                manageForm.button('§aAdd Warp');
                manageForm.button('§eEdit Warp');
                manageForm.button('§cDelete Warp');
                manageForm.button('§7Back');

                system.runTimeout(() => {
                    manageForm.show(player).then(mres => {
                        if (mres.canceled || mres.selection === 3) return openWarpMenu(player);
                        player.playSound('random.pop');

                        if (mres.selection === 0) {
                            const addForm = new ModalFormData().title('bd.modal:Add Warp').textField('Name', 'e.g. spawn');
                            system.runTimeout(() => {
                                addForm.show(player).then(ares => {
                                    if (ares.canceled) return openWarpMenu(player);
                                    player.playSound('random.pop');
                                    const [name] = ares.formValues;
                                    if (!name) return sendError(player, '§cInvalid input');
                                    const pos = player.location || { x: 0, y: 0, z: 0 };
                                    const dim = player.dimension.id;
                                    warps.push({ name, x: pos.x, y: pos.y, z: pos.z, dimension: dim });
                                    world.setDynamicProperty('warps', JSON.stringify(warps));
                                    sendSuccess(player, `§eWarp added!`);
                                    openWarpMenu(player);
                                });
                            }, 2);
                        } else if (mres.selection === 1) {
                            const editList = new ActionFormData().title('bd.action:Edit Warp');
                            warps.forEach(w => editList.button('§e' + w.name));
                            editList.button('§7Back');
                            system.runTimeout(() => {
                                editList.show(player).then(eres => {
                                    if (eres.canceled || eres.selection === warps.length) return openWarpMenu(player);
                                    player.playSound('random.pop');
                                    const idx = eres.selection;
                                    const w = warps[idx];
                                    const editForm = new ModalFormData().title('bd.modal:Edit Warp')
                                        .textField('Name', 'Enter name', { defaultValue: w.name })
                                        .textField('X', 'X coord', { defaultValue: w.x.toString() })
                                        .textField('Y', 'Y coord', { defaultValue: w.y.toString() })
                                        .textField('Z', 'Z coord', { defaultValue: w.z.toString() });
                                    system.runTimeout(() => {
                                        editForm.show(player).then(eResFinal => {
                                            if (eResFinal.canceled) return openWarpMenu(player);
                                            const [name, x, y, z] = eResFinal.formValues;
                                            warps[idx] = { name, x: parseFloat(x), y: parseFloat(y), z: parseFloat(z), dimension: w.dimension };
                                            world.setDynamicProperty('warps', JSON.stringify(warps));
                                            sendSuccess(player, '§eWarp updated');
                                            openWarpMenu(player);
                                        });
                                    }, 2);
                                });
                            }, 2);
                        } else if (mres.selection === 2) {
                            const delList = new ActionFormData().title('bd.action:Delete Warp');
                            warps.forEach(w => delList.button('§c' + w.name));
                            delList.button('§7Back');
                            system.runTimeout(() => {
                                delList.show(player).then(dres => {
                                    if (dres.canceled || dres.selection === warps.length) return openWarpMenu(player);
                                    player.playSound('random.pop');
                                    warps.splice(dres.selection, 1);
                                    world.setDynamicProperty('warps', JSON.stringify(warps));
                                    sendSuccess(player, '§eWarp deleted');
                                    openWarpMenu(player);
                                });
                            }, 2);
                        }
                    });
                }, 2);
                return;
            }
            
            const selectedWarp = warps[res.selection];
            if (!selectedWarp) return openWarpMenu(player);

            const cd = getTeleportCooldownRemainingSeconds(player);
            if (cd > 0) {
                sendError(player, `§cTeleport cooldown: ${cd}s`);
                return openWarpMenu(player);
            }
            
            startTeleportCooldown(player);
            const targetDimension = world.getDimension(selectedWarp.dimension || 'minecraft:overworld');
            player.teleport({x: selectedWarp.x, y: selectedWarp.y, z: selectedWarp.z}, { dimension: targetDimension });
            sendSuccess(player, `§eTeleported to ${selectedWarp.name}`);
        },
        () => openMainMenu(player)
    );
}

export function openHomesMenu(player) {
    const homesStr = player.getDynamicProperty('homes') || '[]';
    let homes = [];
    try {
        homes = JSON.parse(homesStr);
        if (!Array.isArray(homes)) homes = [];
    } catch (e) {
        sendError(player, "§cHome data was corrupted. Resetting homes list.");
        homes = [];
        saveHomesForPlayer(player, homes);
    }
    homes = homes.map(sanitizeHomeForAdminIndex).filter(Boolean).slice(0, 15);
    syncAdminHomesIndexForPlayer(player, homes);
    const isStaff = isStaffPlayer(player);
    const homesForm = new ActionFormData().title('bd.action:Homes');
    
    homesForm.button('§aCreate New Home');
    if (isStaff) {
        homesForm.button("§9[Admin] Home Browser\n§7Search all indexed homes");
    }
    homes.forEach(h => homesForm.button('§e' + (h.name || 'Home')));
    homesForm.button('§7Back');

    showFormSafe(
        player,
        homesForm,
        (res) => {
            const createIdx = 0;
            const adminHomesIdx = isStaff ? 1 : -1;
            const homesStartIdx = isStaff ? 2 : 1;
            const backIdx = homesStartIdx + homes.length;

            if (res.selection === backIdx) return openMainMenu(player);
            if (adminHomesIdx >= 0 && res.selection === adminHomesIdx) return openAdminHomesMenu(player);

            if (res.selection === createIdx) {
                if (homes.length >= 15) {
                    notify(player, "home_err", "§c§l[LIMIT REACHED]§r", "§cYou can only have up to 15 homes.", "note.bass");
                    return openHomesMenu(player);
                }

                const pos = player.location || { x: 0, y: 0, z: 0 };
                const dim = player.dimension?.id || "minecraft:overworld";
                const standingInClaim = (getAllGlobalClaims() || [])
                    .filter((plot) => (plot.dimension || "minecraft:overworld") === dim)
                    .filter((plot) => {
                        const minX = Math.min(Number(plot.minX), Number(plot.maxX));
                        const maxX = Math.max(Number(plot.minX), Number(plot.maxX));
                        const minZ = Math.min(Number(plot.minZ), Number(plot.maxZ));
                        const maxZ = Math.max(Number(plot.minZ), Number(plot.maxZ));
                        return pos.x >= minX && pos.x <= maxX + 1 && pos.z >= minZ && pos.z <= maxZ + 1;
                    })
                    .sort((a, b) => {
                        if (a.isSubclaim && !b.isSubclaim) return -1;
                        if (!a.isSubclaim && b.isSubclaim) return 1;
                        return 0;
                    })[0];

                if (standingInClaim && !isHomeAllowedInClaim(standingInClaim, player)) {
                    notify(
                        player,
                        "home_err",
                        "§c§l[CLAIMED LAND]§r",
                        `§cYou cannot set a home in ${standingInClaim.ownerName || "this"}'s claim!`,
                        "note.bass"
                    );
                    return openHomesMenu(player);
                }

                const nameForm = new ModalFormData()
                    .title('bd.modal:Set Home')
                    .textField('Home Name', 'Enter a name', { defaultValue: `${player.name}'s Home ${homes.length + 1}` });

                showFormSafe(
                    player,
                    nameForm,
                    (nRes) => {
                        const homePos = player.location || { x: 0, y: 0, z: 0 };
                        const newHome = {
                            id: Date.now().toString(),
                            name: normalizeHomeName(nRes.formValues?.[0], `${player.name}'s Home ${homes.length + 1}`),
                            x: homePos.x,
                            y: homePos.y,
                            z: homePos.z,
                            dimension: player.dimension?.id || 'minecraft:overworld'
                        };

                        const nextHomes = homes.concat(newHome);
                        if (!saveHomesForPlayer(player, nextHomes)) return openHomesMenu(player);

                        notify(player, "home_set", "§a§l[HOME SET]§r", `§aSuccessfully created home:\n§e${newHome.name}`, "random.levelup");
                        openHomesMenu(player);
                    },
                    () => openHomesMenu(player)
                );
                return;
            }

            const selectedHomeIndex = Number(res.selection) - homesStartIdx;
            const selected = homes[selectedHomeIndex];
            if (!selected) return openHomesMenu(player);

            openHomeManageMenu(player, homes, selectedHomeIndex);
        },
        () => openMainMenu(player)
    );
}

function openHomeManageMenu(player, homes, selectedHomeIndex) {
    const selected = homes[selectedHomeIndex];
    if (!selected) return openHomesMenu(player);

    const manage = new ActionFormData().title('bd.action:' + selected.name)
        .body(
            `§7Dimension: §f${selected.dimension || "minecraft:overworld"}\n` +
            `§7Coords: §f${Math.floor(selected.x)}, ${Math.floor(selected.y)}, ${Math.floor(selected.z)}`
        )
        .button('§aTeleport')
        .button('§eRename')
        .button('§cDelete')
        .button('§7Back');

    showFormSafe(
        player,
        manage,
        (mRes) => {
            if (mRes.selection === 0) {
                let targetDimension;
                try {
                    targetDimension = world.getDimension(selected.dimension || 'minecraft:overworld');
                } catch (e) {
                    sendError(player, "§cThat home's dimension is unavailable.");
                    return openHomesMenu(player);
                }

                try {
                    player.teleport(
                        { x: Number(selected.x) || 0, y: Number(selected.y) || 0, z: Number(selected.z) || 0 },
                        { dimension: targetDimension }
                    );
                    notify(player, "home_tp", "§a§l[TELEPORT]§r", `§eWarped to ${selected.name}`, "random.pop");
                } catch (e) {
                    console.warn(`[RAIN GUI] home teleport failed for ${player.name}: ${e}`);
                    sendError(player, "§cCould not teleport to that home.");
                    openHomesMenu(player);
                }
                return;
            }

            if (mRes.selection === 1) {
                const rename = new ModalFormData()
                    .title('bd.modal:Rename Home')
                    .textField('New name', 'Enter new name', { defaultValue: selected.name });

                showFormSafe(
                    player,
                    rename,
                    (rn) => {
                        const nextHomes = homes.slice();
                        nextHomes[selectedHomeIndex] = {
                            ...selected,
                            name: normalizeHomeName(rn.formValues?.[0], selected.name)
                        };

                        if (!saveHomesForPlayer(player, nextHomes)) return openHomesMenu(player);

                        notify(player, "home_rn", "§e§l[RENAMED]§r", `§eHome renamed to ${nextHomes[selectedHomeIndex].name}.`, "random.pop");
                        openHomesMenu(player);
                    },
                    () => openHomesMenu(player)
                );
                return;
            }

            if (mRes.selection === 2) {
                const nextHomes = homes.slice();
                nextHomes.splice(selectedHomeIndex, 1);
                if (!saveHomesForPlayer(player, nextHomes)) return openHomesMenu(player);

                notify(player, "home_del", "§c§l[DELETED]§r", "§cHome removed successfully.", "random.pop");
                return openHomesMenu(player);
            }

            openHomesMenu(player);
        },
        () => openHomesMenu(player)
    );
}

function openAdminHomesSearchModal(player, currentSearch = "") {
    const modal = new ModalFormData()
        .title("bd.modal:[Admin] Search Homes")
        .textField("Search owner/home/dimension", "e.g. sabeeh, base, nether", { defaultValue: currentSearch });

    showFormSafe(
        player,
        modal,
        (res) => {
            const search = String(res.formValues?.[0] || "").trim();
            openAdminHomesMenu(player, search);
        },
        () => openAdminHomesMenu(player, currentSearch)
    );
}

function openAdminHomeActionsMenu(player, row, search = "") {
    const homeDim = row.dimension || "minecraft:overworld";
    const form = new ActionFormData()
        .title(`bd.action:§9[Admin] ${row.name}`)
        .body(
            `§7Owner: §f${row.ownerName}\n` +
            `§7Dimension: §f${homeDim}\n` +
            `§7Coords: §f${Math.floor(row.x)}, ${Math.floor(row.y)}, ${Math.floor(row.z)}\n` +
            `§8ID: ${row.ownerId || "unknown"}`
        )
        .button("§aTeleport")
        .button("§eRefresh Online Cache")
        .button("§7Back");

    showFormSafe(
        player,
        form,
        (res) => {
            if (res.selection === 0) {
                let dim;
                try {
                    dim = world.getDimension(homeDim);
                } catch (e) {
                    sendError(player, "§cThat home's dimension is unavailable.");
                    return openAdminHomesMenu(player, search);
                }
                player.teleport(
                    { x: Number(row.x) || 0, y: Number(row.y) || 0, z: Number(row.z) || 0 },
                    { dimension: dim }
                );
                sendSuccess(player, `§aTeleported to ${row.ownerName}'s home: §e${row.name}`);
                return openAdminHomesMenu(player, search);
            }

            if (res.selection === 1) {
                refreshAdminHomesIndexFromOnlinePlayers();
                sendSuccess(player, "§aHome index refreshed from online players.");
                return openAdminHomesMenu(player, search);
            }

            openAdminHomesMenu(player, search);
        },
        () => openAdminHomesMenu(player, search)
    );
}

function openAdminHomesMenu(player, search = "") {
    if (!isStaffPlayer(player)) {
        sendError(player, "§cStaff only.");
        return openHomesMenu(player);
    }

    refreshAdminHomesIndexFromOnlinePlayers();
    const rows = getAdminHomeRows(search);
    const prettySearch = search ? `§f${search}` : "§7All homes";
    const form = new ActionFormData()
        .title("bd.action:§9[Admin] Home Browser")
        .body(
            rows.length > 0
                ? `§7Total Indexed: §f${rows.length}\n§7Filter: ${prettySearch}\n§8Tip: Search by owner, home name, or dimension`
                : `§7No homes indexed yet.\n§7Use refresh to scan online players.\n§7Filter: ${prettySearch}`
        )
        .button("§bSearch / Filter")
        .button("§dClear Filter")
        .button("§aRefresh Online Cache");

    rows.forEach((row) => {
        const dim = String(row.dimension || "minecraft:overworld").replace("minecraft:", "");
        form.button(
            `§e${row.ownerName} §7- §f${row.name}\n§8${dim} §7· §f${Math.floor(row.x)}, ${Math.floor(row.z)}`
        );
    });

    form.button("§7Back");

    showFormSafe(
        player,
        form,
        (res) => {
            if (res.selection === 0) {
                return openAdminHomesSearchModal(player, search);
            }

            if (res.selection === 1) {
                return openAdminHomesMenu(player, "");
            }

            if (res.selection === 2) {
                refreshAdminHomesIndexFromOnlinePlayers();
                sendSuccess(player, "§aHome index refreshed from online players.");
                return openAdminHomesMenu(player, search);
            }

            const rowIndex = Number(res.selection) - 3;
            const backIndex = rows.length + 3;

            if (res.selection === backIndex) {
                return openHomesMenu(player);
            }

            const selected = rows[rowIndex];
            if (!selected) {
                return openAdminHomesMenu(player, search);
            }
            openAdminHomeActionsMenu(player, selected, search);
        },
        () => openHomesMenu(player)
    );
}

function openCreateAdminSubclaimMenu(player, parentClaim) {
    if (!isStaffPlayer(player)) {
        sendError(player, "§cStaff only.");
        return;
    }

    const inventory = player.getComponent("minecraft:inventory");

    if (!inventory || !inventory.container) {
        sendError(player, "§cUnable to access inventory.");
        return;
    }

    const selectedSlot = player.selectedSlotIndex;

    player.addTag("plot_making");
    player.addTag("plot_subclaim_making");

    player.setDynamicProperty("subclaim_parent_id", parentClaim.id);
    player.setDynamicProperty("plot_pos1", undefined);
    player.setDynamicProperty("plot_pos2", undefined);

    if (!equipPlotClaimWand(player, selectedSlot)) {
        sendError(player, "§cUnable to equip subclaim wand.");
        player.removeTag("plot_making");
        player.removeTag("plot_subclaim_making");
        return;
    }

    toastInfo(player, `§d[Subclaim] §eCreating admin subclaim inside: §f${parentClaim.name}`, "subclaim_start");
    toastInfo(player, "§eUse the wooden axe on one corner, then use it on the opposite corner.", "subclaim_axe");
    toast(player, "§7All permission settings appear when you select Pos2.", "subclaim_hint");
    player.playSound("random.pop");
}

function openAllSubclaimsMenu(player) {
    if (!isStaffPlayer(player)) {
        sendError(player, "§cStaff only.");
        return openLandClaimMenu(player);
    }

    const subclaims = getAllSubclaimsSorted();

    const form = new ActionFormData()
        .title("bd.action:§d[Admin] All Subclaims")
        .body(
            subclaims.length > 0
                ? `§7Quick access to every admin subclaim.\n§7Total: §f${subclaims.length}`
                : "§7No subclaims exist yet.\n§7Create one from a parent claim's subclaim menu."
        )
        .button("§aCreate Subclaim (pick parent)");

    subclaims.forEach(sub => {
        form.button(
            `§d${sub.name}\n§7Parent: ${sub.parentName || "Unknown"} · ${sub.minX}, ${sub.minZ}`
        );
    });

    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then(res => {
            if (res.canceled) return openLandClaimMenu(player);

            player.playSound("random.pop");

            if (res.selection === 0) {
                return openSubclaimParentPicker(player);
            }

            if (res.selection === subclaims.length + 1) {
                return openLandClaimMenu(player);
            }

            const selectedSubclaim = subclaims[res.selection - 1];
            const parentClaim = getParentClaimForSubclaim(selectedSubclaim);

            if (!parentClaim) {
                sendError(player, "§cParent claim not found for this subclaim.");
                return openAllSubclaimsMenu(player);
            }

            return openManageSubclaimMenu(player, parentClaim, selectedSubclaim, () => openAllSubclaimsMenu(player));
        });
    }, 2);
}

function openSubclaimParentPicker(player) {
    const parentClaims = (getAllGlobalClaims() || []).filter(c => c && !c.isSubclaim);

    if (parentClaims.length === 0) {
        sendError(player, "§cNo parent claims exist.");
        return openAllSubclaimsMenu(player);
    }

    parentClaims.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    const form = new ActionFormData()
        .title("bd.action:Select Parent Claim")
        .body("§7Pick which claim to create a subclaim inside.");

    parentClaims.forEach(c => {
        form.button(`§e${c.name}\n§7Owner: ${c.ownerName || "Server"}`);
    });
    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then(res => {
            if (res.canceled || res.selection === parentClaims.length) {
                return openAllSubclaimsMenu(player);
            }

            player.playSound("random.pop");
            openCreateAdminSubclaimMenu(player, parentClaims[res.selection]);
        });
    }, 2);
}

function openSubclaimsMenu(player, parentClaim) {
    if (!isStaffPlayer(player)) {
        sendError(player, "§cStaff only.");
        return openLandClaimMenu(player);
    }

    const allClaims = getAllGlobalClaims() || [];
    const subclaims = allClaims.filter(c =>
        c &&
        c.isSubclaim === true &&
        c.parentId === parentClaim.id
    );

    const form = new ActionFormData()
        .title(`bd.action:Subclaims: ${parentClaim.name}`)
        .body(`§7Parent Claim: §f${parentClaim.name}\n§7Subclaims: §f${subclaims.length}`)
        .button("§aCreate New Subclaim");

    subclaims.forEach(sub => {
        form.button(`§d${sub.name}\n§7${sub.minX}, ${sub.minZ} → ${sub.maxX}, ${sub.maxZ}`);
    });

    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then(res => {
            if (res.canceled) return openLandClaimMenu(player);

            player.playSound("random.pop");

            if (res.selection === 0) {
                return openCreateAdminSubclaimMenu(player, parentClaim);
            }

            if (res.selection === subclaims.length + 1) {
                return openLandClaimMenu(player);
            }

            const selectedSubclaim = subclaims[res.selection - 1];
            return openManageSubclaimMenu(player, parentClaim, selectedSubclaim);
        });
    }, 2);
}

function openManageSubclaimMenu(player, parentClaim, subclaim, onBack = null) {
    const goBack = onBack || (() => openSubclaimsMenu(player, parentClaim));

    const form = new ActionFormData()
        .title(`bd.action:Subclaim: ${subclaim.name}`)
        .body(
            `§7Parent: §f${parentClaim.name}\n` +
            `§7Owner: §f${subclaim.ownerName || "Server"}\n` +
            `§7Area: §f${subclaim.area || "Unknown"} blocks`
        )
        .button("§aRename Subclaim")
        .button("§bManage Permissions")
        .button("§eTeleport to Subclaim")
        .button("§cDelete Subclaim")
        .button("§7Back");

    system.runTimeout(() => {
        form.show(player).then(res => {
            if (res.canceled) return goBack();

            player.playSound("random.pop");

            if (res.selection === 0) {
                const renameForm = new ModalFormData()
                    .title("bd.modal:Rename Subclaim")
                    .textField("New Subclaim Name", "Enter new name", {
                        defaultValue: subclaim.name
                    });

                system.runTimeout(() => {
                    renameForm.show(player).then(renameRes => {
                        if (renameRes.canceled) {
                            return openManageSubclaimMenu(player, parentClaim, subclaim, onBack);
                        }

                        const newName = String(renameRes.formValues[0] || subclaim.name).trim();

                        subclaim.name = newName || subclaim.name;

                        if (!persistSubclaim(subclaim)) {
                            sendError(player, "§cCould not save subclaim rename.");
                        } else {
                            sendSuccess(player, "§aSubclaim renamed.");
                        }
                        goBack();
                    });
                }, 2);
            } else if (res.selection === 1) {
                return openSubclaimManagePermissionsMenu(player, parentClaim, subclaim, onBack);
            } else if (res.selection === 2) {
                const dim = world.getDimension(subclaim.dimension || "minecraft:overworld");

                teleportPlayerToClaim(
                    player,
                    dim,
                    subclaim.minX,
                    subclaim.y || 200,
                    subclaim.minZ,
                    () => {
                        sendSuccess(player, "§aTeleported to subclaim.");
                        openManageSubclaimMenu(player, parentClaim, subclaim, onBack);
                    }
                );
                return;
            } else if (res.selection === 3) {
                const confirm = new ActionFormData()
                    .title("bd.action:Delete Subclaim")
                    .body(`§cDelete subclaim "${subclaim.name}"?\n§7This cannot be undone.`)
                    .button("§cYes, Delete")
                    .button("§7Cancel");

                system.runTimeout(() => {
                    confirm.show(player).then(confirmRes => {
                        if (confirmRes.canceled || confirmRes.selection === 1) {
                            return openManageSubclaimMenu(player, parentClaim, subclaim, onBack);
                        }

                        removeFromGlobalClaims(subclaim);
                        rebuildGlobalClaimChunkCache(true);

                        sendSuccess(player, "§cSubclaim deleted.");
                        goBack();
                    });
                }, 2);
            } else {
                goBack();
            }
        });
    }, 2);
}

function openSubclaimManagePermissionsMenu(player, parentClaim, subclaim, onBack = null) {
    const goBack = onBack || (() => openManageSubclaimMenu(player, parentClaim, subclaim, onBack));

    const permMenu = new ActionFormData()
        .title("bd.action:Subclaim Permissions")
        .button("§dPublic Permissions")
        .button("§ePlayer Permissions")
        .button("§7Back");

    system.runTimeout(() => {
        permMenu.show(player).then(pres => {
            if (pres.canceled || pres.selection === 2) {
                return openManageSubclaimMenu(player, parentClaim, subclaim, onBack);
            }

            player.playSound("random.pop");

            if (pres.selection === 0) {
                return openSubclaimPermissionsMenu(player, parentClaim, subclaim, onBack);
            }

            return openPlayerPermissionsMenu(player, subclaim, {
                onBack: () => openSubclaimManagePermissionsMenu(player, parentClaim, subclaim, onBack),
                persist: persistSubclaim,
            });
        });
    }, 2);
}

function openSubclaimPermissionsMenu(player, parentClaim, subclaim, onBack = null) {
    ensurePlotPermissionsDefault(subclaim);

    const modal = new ModalFormData().title("bd.modal:Subclaim Public Permissions");
    appendSubclaimPublicPermToggles(modal, subclaim.permissions.default);

    system.runTimeout(() => {
        modal.show(player).then(res => {
            if (res.canceled) {
                return openSubclaimManagePermissionsMenu(player, parentClaim, subclaim, onBack);
            }

            subclaim.permissions.default = buildSubclaimPublicPermObject(res.formValues, 0);
            if (!persistSubclaim(subclaim)) {
                sendError(player, "§cFailed to save subclaim permissions.");
                return openSubclaimManagePermissionsMenu(player, parentClaim, subclaim, onBack);
            }

            sendSuccess(player, "§aSubclaim permissions updated.");
            openSubclaimManagePermissionsMenu(player, parentClaim, subclaim, onBack);
        });
    }, 2);
}

function openAdminClaimsFilterMenu(player) {
    const form = new ActionFormData()
        .title("bd.action:§c[Admin] Claims")
        .body("§7Choose which claims to view and manage.")
        .button("§eAll Claims")
        .button("§6Faction Claims Only")
        .button("§aPersonal Claims")
        .button("§dSubclaims Only")
        .button("§7Back");

    system.runTimeout(() => {
        form.show(player).then((res) => {
            if (res.canceled || res.selection === 4) return openLandClaimMenu(player);

            player.playSound("random.pop");

            const filters = ["all", "faction", "personal", "subclaim"];
            openAdminClaimsMenu(player, filters[res.selection]);
        });
    }, 2);
}

function openAdminClaimsMenu(player, filter = "all") {
    let allClaims = (getAllGlobalClaims() || []).slice();

    if (filter === "faction") {
        allClaims = allClaims.filter((c) => c.factionClaim);
    } else if (filter === "personal") {
        allClaims = allClaims.filter((c) => !c.factionClaim && !c.isSubclaim);
    } else if (filter === "subclaim") {
        allClaims = allClaims.filter((c) => c.isSubclaim);
    }

    allClaims.sort((a, b) => {
        if (a.isSubclaim && !b.isSubclaim) return -1;
        if (!a.isSubclaim && b.isSubclaim) return 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
    });

    if (allClaims.length === 0) {
        sendError(player, "§cNo claims match this filter.");
        return openAdminClaimsFilterMenu(player);
    }

    const filterLabel =
        filter === "faction" ? "Faction Claims" :
        filter === "personal" ? "Personal Claims" :
        filter === "subclaim" ? "Subclaims" :
        "All Claims";

    const form = new ActionFormData().title(`bd.action:§c[Admin] ${filterLabel}`);

    allClaims.forEach((c) => {
        const typeTag = c.isSubclaim ? "§d[Subclaim] " : c.factionClaim ? "§6[Faction] " : "§e";
        form.button(`${typeTag}${c.name}\n§7Owner: ${c.ownerName || "Server"}`);
    });

    form.button("§7Change Filter");
    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then((res) => {
            if (res.canceled) return openLandClaimMenu(player);

            player.playSound("random.pop");

            if (res.selection === allClaims.length) {
                return openAdminClaimsFilterMenu(player);
            }

            if (res.selection === allClaims.length + 1) {
                return openLandClaimMenu(player);
            }

            const selected = allClaims[res.selection];
            const parentClaim = selected.isSubclaim ? getParentClaimForSubclaim(selected) : null;

            const manage = new ActionFormData()
                .title(`bd.action:Manage ${selected.name}`)
                .body(
                    `Owner: ${selected.ownerName || "Server"}\n` +
                    `Dimension: ${selected.dimension || "minecraft:overworld"}\n` +
                    `${selected.factionClaim ? "§6Type: Faction Claim\n" : ""}` +
                    `${selected.isSubclaim ? "§dType: Admin Subclaim\n" : ""}` +
                    `${selected.parentName ? `§7Parent: ${selected.parentName}\n` : ""}`
                )
                .button("§aTeleport to Plot")
                .button("§bManage Permissions");

            if (!selected.isSubclaim) {
                manage.button("§dSubclaims");
            }

            if (isOperatorPlayer(player)) {
                manage.button("§4Claim Editor");
            }

            manage
                .button("§cForce Delete Plot")
                .button("§7Back");

            system.runTimeout(() => {
                manage.show(player).then((mres) => {
                    if (mres.canceled) return openAdminClaimsMenu(player, filter);

                    player.playSound("random.pop");

                    let actionIdx = 0;
                    const tpIdx = actionIdx++;
                    const permsIdx = actionIdx++;
                    const subsIdx = !selected.isSubclaim ? actionIdx++ : -1;
            const editorIdx = isOperatorPlayer(player) ? actionIdx++ : -1;
            const deleteIdx = actionIdx++;
                    const backIdx = actionIdx;

                    if (mres.selection === tpIdx) {
                        const dim = world.getDimension(selected.dimension || "minecraft:overworld");
                        teleportPlayerToClaim(
                            player,
                            dim,
                            selected.minX,
                            200,
                            selected.minZ,
                            () => sendSuccess(player, "Teleported to plot. Use slow falling!")
                        );
                        return;
                    }

                    if (mres.selection === permsIdx) {
                        const persist = (claim) => {
                            if (claim.factionClaim) {
                                syncFactionDefaultToPublicPermissions(claim);
                                syncFactionPublicToDefaultPermissions(claim);
                                updateFactionClaimRecord(claim.ownerId, claim);
                            }
                            return selected.isSubclaim ? persistSubclaim(claim) : persistClaim(claim, null, null);
                        };

                        if (selected.isSubclaim && parentClaim) {
                            return openManageSubclaimMenu(player, parentClaim, selected, () => openAdminClaimsMenu(player, filter));
                        }

                        return openClaimPermissionsHub(
                            player,
                            selected,
                            () => openAdminClaimsMenu(player, filter),
                            persist
                        );
                    }

                    if (subsIdx >= 0 && mres.selection === subsIdx) {
                        return openSubclaimsMenu(player, selected);
                    }

                    if (editorIdx >= 0 && mres.selection === editorIdx) {
                        return openAdminClaimEditor(player, selected, () => openAdminClaimsMenu(player, filter));
                    }

                    if (mres.selection === deleteIdx) {
                        removeClaimFully(selected);
                        sendSuccess(player, "§aPlot deleted from the server successfully.");
                        return openAdminClaimsMenu(player, filter);
                    }

                    if (mres.selection === backIdx) {
                        openAdminClaimsMenu(player, filter);
                    }
                });
            }, 2);
        });
    }, 2);
}

function normalizePermContext(player, selectedPlot, contextOrPlots) {
    if (Array.isArray(contextOrPlots)) {
        return {
            ownerPlayer: player,
            plots: contextOrPlots,
            onBack: () => openLandClaimMenu(player),
            persist: (claim) => persistClaim(claim, player, contextOrPlots),
        };
    }

    const context = contextOrPlots || {};
    return {
        ownerPlayer: context.ownerPlayer ?? player,
        plots: context.plots ?? null,
        onBack: context.onBack || (() => openLandClaimMenu(player)),
        persist: context.persist || ((claim) => persistClaim(claim, context.ownerPlayer ?? player, context.plots)),
    };
}

function saveClaimPlayerPermission(selectedPlot, storageKey, permObject, previousKey, persist) {
    ensurePlotPermissionsDefault(selectedPlot);

    const key = String(storageKey || "").trim();
    if (!key) {
        return false;
    }

    const previousEntry =
        previousKey && selectedPlot.permissions.players[previousKey]
            ? { ...selectedPlot.permissions.players[previousKey] }
            : null;

    if (previousKey && previousKey !== key) {
        delete selectedPlot.permissions.players[previousKey];
    }

    const online = world.getAllPlayers().find(
        (p) => p.name.toLowerCase() === key.toLowerCase()
    );
    if (online) {
        permObject.playerId = online.id;
        permObject.displayName = online.name;
    } else {
        permObject.displayName = key;
    }

    selectedPlot.permissions.players[key] = permObject;

    if (!persist(selectedPlot)) {
        delete selectedPlot.permissions.players[key];
        if (previousKey) {
            if (previousEntry) {
                selectedPlot.permissions.players[previousKey] = previousEntry;
            } else {
                delete selectedPlot.permissions.players[previousKey];
            }
        }
        return false;
    }

    if (online) {
        if (permObject.protectEnter === true) {
            markPlayerEnterRestricted(online);
        } else {
            clearPlayerEnterRestricted(online);
        }
        system.run(() => enforcePlotEnterDenyForPlayer(online));
    }

    return true;
}

function isPlayerAlreadyInPermList(plot, targetPlayer) {
    if (!plot?.permissions?.players || !targetPlayer) return false;

    const targetName = targetPlayer.name.toLowerCase();
    for (const key of Object.keys(plot.permissions.players)) {
        const entry = plot.permissions.players[key];
        if (key.toLowerCase() === targetName || entry?.playerId === targetPlayer.id) {
            return true;
        }
    }

    return false;
}

function openAddPlayerPermPicker(player, selectedPlot, contextOrPlots, onDone) {
    const context = normalizePermContext(player, selectedPlot, contextOrPlots);
    ensurePlotPermissionsDefault(selectedPlot);

    const candidates = world.getAllPlayers().filter((p) => {
        if (p.id === player.id) return false;
        if (p.id === selectedPlot.ownerId) return false;
        if (p.name.toLowerCase() === String(selectedPlot.ownerName || "").toLowerCase()) return false;
        return !isPlayerAlreadyInPermList(selectedPlot, p);
    });

    if (candidates.length === 0) {
        sendError(player, "§cNo eligible online players to add.");
        return onDone?.();
    }

    const form = new ActionFormData()
        .title("bd.action:Select Online Player")
        .body("§7Pick an online player or add by username (offline OK).");

    form.button("§bAdd by Username");
    for (const p of candidates) {
        form.button(`§a${p.name}`);
    }
    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then((res) => {
            if (res.canceled || res.selection === candidates.length + 1) {
                return onDone?.();
            }

            player.playSound("random.pop");

            if (res.selection === 0) {
                return openAddPlayerByNameModal(player, selectedPlot, context, onDone);
            }

            const target = candidates[res.selection - 1];
            openPlayerPermEditor(player, selectedPlot, context, null, onDone, target.name);
        });
    }, 2);
}

function openAddPlayerByNameModal(player, selectedPlot, contextOrPlots, onDone) {
    const context = normalizePermContext(player, selectedPlot, contextOrPlots);
    ensurePlotPermissionsDefault(selectedPlot);

    const modal = new ModalFormData()
        .title("bd.modal:Add Player By Name")
        .textField("Player Username", "Exact in-game name");

    appendPlayerPermToggles(modal, null);

    system.runTimeout(() => {
        modal.show(player).then((res) => {
            if (res.canceled) return onDone?.();

            player.playSound("random.pop");

            const playerName = String(res.formValues[0] || "").trim();
            if (!playerName) {
                sendError(player, "§cEnter a player name.");
                return openAddPlayerPermPicker(player, selectedPlot, context, onDone);
            }

            const storageKey = resolvePlayerName(playerName);
            if (!storageKey) {
                sendError(player, "§cInvalid player name.");
                return openAddPlayerPermPicker(player, selectedPlot, context, onDone);
            }

            const permObject = buildPlayerPermObject(res.formValues, 1);
            if (!saveClaimPlayerPermission(selectedPlot, storageKey, permObject, null, context.persist)) {
                sendError(player, "§cCould not save player permissions.");
                return onDone?.();
            }

            sendSuccess(player, `§aPermissions saved for ${storageKey}.`);
            onDone?.();
        });
    }, 2);
}

function openPlayerPermEditor(player, selectedPlot, contextOrPlots, editKey, onDone, targetName = null) {
    const context = normalizePermContext(player, selectedPlot, contextOrPlots);
    ensurePlotPermissionsDefault(selectedPlot);

    const playerName = editKey || targetName;
    if (!playerName) {
        return openAddPlayerPermPicker(player, selectedPlot, context, onDone);
    }

    const existing = editKey ? selectedPlot.permissions.players[editKey] : null;
    const titleName = editKey ? getPermPlayerLabel(selectedPlot, editKey) : playerName;

    const modal = new ModalFormData().title(
        editKey ? `bd.modal:Edit Permissions — ${titleName}` : `bd.modal:Add Permissions — ${playerName}`
    );

    appendPlayerPermToggles(modal, existing);

    system.runTimeout(() => {
        modal.show(player).then((res) => {
            if (res.canceled) return onDone?.();

            player.playSound("random.pop");

            const storageKey = resolvePlayerName(playerName);
            const permObject = buildPlayerPermObject(res.formValues, 0);

            saveClaimPlayerPermission(selectedPlot, storageKey, permObject, editKey, context.persist);
            sendSuccess(player, `§aPermissions saved for ${storageKey}.`);
            onDone?.();
        });
    }, 2);
}

function openPlayerPermActions(player, selectedPlot, contextOrPlots, playerKey) {
    const context = normalizePermContext(player, selectedPlot, contextOrPlots);
    const entry = selectedPlot.permissions.players[playerKey];
    const summary = summarizePlayerPermissions(entry);

    const label = getPermPlayerLabel(selectedPlot, playerKey);

    const form = new ActionFormData()
        .title(`bd.action:${label}`)
        .body(`§7Current access:\n§f${summary}`)
        .button("§aEdit Permissions")
        .button("§cRemove Player")
        .button("§7Back");

    system.runTimeout(() => {
        form.show(player).then((res) => {
            if (res.canceled || res.selection === 2) {
                return openPlayerPermissionsMenu(player, selectedPlot, context);
            }

            player.playSound("random.pop");

            if (res.selection === 0) {
                return openPlayerPermEditor(player, selectedPlot, context, playerKey, () => {
                    openPlayerPermissionsMenu(player, selectedPlot, context);
                });
            }

            delete selectedPlot.permissions.players[playerKey];
            context.persist(selectedPlot);
            sendSuccess(player, `§eRemoved permissions for ${playerKey}.`);
            openPlayerPermissionsMenu(player, selectedPlot, context);
        });
    }, 2);
}

function openPlayerPermissionsMenu(player, selectedPlot, contextOrPlots) {
    const context = normalizePermContext(player, selectedPlot, contextOrPlots);
    ensurePlotPermissionsDefault(selectedPlot);

    const playerKeys = Object.keys(selectedPlot.permissions.players);
    const form = new ActionFormData()
        .title("bd.action:Player Permissions")
        .body(
            playerKeys.length > 0
                ? "§7Select a player to view or edit their access."
                : "§7No player overrides yet.\n§7Add a player to grant specific permissions."
        )
        .button("§aAdd Player");

    for (const key of playerKeys) {
        const summary = summarizePlayerPermissions(selectedPlot.permissions.players[key]);
        const label = getPermPlayerLabel(selectedPlot, key);
        form.button(`§e${label}\n§7${summary}`);
    }

    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then((res) => {
            if (res.canceled || res.selection === playerKeys.length + 1) {
                return context.onBack();
            }

            player.playSound("random.pop");

            if (res.selection === 0) {
                return openAddPlayerPermPicker(player, selectedPlot, context, () => {
                    openPlayerPermissionsMenu(player, selectedPlot, context);
                });
            }

            const playerKey = playerKeys[res.selection - 1];
            openPlayerPermActions(player, selectedPlot, context, playerKey);
        });
    }, 2);
}

function openRecoverPlotsMenu(player) {
    const form = new ActionFormData()
        .title("bd.action:Recover Claims")
        .body(
            "§cYour saved claim list could not be read (corrupted data).\n\n§7Your claims may still exist on the server. Tap recover to reload them from world data."
        )
        .button("§aRecover My Claims")
        .button("§7Back");

    system.runTimeout(() => {
        form.show(player).then((res) => {
            if (res.canceled || res.selection === 1) {
                return openMainMenu(player);
            }

            player.playSound("random.pop");
            const recovered = syncOwnedPlotsFromGlobal(player);
            if (recovered.length > 0) {
                sendSuccess(player, `§aRecovered ${recovered.length} claim(s) from world data.`);
                openLandClaimMenu(player);
            } else {
                sendError(player, "§cNo personal claims found in world data to recover.");
                player.setDynamicProperty("owned_plots", "[]");
                openLandClaimMenu(player);
            }
        });
    }, 2);
}

function openLandClaimMenu(player) {
    const cached = parseOwnedPlots(player);
    if (cached === null) {
        return openRecoverPlotsMenu(player);
    }

    const plots = syncOwnedPlotsFromGlobal(player);

    const isStaff = isStaffPlayer(player);
    const plotForm = new ActionFormData().title("bd.action:Land Claim");

    plotForm.button("§aCreate New Plot");

    if (isStaff) {
        plotForm.button("§d[Admin] All Subclaims");
    }

    plots.forEach(p => plotForm.button("§e" + p.name));

    if (isStaff) {
        plotForm.button("§c[Admin] Manage All Claims");
        plotForm.button("§6[Admin] Repair Claim Storage");
    }

    plotForm.button("§7Back");

    system.runTimeout(() => {
        plotForm.show(player).then(res => {
            if (res.canceled) return openMainMenu(player);

            player.playSound("random.pop");

            let idx = 0;
            const createIdx = idx++;
            const subclaimsIdx = isStaff ? idx++ : -1;
            const plotStartIdx = idx;
            const adminIdx = isStaff ? plotStartIdx + plots.length : -1;
            const repairIdx = isStaff ? adminIdx + 1 : -1;
            const backIdx = plotStartIdx + plots.length + (isStaff ? 2 : 0);

            if (res.selection === backIdx) return openMainMenu(player);
            if (res.selection === createIdx) {
                const inventory = player.getComponent("minecraft:inventory");

                if (!inventory || !inventory.container) {
                    sendError(player, "§cUnable to access inventory.");
                    return openLandClaimMenu(player);
                }

                const selectedSlot = player.selectedSlotIndex;

                player.addTag("plot_making");
                player.removeTag("plot_subclaim_making");

                player.setDynamicProperty("subclaim_parent_id", undefined);
                player.setDynamicProperty("plot_pos1", undefined);
                player.setDynamicProperty("plot_pos2", undefined);

                if (!equipPlotClaimWand(player, selectedSlot)) {
                    sendError(player, "§cUnable to equip claim wand.");
                    player.removeTag("plot_making");
                    return openLandClaimMenu(player);
                }

                toastInfo(
                    player,
                    "§eUse the wooden axe to set plot positions. Right-click for Pos1, then right-click another block for Pos2.",
                    "plot_axe_hint"
                );

                player.playSound("random.pop");
                return;
            }

            if (res.selection === subclaimsIdx) return openAllSubclaimsMenu(player);
            if (res.selection === adminIdx) return openAdminClaimsFilterMenu(player);
            if (res.selection === repairIdx) {
                const healed = healCorruptClaimBuckets();
                const result = rebalanceAllClaimBuckets();
                if (result.ok) {
                    syncOwnedPlotsFromGlobal(player);
                    const soloNote = result.singles ? ` §8(+§f${result.singles}§8 solo)` : "";
                    sendSuccess(
                        player,
                        `§aRealm claim storage repaired: §f${result.claims}§a claims → §f${result.buckets}§a buckets${soloNote}${healed ? ` §8(${healed} corrupt healed)` : ""}.`
                    );
                } else {
                    sendError(
                        player,
                        `§cClaim repair failed: §f${result.error || "unknown"}§c. Healed §f${healed}§c corrupt buckets. Try again or contact staff.`
                    );
                }
                return openLandClaimMenu(player);
            }

            const selectedPlot = plots[res.selection - plotStartIdx];
            if (!selectedPlot) return openLandClaimMenu(player);

            syncProtectedRoleTags(player);
            const isAdmin = isStaffPlayer(player);
            const canUseClaimEditor = isOperatorPlayer(player);

            const manageForm = new ActionFormData()
                .title(`bd.action:Plot: ${selectedPlot.name}`)
                .button("§aRename Plot")
                .button("§bManage Permissions")
                .button("§cDelete Plot");

            if (isAdmin) {
                manageForm.button("§dAdmin: Subclaims");
            }
            if (canUseClaimEditor) {
                manageForm.button("§4Admin: Claim Editor");
            }

            manageForm.button("§7Back");

            system.runTimeout(() => {
                manageForm.show(player).then(mres => {
                    if (mres.canceled) return openLandClaimMenu(player);

                    player.playSound("random.pop");
                    const subclaimsIdx = isAdmin ? 3 : -1;
                    const editorIdx = canUseClaimEditor ? (isAdmin ? 4 : 3) : -1;

                    if (mres.selection === 0) {
                        const renameForm = new ModalFormData()
                            .title("bd.modal:Rename Plot")
                            .textField("New Name", "Enter new name", {
                                defaultValue: selectedPlot.name
                            });

                        system.runTimeout(() => {
                            renameForm.show(player).then(rres => {
                                if (rres.canceled) return openLandClaimMenu(player);

                                player.playSound("random.pop");

                                selectedPlot.name = rres.formValues[0] || selectedPlot.name;

                                if (!persistClaim(selectedPlot, player, plots)) {
                                    sendError(player, "§cCould not save plot rename.");
                                } else {
                                    sendSuccess(player, "§ePlot renamed.");
                                }
                                openLandClaimMenu(player);
                            });
                        }, 2);
                    } else if (mres.selection === 1) {
                        const permMenu = new ActionFormData()
                            .title("bd.action:Manage Permissions")
                            .button("§dPublic Permissions")
                            .button("§ePlayer Permissions")
                            .button("§7Back");

                        system.runTimeout(() => {
                            permMenu.show(player).then(pres => {
                                if (pres.canceled || pres.selection === 2) {
                                    return openLandClaimMenu(player);
                                }

                                player.playSound("random.pop");

                                if (!selectedPlot.permissions) {
                                    ensurePlotPermissionsDefault(selectedPlot);
                                }

                                if (!selectedPlot.permissions.default) {
                                    selectedPlot.permissions.default = {
                                        protectBreak: true,
                                        protectPlace: true,
                                        protectLiquid: true,
                                        protectContainer: true,
                                        protectDoors: true,
                                        protectEnter: false,
                                        protectEnderPearls: true,
                                        protectExplosion: true,
                                        protectFireSpread: true,
                                        protectPvp: true,
                                        protectInteract: true,
                                        protectEntityKill: true
                                    };
                                }

                                if (!selectedPlot.permissions.players) {
                                    selectedPlot.permissions.players = {};
                                }

                                if (pres.selection === 0) {
                                    const defPerms = selectedPlot.permissions.default;

                                    const modal = new ModalFormData()
                                        .title("bd.modal:Public Permissions")
                                        .toggle("Allow Break Blocks", {
                                            defaultValue: !defPerms.protectBreak
                                        })
                                        .toggle("Allow Place Blocks", {
                                            defaultValue: !defPerms.protectPlace
                                        })
                                        .toggle("Allow Liquids (Water/Lava)", {
                                            defaultValue: !defPerms.protectLiquid
                                        })
                                        .toggle("Allow Open Containers", {
                                            defaultValue: !defPerms.protectContainer
                                        })
                                        .toggle("Allow Open Doors", {
                                            defaultValue: !defPerms.protectDoors
                                        })
                                        .toggle("Allow Players To Enter Claim", {
                                            defaultValue: !defPerms.protectEnter
                                        })
                                        .toggle("Allow Ender Pearls", {
                                            defaultValue: !defPerms.protectEnderPearls
                                        })
                                        .toggle("Allow Item Frames, Armor Stands & Signs Usage", {
                                            defaultValue: !defPerms.protectInteract
                                        })
                                        .toggle("Allow Entity Killing", {
                                            defaultValue: !defPerms.protectEntityKill
                                        })
                                        .toggle("Allow Explosions", {
                                            defaultValue: !defPerms.protectExplosion
                                        })
                                        .toggle("Allow Fire Spread", {
                                            defaultValue: !defPerms.protectFireSpread
                                        })
                                        .toggle("Disable PVP", {
                                            defaultValue: defPerms.protectPvp ?? true
                                        })
                                        .toggle("Allow Public Set Home", {
                                            defaultValue: defPerms.allowHomes === true
                                        });

                                    system.runTimeout(() => {
                                        modal.show(player).then(mres2 => {
                                            if (mres2.canceled) return openLandClaimMenu(player);

                                            player.playSound("random.pop");

                                            selectedPlot.permissions.default.protectBreak = !mres2.formValues[0];
                                            selectedPlot.permissions.default.protectPlace = !mres2.formValues[1];
                                            selectedPlot.permissions.default.protectLiquid = !mres2.formValues[2];
                                            selectedPlot.permissions.default.protectContainer = !mres2.formValues[3];
                                            selectedPlot.permissions.default.protectDoors = !mres2.formValues[4];
                                            selectedPlot.permissions.default.protectEnter = !mres2.formValues[5];
                                            selectedPlot.permissions.default.protectEnderPearls = !mres2.formValues[6];
                                            selectedPlot.permissions.default.protectInteract = !mres2.formValues[7];
                                            selectedPlot.permissions.default.protectEntityKill = !mres2.formValues[8];
                                            selectedPlot.permissions.default.protectExplosion = !mres2.formValues[9];
                                            selectedPlot.permissions.default.protectFireSpread = !mres2.formValues[10];
                                            selectedPlot.permissions.default.protectPvp = mres2.formValues[11];
                                            selectedPlot.permissions.default.allowHomes = !!mres2.formValues[12];

                                            if (!persistClaim(selectedPlot, player, plots)) {
                                                sendError(player, "§cFailed to save permissions.");
                                                return openLandClaimMenu(player);
                                            }

                                            sendSuccess(player, "§aPublic permissions updated.");
                                            openLandClaimMenu(player);
                                        });
                                    }, 2);
                                } else if (pres.selection === 1) {
                                    openPlayerPermissionsMenu(player, selectedPlot, plots);
                                }
                            });
                        }, 2);
                    } else if (mres.selection === 2) {
                        const confirm = new ActionFormData()
                            .title("bd.action:Delete Plot")
                            .body(`§cDelete "${selectedPlot.name}"?\n§7This cannot be undone.`)
                            .button("§cYes, Delete")
                            .button("§7Cancel");

                        system.runTimeout(() => {
                            confirm.show(player).then((confirmRes) => {
                                if (confirmRes.canceled || confirmRes.selection === 1) {
                                    return openLandClaimMenu(player);
                                }

                                player.playSound("random.pop");

                                const plotIdx = plots.findIndex((p) => p.id === selectedPlot.id);
                                if (plotIdx >= 0) {
                                    plots.splice(plotIdx, 1);
                                }

                                player.setDynamicProperty("owned_plots", JSON.stringify(plots));
                                removeFromGlobalClaims(selectedPlot);
                                rebuildGlobalClaimChunkCache(true);

                                sendSuccess(player, "§ePlot deleted.");
                                openLandClaimMenu(player);
                            });
                        }, 2);
                    } else if (subclaimsIdx >= 0 && mres.selection === subclaimsIdx) {
                        return openSubclaimsMenu(player, selectedPlot);
                    } else if (editorIdx >= 0 && mres.selection === editorIdx) {
                        return openAdminClaimEditor(player, selectedPlot, () => openLandClaimMenu(player));
                    } else {
                        openLandClaimMenu(player);
                    }
                });
            }, 2);
        });
    }, 2);
}

const DAILY_REWARD_LAST_CLAIM_KEY = "daily_reward_last_claim_ms";
const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function openDailyRewardsMenu(player) {
    const lastClaim = Number(player.getDynamicProperty(DAILY_REWARD_LAST_CLAIM_KEY) || 0);
    const now = Date.now();
    const remaining = Math.max(0, DAILY_REWARD_COOLDOWN_MS - (now - lastClaim));

    const canClaim = remaining <= 0;

    const form = new ActionFormData()
        .title("bd.action:Daily Rewards")
        .body(
            canClaim
                ? "§aYour daily reward is ready!"
                : `§eNext daily reward in: §f${formatDailyTime(remaining)}`
        )
        .button("§aClaim Daily Reward");

    const isStaff = isStaffPlayer(player);

    if (isStaff) {
        form.button("§dEdit Daily Claim");
    }

    form.button("§7Back");

    system.runTimeout(() => {
        form.show(player).then(res => {
            if (res.canceled) return;

            player.playSound("random.pop");

            const backIndex = isStaff ? 2 : 1;

            if (res.selection === backIndex) return;

            // Claim Daily Reward
            if (res.selection === 0) {
                return claimDailyReward(player);
            }

            // Staff editor
            if (isStaff && res.selection === 1) {
                return showDailyRewardsEditor(player);
            }
        });
    }, 2);
}

function claimDailyReward(player) {
    const lastClaim = Number(player.getDynamicProperty(DAILY_REWARD_LAST_CLAIM_KEY) || 0);
    const now = Date.now();
    const remaining = Math.max(0, DAILY_REWARD_COOLDOWN_MS - (now - lastClaim));

    if (remaining > 0) {
        toastError(player, `§cYou already claimed your daily reward. Try again in §f${formatDailyTime(remaining)}§c.`, "daily_claimed");
        return openDailyRewardsMenu(player);
    }

    const items = getDailyRewardItems();
    const amount = getDailyRewardAmount();

    if (!items || items.length === 0) {
        toastError(player, "§cDaily rewards are not set up yet.", "daily_not_setup");
        player.playSound("note.bass");
        return openDailyRewardsMenu(player);
    }

    const rewardId = items[Math.floor(Math.random() * items.length)];

    try {
        const stack = new ItemStack(rewardId, amount);
        const inv = player.getComponent("minecraft:inventory")?.container;

        if (!inv) {
            toastError(player, "§cCould not access your inventory.", "daily_inv_err");
            player.playSound("note.bass");
            return openDailyRewardsMenu(player);
        }

        const leftover = inv.addItem(stack);

        if (leftover) {
            player.dimension.spawnItem(leftover, player.location);
            toastInfo(player, "§eYour inventory was full, so part of your reward dropped on the ground.", "daily_inv_full");
        }

        player.setDynamicProperty(DAILY_REWARD_LAST_CLAIM_KEY, now);

        toastSuccess(player, `§aDaily reward claimed: §f${amount}x ${rewardId}`, "daily_claim_ok");
        player.playSound("random.levelup");
    } catch (e) {
        toastError(player, `§cInvalid daily reward item: §f${rewardId}`, "daily_invalid_item");
        player.playSound("note.bass");
        console.warn(`[DailyRewards] Invalid reward item ${rewardId}: ${e}`);
    }

    return openDailyRewardsMenu(player);
}

function formatDailyTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function showDailyRewardsEditor(player) {
    if (!isStaffPlayer(player)) return sendError(player, "§cStaff only.");

    const items = getDailyRewardItems();
    const amount = getDailyRewardAmount();

    const editor = new ActionFormData()
        .title("bd.action:Daily Rewards Editor")
        .body(`§7Amount: §f${amount}\n§7Items (${items.length}):\n§f${items.join("\n") || "None"}`)
        .button("§aAdd Item")
        .button("§eRemove Item")
        .button("§bSet Amount")
        .button("§cReset Defaults")
        .button("§7Back");

    system.runTimeout(() => {
        editor.show(player).then(res => {
            if (res.canceled) return openDailyRewardsMenu(player);

            player.playSound("random.pop");

            if (res.selection === 4) return openDailyRewardsMenu(player);

            // Add Item
            if (res.selection === 0) {
                const addForm = new ModalFormData()
                    .title("bd.modal:Add Reward")
                    .textField("Item ID", "minecraft:diamond");

                system.runTimeout(() => {
                    addForm.show(player).then(r => {
                        if (r.canceled) return showDailyRewardsEditor(player);

                        player.playSound("random.pop");

                        const id = String(r.formValues[0] || "").trim();

                        if (!id) {
                            sendError(player, "§cEnter a valid item ID.");
                            return showDailyRewardsEditor(player);
                        }

                        const next = getDailyRewardItems();

                        if (!next.includes(id)) {
                            next.push(id);
                            setDailyRewardItems(next);
                            sendSuccess(player, `§aAdded reward item: §f${id}`);
                        } else {
                            sendError(player, "§cThat item is already in the rewards list.");
                        }

                        return showDailyRewardsEditor(player);
                    });
                }, 2);

                return;
            }

            // Remove Item
            if (res.selection === 1) {
                const currentItems = getDailyRewardItems();

                if (currentItems.length === 0) {
                    sendError(player, "§cThere are no reward items to remove.");
                    return showDailyRewardsEditor(player);
                }

                const removeForm = new ActionFormData()
                    .title("bd.action:Remove Reward Item")
                    .body("§7Select an item to remove:");

                for (const itemId of currentItems) {
                    removeForm.button(`§c${itemId}`);
                }

                removeForm.button("§7Back");

                system.runTimeout(() => {
                    removeForm.show(player).then(r => {
                        if (r.canceled || r.selection === currentItems.length) {
                            return showDailyRewardsEditor(player);
                        }

                        player.playSound("random.pop");

                        const removed = currentItems[r.selection];
                        const next = currentItems.filter((_, index) => index !== r.selection);

                        setDailyRewardItems(next);
                        sendSuccess(player, `§eRemoved reward item: §f${removed}`);

                        return showDailyRewardsEditor(player);
                    });
                }, 2);

                return;
            }

            // Set Amount
            if (res.selection === 2) {
                const amountForm = new ModalFormData()
                    .title("bd.modal:Set Reward Amount")
                    .slider("Amount per daily reward", 1, 64, {
                        valueStep: 1,
                        defaultValue: getDailyRewardAmount()
                    });

                system.runTimeout(() => {
                    amountForm.show(player).then(r => {
                        if (r.canceled) return showDailyRewardsEditor(player);

                        player.playSound("random.pop");

                        const newAmount = Math.floor(Number(r.formValues[0]) || 1);
                        setDailyRewardAmount(newAmount);

                        sendSuccess(player, `§aDaily reward amount set to §f${newAmount}`);
                        return showDailyRewardsEditor(player);
                    });
                }, 2);

                return;
            }

            // Reset Defaults
            if (res.selection === 3) {
                setDailyRewardItems(DEFAULT_DAILY_REWARD_ITEMS);
                setDailyRewardAmount(1);

                sendSuccess(player, "§aReset daily rewards to defaults.");
                return showDailyRewardsEditor(player);
            }

            return showDailyRewardsEditor(player);
        });
    }, 2);
}
function openFactionsMenu(player) {
    const factions = loadFactionsData();
    const playerFactionId = player.getDynamicProperty('faction');
    const invites = parseJsonArray(player.getDynamicProperty('faction_invites'));

    if (playerFactionId) {
        const faction = factions.find(f => f.id === playerFactionId);
        if (!faction) {
            player.setDynamicProperty('faction', undefined);
            sendError(player, '§cYour faction no longer exists.');
            return openFactionsMenu(player);
        }

        const myRoleId = faction.memberRoles?.[player.id] || 'member';
        const myRole = (faction.roles || []).find(r => r.id === myRoleId);
        const canManageRoles = faction.ownerId === player.id || (myRole && myRole.permissions && myRole.permissions.manageRoles);
        const canManageClaims = faction.ownerId === player.id || (myRole && myRole.permissions && myRole.permissions.claim);
        const canInvite = faction.ownerId === player.id || (myRole && myRole.permissions && myRole.permissions.invite);
        const requests = parseJsonArray(player.getDynamicProperty('faction_requests'));
        const canViewRequests = faction.ownerId === player.id;

        const fForm = new ActionFormData()
            .title('bd.action:' + faction.name)
            .body(`Owner: ${faction.ownerName}\nMembers: ${(faction.members || []).length}\n${faction.description || ''}`);

        const actions = [];
        const addAction = (label, fn) => { fForm.button(label); actions.push(fn); };

        addAction('§eMembers', () => {
            const membersForm = new ActionFormData().title('bd.action:Members');
            for (const id of faction.members || []) {
                const online = world.getAllPlayers().find(p => p.id === id);
                const name = (online && online.name) || faction.memberNames?.[id] || id;
                const roleId = faction.memberRoles?.[id] || 'member';
                const roleName = ((faction.roles || []).find(r => r.id === roleId)?.name) || roleId;
                membersForm.button('§a' + `${name} §7(${roleName})`);
            }
            membersForm.button('§7Back');
            system.runTimeout(() => {
                membersForm.show(player).then(mr => {
                    if (mr.canceled || mr.selection === (faction.members || []).length) return openFactionsMenu(player);
                    player.playSound('random.pop');
                    openFactionsMenu(player); 
                });
            }, 3);
        });

        if (canManageClaims) {
            addAction('§6Faction Claims', () => openFactionClaimsListMenu(player, faction));
        }

        if (canInvite) {
            addAction('§aInvite Player', () => {
                const players = world.getAllPlayers().filter(p => p.id !== player.id && !(faction.members || []).includes(p.id));
                if (players.length === 0) { sendError(player, '§cNo players to invite.'); return openFactionsMenu(player); }
                const inviteForm = new ActionFormData().title('bd.action:Invite Player');
                players.forEach(p => inviteForm.button('§a' + p.name));
                inviteForm.button('§7Back');
                system.runTimeout(() => {
                    inviteForm.show(player).then(ir => {
                        if (ir.canceled || ir.selection === players.length) return openFactionsMenu(player);
                        player.playSound('random.pop');
                        const target = players[ir.selection];
                        const targetInvites = JSON.parse(target.getDynamicProperty('faction_invites') || '[]');
                        targetInvites.push({ factionId: faction.id, factionName: faction.name, factionTag: faction.tag || '', fromId: player.id, fromName: player.name });
                        target.setDynamicProperty('faction_invites', JSON.stringify(targetInvites));
                        toastInfo(target, `§eYou have been invited to join ${faction.name}!`, "fac_invite");
                        sendSuccess(player, '§aInvite sent.');
                        openFactionsMenu(player);
                    });
                }, 3);
            });
        }

        if (faction.ownerId === player.id) {
            addAction('§eCustomize', () => {
                const customForm = new ActionFormData().title('bd.action:Customize Faction')
                    .button('§eRename / Change Tag')
                    .button('§eSet Description')
                    .button('§bSet Faction Banner') // NEW BANNER BUTTON
                    .button('§7Back');
                    
                system.runTimeout(() => {
                    customForm.show(player).then(cr => {
                        if (cr.canceled || cr.selection === 3) return openFactionsMenu(player);
                        player.playSound('random.pop');
                        
                        if (cr.selection === 0) {
                            const rename = new ModalFormData().title('bd.modal:Rename Faction')
                                .textField('New name', 'Enter name', { defaultValue: faction.name })
                                .textField('Faction Tag', 'Any length allowed', { defaultValue: faction.tag || '' });

                            system.runTimeout(() => {
                                rename.show(player).then(rn => {
                                    if (rn.canceled) return openFactionsMenu(player);
                                    player.playSound('random.pop');
                                    
                                    const newName = rn.formValues[0] || faction.name;
                                    const rawTag = (rn.formValues[1] || '').trim().toUpperCase();
                                    
                                    faction.name = newName;
                                    if (rawTag) faction.tag = rawTag;
                                    
                                    world.setDynamicProperty('factions', JSON.stringify(factions));
                                    sendSuccess(player, '§eFaction renamed.');
                                    openFactionsMenu(player);
                                });
                            }, 3);
                        } else if (cr.selection === 1) {
                            const desc = new ModalFormData().title('bd.modal:Set Description')
                                .textField('Description', 'Enter description', { defaultValue: faction.description || '' });
                            system.runTimeout(() => {
                                desc.show(player).then(dr => {
                                    if (dr.canceled) return openFactionsMenu(player);
                                    player.playSound('random.pop');
                                    
                                    faction.description = dr.formValues[0] || '';
                                    world.setDynamicProperty('factions', JSON.stringify(factions));
                                    sendSuccess(player, '§eFaction description updated.');
                                    openFactionsMenu(player);
                                });
                            }, 3);
                        } else if (cr.selection === 2) {
                            // NEW BANNER LOGIC
                            const bannerModal = new ModalFormData().title('bd.modal:Set Faction Banner')
                                .textField('Icon Filepath (e.g. textures/items/banner_pattern)', 'Leave blank to remove', { defaultValue: faction.banner || '' });
                            system.runTimeout(() => {
                                bannerModal.show(player).then(br => {
                                    if (br.canceled) return openFactionsMenu(player);
                                    player.playSound('random.pop');
                                    
                                    faction.banner = br.formValues[0].trim();
                                    world.setDynamicProperty('factions', JSON.stringify(factions));
                                    sendSuccess(player, '§eFaction banner updated.');
                                    openFactionsMenu(player);
                                });
                            }, 3);
                        }
                    });
                }, 3);
            });

            addAction('§cDisband', () => {
                const conf = new ActionFormData().title('bd.action:Disband Faction').body('Are you sure?').button('§cYes').button('§7No');
                system.runTimeout(() => {
                    conf.show(player).then(c => {
                        if (c.canceled || c.selection === 1) return openFactionsMenu(player);
                        player.playSound('random.pop');

                        for (const claim of faction.claims || []) {
                            if (claim?.id) removeClaimFully(claim, false);
                        }

                        factions.splice(factions.findIndex(f => f.id === faction.id), 1);
                        world.setDynamicProperty('factions', JSON.stringify(factions));
                        (faction.members || []).forEach(id => {
                            const p = world.getAllPlayers().find(pp => pp.id === id);
                            if (p) p.setDynamicProperty('faction', undefined);
                        });
                        sendSuccess(player, '§eFaction disbanded.');
                        openMainMenu(player);
                    });
                }, 3);
            });
        } else {
            addAction('§cLeave Faction', () => {
                const idx = (faction.members || []).indexOf(player.id);
                if (idx > -1) {
                    faction.members.splice(idx, 1);
                    player.setDynamicProperty('faction', undefined);
                    world.setDynamicProperty('factions', JSON.stringify(factions));
                    sendSuccess(player, '§eYou left the faction.');
                    openMainMenu(player);
                }
            });
        }

        // NEW: Browse Factions correctly placed inside the faction member menu!
        addAction('§6Browse Factions', () => {
            if (factions.length === 0) { sendError(player, '§cNo factions found.'); return openFactionsMenu(player); }
            const list = new ActionFormData().title('bd.action:Factions List');
            
            // Includes the custom banner icon if the faction set one!
            factions.forEach(f => list.button('§6' + f.name, f.banner || undefined));
            list.button('§7Back');
            
            system.runTimeout(() => {
                list.show(player).then(lr => {
                    if (lr.canceled || lr.selection === factions.length) return openFactionsMenu(player);
                    player.playSound('random.pop');
                    const fac = factions[lr.selection];
                    
                    const detail = new ActionFormData()
                        .title('bd.action:' + fac.name)
                        .body(`Owner: ${fac.ownerName}\nMembers: ${(fac.members || []).length}\n${fac.description || 'No description provided.'}`)
                        .button('§7Back');
                        
                    system.runTimeout(() => {
                        detail.show(player).then(() => {
                            return openFactionsMenu(player);
                        });
                    }, 3);
                });
            }, 3);
        });

        addAction('§7Back', () => openMainMenu(player));

        system.runTimeout(() => {
            fForm.show(player).then(fr => {
                if (fr.canceled) return openMainMenu(player);
                player.playSound('random.pop');
                const fn = actions[fr.selection];
                if (fn) fn();
            });
        }, 3);
        
    } else {
        // --- PLAYER IS NOT IN A FACTION ---
        const fForm = new ActionFormData().title('bd.action:Factions');
        fForm.button('§aCreate Faction');
        fForm.button('§b' + ('Invites (' + invites.length + ')'));
        fForm.button('§6Browse Factions');
        fForm.button('§7Back');
        
        system.runTimeout(() => {
            fForm.show(player).then(fr => {
                if (fr.canceled || fr.selection === 3) return openMainMenu(player);
                player.playSound('random.pop');
                
                if (fr.selection === 0) {
                    const defaultName = `${player.name}'s Faction`;
                    const createForm = new ModalFormData()
                        .title('bd.modal:Create Faction')
                        .textField('Faction Name', 'Enter a name', { defaultValue: defaultName })
                        .textField('Faction Tag', 'Any length allowed');
                    system.runTimeout(() => {
                        createForm.show(player).then(nr => {
                            if (nr.canceled) return openFactionsMenu(player);
                            player.playSound('random.pop');
                            const name = nr.formValues[0] || defaultName;
                            const rawTag = (nr.formValues[1] || '').trim().toUpperCase();
                            const id = Date.now().toString();
                            const newF = { id, name, tag: rawTag, ownerId: player.id, ownerName: player.name, members: [player.id] };
                            factions.push(newF);
                            world.setDynamicProperty('factions', JSON.stringify(factions));
                            player.setDynamicProperty('faction', id);
                            sendSuccess(player, '§aFaction created: ' + name);
                            openFactionsMenu(player);
                        });
                    }, 3);
                } else if (fr.selection === 1) {
                    if (invites.length === 0) { sendError(player, '§cNo invites.'); return openFactionsMenu(player); }
                    const invForm = new ActionFormData().title('bd.action:Invites');
                    invites.forEach(inv => invForm.button(inv.factionTag ? ('§e[' + inv.factionTag + ']') : ('§b' + inv.factionName)));
                    invForm.button('§7Back');
                    system.runTimeout(() => {
                        invForm.show(player).then(ir => {
                            if (ir.canceled || ir.selection === invites.length) return openFactionsMenu(player);
                            player.playSound('random.pop');
                            const chosen = invites[ir.selection];
                            const fac = factions.find(f => f.id === chosen.factionId);
                            if (fac) {
                                fac.members = fac.members || [];
                                if (!fac.members.includes(player.id)) fac.members.push(player.id);
                                player.setDynamicProperty('faction', fac.id);
                                world.setDynamicProperty('factions', JSON.stringify(factions));
                                sendSuccess(player, '§aJoined faction ' + fac.name);
                            }
                            invites.splice(ir.selection, 1);
                            player.setDynamicProperty('faction_invites', JSON.stringify(invites));
                            openFactionsMenu(player);
                        });
                    }, 3);
                } else if (fr.selection === 2) {
                    if (factions.length === 0) { sendError(player, '§cNo factions found.'); return openFactionsMenu(player); }
                    const list = new ActionFormData().title('bd.action:Factions List');
                    
                    // Includes the custom banner icon if the faction set one!
                    factions.forEach(f => list.button('§6' + f.name, f.banner || undefined));
                    list.button('§7Back');
                    
                    system.runTimeout(() => {
                        list.show(player).then(lr => {
                            if (lr.canceled || lr.selection === factions.length) return openFactionsMenu(player);
                            player.playSound('random.pop');
                            const fac = factions[lr.selection];
                            const detail = new ActionFormData().title('bd.action:' + fac.name).body(`Owner: ${fac.ownerName}\nMembers: ${fac.members.length}`).button('§aRequest Join').button('§7Back');
                            system.runTimeout(() => {
                                detail.show(player).then(dr => {
                                    if (dr.canceled || dr.selection === 1) return openFactionsMenu(player);
                                    player.playSound('random.pop');
                                    sendSuccess(player, '§aJoin request sent.');
                                });
                            }, 3);
                        });
                    }, 3);
                }
            });
        }, 3);
    }
}

// ==========================================
// EXPORT TRIGGER
// ==========================================

// Debounce map: prevents the GUI item use from firing twice when the player
// right-clicks a button inside an open form (that click also re-fires itemUse).
const guiOpenCooldowns = new Map();
const GUI_OPEN_COOLDOWN_MS = 600;

export default {
    name: 'itemUse',
    type: 1,
    run: async(data) => {
        if(data.itemStack.typeId !== 'bd:gui') return;

        // Debounce: ignore rapid re-fires from form button right-clicks
        const playerId = data.source?.id;
        if (!playerId) return;
        const now = Date.now();
        if (now - (guiOpenCooldowns.get(playerId) ?? 0) < GUI_OPEN_COOLDOWN_MS) return;
        guiOpenCooldowns.set(playerId, now);

        if (isRainGuiMinigamePlayer(data.source)) return;

        if (isInCombat(data.source)) {
            const secs = getCombatRemainingSeconds(data.source);
            notify(
                data.source,
                "gui_combat_block",
                "§c§l[COMBAT]§r",
                `§cYou cannot open the menu while in combat.\n§7${secs}s remaining`,
                "note.bass"
            );
            return;
        }

        if (isPrisonGuiBlocked(data.source)) {
            denyPrisonGuiUse(data.source);
            return;
        }

        if (isRainGuiBlocked(data.source)) {
            notify(data.source, "rain_gui_blocked", "§c§l[BLOCKED]§r", "§cYour role cannot use the Rain GUI.", "note.bass");
            return;
        }

        system.runTimeout(() => {
            if (!data.source?.isValid) return;
            syncPlayerRainGuiGlint(data.source);
            openMainMenu(data.source);
        }, FORM_OPEN_DELAY_TICKS);
    }
}
