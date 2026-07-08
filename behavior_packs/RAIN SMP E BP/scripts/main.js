import { world, system, EquipmentSlot, ItemStack, ItemLockMode, PlatformType, GameMode } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { eventRegistry } from "./events/index.js";
import { getPlayerCPS } from "./events/cps.js";
import { startPrisonRuntime } from "./utils/prison.js";
import { startTpaExpiryRuntime } from "./systems/tpaRequests.js";
import "./commands/registerStartup.js";
import { initFloatingTexts } from "./systems/floatingTexts.js";
import {
    initSoccerArena,
    isSoccerPlayer,
    handleSoccerPlayerRespawn,
    getSoccerHudFooter,
    SOCCER_FIXKIT_TAGS,
} from "./systems/soccerArena.js";
import { initCombatRules, getPlayerDamageSource } from "./systems/combatRules.js";
import {
    initBountyRuntime,
    allowsBountyPvp,
    blocksBountyContainerAccess,
    denyBountyContainer,
} from "./systems/bounty.js";
import {
    initClaimLockdownRuntime,
    allowsClaimLockdownPvp,
} from "./systems/claimLockdown.js";
import { startAnvilColorCodeFixRuntime, startSignColorCodeFixRuntime } from "./systems/auction/utils/itemDisplay.js";
import { startTinkersAnvilRenameRuntime } from "./utils/tinkersAnvilRename.js";
import { formatNameTag, getRankMeta, isRainGuiBlocked, isStaffPlayer, syncStaffTagsOnJoin } from "./systems/ranks.js";
import { deliverFormattedChat, startRankChatRuntime } from "./systems/rankChatRuntime.js";
import { rebuildGlobalClaimChunkCache, getGlobalPlotAtLocation, syncOwnedPlotsFromGlobal, ensurePlotClaimWand } from "./events/plot/plotHelpers.js";
import { enforcePlotEnterDenyForPlayer } from "./events/plot/plotProtection.js";
import { isClaimPermAllowed, isClaimProtectionEnabled, plotAllowsTesterBuildBypass, plotAllowsTesterShulkerBypass, hasTesterClaimBuildBypass, canTesterBypassRestrictedZone, plotHidesEnterToastForRole, isPvpAllowedInClaim, isPvpDisabledInClaim, getParentClaim } from "./utils/claimPermissions.js";
import { getCombatRemainingSeconds, isInCombat } from "./utils/teleport.js";
import { isVanished } from "./utils/vanish.js";
import {
    tickCombatSnapshots,
    tickCombatSnapshotItems,
    clearCombat as clearCombatLog,
    onPlayerDeath as clearCombatLogOnDeath,
} from "./systems/clog/runtime.js";
import {
    REALM_TICK,
    nextRealmFrame,
    onRealmFrame,
    refreshRealmPlayers,
    nextRealmPlayer,
    REALM_STAGGER,
    registerRealmHook,
    runRealmHooks,
    pruneToastCooldowns,
    notify,
    toast,
    toastError,
    toastSuccess,
    toastInfo,
    toastWarning,
    toastDeny,
    formatToast,
    setBuilderTesterGamemodeHandler,
    runBuilderTesterGamemodeChange,
    registerRealmAuxHook,
    startRealmAuxLoop,
    getRealmPlayerById,
    nextRealmPlayerBatch,
    anyCachedPlayerHasTag,
} from "./utils/realmPerf.js";
import {
    preloadChunkThen,
    findSafeSurfaceY,
    isPlayerOnline,
    isChunkColumnLoaded,
    teleportClamped,
    ensureVaultTickingArea,
} from "./utils/chunkLoad.js";
import {
    isStorageContainerBlock,
    isClaimWorkstationBlock,
    isRestrictedUsableBlock,
    isDecorPlacementBlock,
} from "./utils/blockTypes.js";
import { isTinkersConstructItem } from "./utils/tinkersClaim.js";
import {
    readPlayerGamemode,
    rememberPlayerGamemode,
    getRememberedGamemode,
    syncCreativeRoleTag,
    setCreativeRoleTag,
    isTester,
    isWorldBuilderRole,
    isCreativeBuilderTagged,
    isCreativeBuilderInCreative,
    isCreativeBuilderSessionActive,
    isPlayerInCreative,
    isRestrictedCreativeRole,
    shouldBlockCreativeRoleDrop,
    isRestrictedCreativeItem,
    isRestrictedDecorEntity,
    isRestrictedEntityContainer,
    denyRestrictedCreative,
    resolveRestrictedCreativeBreak,
    resolveRestrictedCreativePlace,
    allowsCreativeBuilderPlot,
    stripStaleCreativeRoleTag,
} from "./utils/creativeRoleGuard.js";
import {
    giveRainGuiOnFirstJoin,
    ensureRainGuiItem,
    isRainGuiItem,
    isRainGuiMinigamePlayer,
    stripRainGuiForGravestone,
} from "./utils/rainGui.js";
import { startInfestedPotionRuntime, tickInfestedPotionRealm } from "./utils/data/potions.js";
import {
    clearPlaytimeSession,
    flushPlaytimeNow,
    formatPlaytimeDHMS,
    livePlaytimeMsFor,
    seedPlaytimeSession,
    startPlaytimeRuntime,
} from "./utils/playtime.js";
import "./systems/shop/gui/index.js";
import "./items/itemUse.js";
import "./items/itemHit.js";
import "./utils/soulboundGrave.js";
import { startGraveCleanupRuntime } from "./utils/graveCleanup.js";
import "./utils/mountSuffocation.js";
import "./land_claim_cube.js";

// --- GLOBAL DEFINITIONS ---
const playerCurrentPlot = new Map();
const playerLastPlotBlock = new Map();
const cachedKills = new Map();
const cachedDeaths = new Map();
const playerCombatStates = new Map();
const borderWarningCooldown = new Map();
const actionbarStatCache = new Map();
const actionbarLastSent = new Map();
let restrictedCreativeOnline = false;
let plotEnterRot = 0;
let combatScanRot = 0;

const KILLS_KEY = 'bd_kills';
const DEATHS_KEY = 'bd_deaths';
const SIDEBAR_LOOP_TICKS = 5;
const NAMETAG_EVERY_LOOPS = 2;
const ACTIONBAR_STAT_REFRESH_LOOPS = 20;
const ACTIONBAR_BATCH = 2;
const PLOT_ENTER_BATCH = 4;
const PERSIST_INTERVAL = 200;

// --- TESTER SYSTEM DEFINITIONS ---

const RESTRICTED_RADIUS = 10000;
const BANNED_INTERACT_BLOCKS = [
    "minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel", "minecraft:furnace",
    "minecraft:blast_furnace", "minecraft:smoker", "minecraft:chiseled_bookshelf",
    "minecraft:hopper", "minecraft:dispenser", "minecraft:dropper",
    "minecraft:shulker_box", "minecraft:undyed_shulker_box",
    "minecraft:command_block", "minecraft:chain_command_block", "minecraft:repeating_command_block"
];
["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"].forEach(c => BANNED_INTERACT_BLOCKS.push(`minecraft:${c}_shulker_box`));

function isInsideRestrictedZone(location) {
    return Math.abs(location.x) <= RESTRICTED_RADIUS && Math.abs(location.z) <= RESTRICTED_RADIUS;
}

function isAdminClaim(plot) {
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

// ✨ SMART TOGGLE CHECKER — delegates to shared creative-role plot rules
function allowsCreativeBuilders(plot) {
    return allowsCreativeBuilderPlot(plot);
}

function hasRestrictedNBT(itemStack) {
    if (!itemStack) return false;

    // Tinkers items always carry lore/NBT — never treat that as a restricted shulker rename.
    if (isTinkersConstructItem(itemStack.typeId)) return false;

    return itemStack.nameTag !== undefined || itemStack.getLore().length > 0;
}

function isShulkerId(id) {
    return !!id && id.toLowerCase().includes("shulker_box");
}

function hasBoldFormatting(text) {
    return !!text && text.includes("§l");
}

function isBoldNamedShulkerItem(itemStack) {
    if (!itemStack || !isShulkerId(itemStack.typeId)) return false;
    return hasBoldFormatting(itemStack.nameTag || "");
}

function getPlacedShulkerDisplayName(block) {
    if (!block) return "";
    try {
        const stack = block.getItemStack?.(1, true) ?? block.getItemStack?.();
        if (stack?.nameTag) return stack.nameTag;
    } catch (e) { }
    try {
        const nameable = block.getComponent?.("minecraft:nameable");
        const customName = nameable?.customName;
        if (customName) return String(customName);
    } catch (e) { }
    return "";
}

function isBoldNamedPlacedShulker(block) {
    if (!block || !isShulkerId(block.typeId)) return false;
    return hasBoldFormatting(getPlacedShulkerDisplayName(block));
}

export function plotAllowsTesterBypass(plot) {
    return plotAllowsTesterBuildBypass(plot);
}

function canTesterBypassAt(player, location) {
    if (!isTester(player) || !location) return false;
    const plot = getPlotAtLocation(location, player.dimension.id);
    return canTesterBypassRestrictedZone(player, plot);
}

/** Tester 10k build/container rules — Creative only. Survival testers have no zone restrictions. */
function isTesterRestrictedAt(player, location) {
    if (!isTester(player) || !location) return false;
    if (!isPlayerInCreative(player)) return false;
    if (!isInsideRestrictedZone(location)) return false;
    if (canTesterBypassAt(player, location)) return false;
    return true;
}

/** Bold shulkers: blocked inside 10k and in admin claims past 10k unless claim shulker bypass is on. */
function isTesterBoldShulkerPlaceOrOpenBanned(player, location) {
    if (!isTester(player) || !location) return false;
    const plot = getPlotAtLocation(location, player.dimension.id);
    if (plot && plotAllowsTesterShulkerBypass(plot)) return false;
    if (isInsideRestrictedZone(location)) return true;
    return isAdminClaim(plot);
}

function denyTesterBoldShulker(player, actionKey, location) {
    const inside10k = location && isInsideRestrictedZone(location);
    testerNotify(
        player,
        `tester_shulker_${actionKey}`,
        "Bold-named shulker boxes cannot be placed or opened here.",
        inside10k
            ? "Applies in Survival and Creative · 10k radius."
            : "Admin Claims only · past the 10k radius."
    );
}

function isNamedOrNBTShulkerItem(itemStack) {
    if (!itemStack || !isShulkerId(itemStack.typeId)) return false;
    return hasRestrictedNBT(itemStack);
}

function isNamedOrNBTPlacedShulker(block) {
    if (!block || !isShulkerId(block.typeId)) return false;
    try {
        const stack = block.getItemStack?.(1, true) ?? block.getItemStack?.();
        if (stack && hasRestrictedNBT(stack)) return true;
    } catch (e) { }
    const displayName = getPlacedShulkerDisplayName(block);
    return displayName !== "" && displayName !== undefined;
}

/** Creative + inside 10k — no claim bypass. */
function isTesterCreativeInside10k(player, location) {
    return (
        isTester(player) &&
        !!location &&
        isInsideRestrictedZone(location) &&
        isPlayerInCreative(player)
    );
}

function denyTesterCreativeShulker(player, actionKey) {
    testerNotify(
        player,
        `tester_shulker_creative_${actionKey}`,
        "Named or modified shulker boxes cannot be placed or opened here.",
        "Creative mode · 10k radius · no claim bypass."
    );
}

function blockTesterCreativeShulkerPlaceOrOpen(player, itemStack, block, actionKey) {
    const loc = block?.location ?? player?.location;
    if (!isTesterCreativeInside10k(player, loc)) return false;
    const plot = getPlotAtLocation(loc, player.dimension.id);
    if (plot && plotAllowsTesterShulkerBypass(plot)) return false;
    if (isNamedOrNBTShulkerItem(itemStack) || (block && isNamedOrNBTPlacedShulker(block))) {
        system.run(() => denyTesterCreativeShulker(player, actionKey));
        return true;
    }
    return false;
}

function denyTesterCreativeOnly(player, actionKey, message, hint = "Creative mode · 10k radius") {
    testerNotify(player, actionKey, message, hint);
}

/** Tester toasts: colored title line + body (see RTP / CLAIM style). */
function testerNotify(player, key, message, hint = "", sound = "note.bass", tone = "deny") {
    const titles = {
        deny: "§4§l[TESTER]§r §8| §cRestricted Zone",
        success: "§2§l[TESTER]§r §8| §aMode Switch",
        info: "§6§l[TESTER]§r §8| §eNotice"
    };
    const colors = { deny: "§c", success: "§a", info: "§e" };
    const msgColor = colors[tone] || colors.deny;
    const body = hint ? `${msgColor}${message}\n§8${hint}` : `${msgColor}${message}`;
    notify(player, key, titles[tone] || titles.deny, body, sound);
}

function blockTesterBoldShulkerPlaceOrOpen(player, itemStack, block, actionKey) {
    const loc = block?.location ?? player?.location;
    if (!isTesterBoldShulkerPlaceOrOpenBanned(player, loc)) return false;
    if (isBoldNamedShulkerItem(itemStack) || (block && isBoldNamedPlacedShulker(block))) {
        system.run(() => denyTesterBoldShulker(player, actionKey, loc));
        return true;
    }
    return false;
}

// --- UTILITIES ---
function clampNonNegative(v) { return Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0; }
function getPlayerKiller(damageSource) {
    if (!damageSource) return null;
    const direct = damageSource.damagingEntity;
    if (direct?.typeId === "minecraft:player") return direct;
    const owner = damageSource.damagingProjectile?.owner;
    if (owner?.typeId === "minecraft:player") return owner;
    return null;
}
function getCachedNumberStat(player, key, cache) {
    const id = player.id;
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const val = clampNonNegative(player.getDynamicProperty(key));
    cache.set(id, val);
    return val;
}
function setCachedNumberStat(player, key, cache, next) {
    const id = player.id;
    cache.set(id, next);
    player.setDynamicProperty(key, next);
    actionbarStatCache.delete(id);
}

export function cleanupPlayerCaches(playerId) {
    let player = getRealmPlayerById(playerId);
    if (!player?.isValid) {
        try {
            player = world.getAllPlayers().find((p) => p.id === playerId);
        } catch (e) {
            player = null;
        }
    }
    if (player?.isValid) flushPlaytimeNow(player);

    clearPlaytimeSession(playerId);
    cachedKills.delete(playerId);
    cachedDeaths.delete(playerId);
    playerCombatStates.delete(playerId);
    borderWarningCooldown.delete(playerId);
    actionbarStatCache.delete(playerId);
    totemLimiterDropUntil.delete(playerId);
    itemMaintScheduled.delete(playerId);
    playerLastPlotBlock.delete(playerId);
}

function getSafeGamemode(player) {
    return readPlayerGamemode(player);
}

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

function isBuilderOrTester(player) {
    if (isWorldBuilderRole(player)) return false;
    return isCreativeBuilderTagged(player) || isTester(player);
}

function parseGamemodeCommandArg(arg) {
    const token = String(arg || "").toLowerCase();
    if (token === "c" || token === "creative" || token === "1") return "creative";
    if (token === "s" || token === "survival" || token === "0") return "survival";
    if (token === "sp" || token === "spec" || token === "spectator" || token === "3") return "spectator";
    if (token === "a" || token === "adventure" || token === "2") return "adventure";
    return null;
}

function isRestrictedBuilder(player) {
    return isCreativeBuilderTagged(player) && isPlayerInCreative(player);
}

function getHeldItem(player) {
    try {
        const inv = player.getComponent("inventory")?.container || player.getComponent("minecraft:inventory")?.container;
        return inv ? inv.getItem(player.selectedSlotIndex) : null;
    } catch (e) { return null; }
}

const CAPTURE_CUBE_IDS = new Set(["ulkd_ess:empty_capture_cube"]);
const BLOCKED_CAPTURE_MOBS = new Set([
    "minecraft:warden",
    "minecraft:wither",
    "minecraft:wither_skeleton",
    "minecraft:elder_guardian",
    "minecraft:ender_dragon",
    "minecraft:ravager",
    "minecraft:iron_golem",
]);
const BLOCKED_CAPTURE_LABELS = {
    "minecraft:warden": "Wardens",
    "minecraft:wither": "Withers",
    "minecraft:wither_skeleton": "Wither Skeletons",
    "minecraft:elder_guardian": "Elder Guardians",
    "minecraft:ender_dragon": "Ender Dragons",
    "minecraft:ravager": "Ravagers",
    "minecraft:iron_golem": "Iron Golems",
};

function isEmptyCaptureCubeItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    return CAPTURE_CUBE_IDS.has(id) || id.endsWith(":empty_capture_cube");
}

function isCaptureCubeItem(typeId) {
    return isEmptyCaptureCubeItem(typeId);
}

function isAnyCaptureCubeItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    if (!id) return false;
    return id.includes("capture_cube");
}

function isCaptureCubeBlockedInClaim(plot, player) {
    if (!plot) return false;
    if (!isRestrictedCreativeRole(player) && isStaffPlayer(player)) return false;

    // Claim-wide toggle: owner/member/trusted do not bypass when protection is enabled.
    if (isClaimProtectionEnabled(plot, "protectCaptureCubes")) return true;

    // Capture cubes are allowed here, but a player with no general access to this claim
    // (denied entity-interact or denied enter) still cannot use them on entities inside it.
    if (!hasPlotPermission(plot, player, "protectInteract")) return true;
    if (!hasPlotPermission(plot, player, "protectEnter")) return true;

    return false;
}

function getCaptureCubeBlockedPlot(player, targetLocation, targetDimensionId) {
    if (!player) return null;

    if (targetLocation && targetDimensionId) {
        const targetPlot = getPlotAtLocation(targetLocation, targetDimensionId);
        if (isCaptureCubeBlockedInClaim(targetPlot, player)) return targetPlot;
    }

    const playerPlot = getPlotAtLocation(player.location, player.dimension.id);
    if (isCaptureCubeBlockedInClaim(playerPlot, player)) return playerPlot;
    return null;
}

function isFilledCaptureCubeItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    if (!id.includes("capture_cube")) return false;
    if (isEmptyCaptureCubeItem(id)) return false;
    if (id.endsWith("_spawn_egg") || id.includes("spawn_egg")) return false;
    return true;
}

function resolveCaptureCubeEntityType(typeId) {
    const id = String(typeId || "").toLowerCase();
    const named = id.match(/^ulkd_ess:(.+)_capture_cube$/);
    if (named && named[1] !== "empty" && named[1] !== "filled") {
        return `minecraft:${named[1]}`;
    }

    const prefixed = id.match(/^ulkd_ess:capture_cube_(.+)$/);
    if (prefixed) return `minecraft:${prefixed[1]}`;

    return null;
}

function isBlockedCaptureMob(typeId, player) {
    // Staff can bypass the banned-mob capture/release list for testing purposes.
    if (player && !isRestrictedCreativeRole(player) && isStaffPlayer(player)) return false;
    const id = String(typeId || "").toLowerCase();
    return BLOCKED_CAPTURE_MOBS.has(id);
}

function getLookedAtEntity(player, maxDistance = 6) {
    try {
        const hits = player.getEntitiesFromViewDirection?.({ maxDistance });
        return hits?.[0]?.entity ?? null;
    } catch (e) {
        return null;
    }
}

function getEntityRiders(entity) {
    try {
        const rideable = entity.getComponent("minecraft:rideable");
        if (!rideable || typeof rideable.getRiders !== "function") return [];
        return rideable.getRiders().filter((rider) => rider?.isValid);
    } catch (e) {
        return [];
    }
}

function entityHasPlayerRider(entity) {
    return getEntityRiders(entity).some((rider) => rider.typeId === "minecraft:player");
}

function denyCaptureWithRider(player) {
    system.run(() => {
        toastDeny(player, "§cYou cannot capture a mob while someone is riding it!", "capture_cube_rider");
    });
}

function denyBlockedCapture(player, targetOrTypeId) {
    const typeId = String(targetOrTypeId?.typeId ?? targetOrTypeId ?? "").toLowerCase();
    const label = BLOCKED_CAPTURE_LABELS[typeId] || "This mob";
    system.run(() => {
        toastDeny(player, `§c${label} cannot be stored in a capture cube.`, "capture_cube_blocked");
    });
}

/**
 * Cross-pack claim query responder. Essentials BP CANNOT read RAIN SMP's dynamic
 * properties directly — Bedrock cryptographically isolates dynamic properties per
 * behavior pack header UUID, so a world-level property written by one pack is
 * invisible to every other pack, no matter the timing. (This is why the previous
 * "_rain_cc_block_id" / "_rain_cc_regions" dynamic-property signals never actually
 * worked, despite looking correct in RAIN SMP's own logs.)
 *
 * The supported cross-pack channel is system.sendScriptEvent / scriptEventReceive.
 * Essentials sends "rain:cc_check" with the player + location it wants to check,
 * RAIN SMP (the single source of truth for claim permissions) answers with
 * "essentials:cc_check_result". This keeps all claim permission logic in one place.
 */
if (system.afterEvents && system.afterEvents.scriptEventReceive) {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id !== "rain:cc_check") return;
        let data;
        try {
            data = JSON.parse(event.message);
        } catch (e) {
            return;
        }
        const reqId = data?.reqId;
        if (!reqId) return;

        let blocked = false;
        let claimName = "";
        try {
            const player = world.getAllPlayers().find((p) => p.id === data.playerId);
            if (player) {
                const plot = getCaptureCubeBlockedPlot(
                    player,
                    { x: data.x, y: data.y, z: data.z },
                    data.dim || player.dimension.id
                );
                blocked = !!plot;
                claimName = plot?.name || "";
            }
        } catch (e) {}

        try {
            system.sendScriptEvent("essentials:cc_check_result", JSON.stringify({ reqId, blocked, claimName }));
        } catch (e) {}
    });
}

function tryBlockCaptureCubeUse(player, target, event) {
    if (!player || !target || !event) return false;
    const held = getHeldItem(player);
    if (!held || !isCaptureCubeItem(held.typeId)) return false;
    const blockedPlot = getCaptureCubeBlockedPlot(player, target.location, target.dimension.id);
    if (blockedPlot) {
        event.cancel = true;
        toastDeny(
            player,
            `§cCapture cubes are disabled in ${blockedPlot.name || "this claim"}!`,
            "capture_claim_denied"
        );
        return true;
    }
    if (!isBlockedCaptureMob(target.typeId, player)) return false;
    event.cancel = true;
    denyBlockedCapture(player, target);
    return true;
}

function consumeOneHeldItem(player) {
    const inv = player.getComponent("inventory")?.container || player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;

    const slot = player.selectedSlotIndex;
    const item = inv.getItem(slot);
    if (!item) return false;

    if (item.amount > 1) {
        item.amount -= 1;
        inv.setItem(slot, item);
    } else {
        inv.setItem(slot, undefined);
    }

    return true;
}

function consumeHeldCaptureCube(player) {
    const inv = player.getComponent("inventory")?.container || player.getComponent("minecraft:inventory")?.container;
    if (!inv) return;

    const item = inv.getItem(player.selectedSlotIndex);
    if (!item || !isCaptureCubeItem(item.typeId)) return;

    consumeOneHeldItem(player);
}

function givePlayerCaptureStack(player, typeId) {
    if (!player?.isValid || !typeId) return false;

    try {
        const stack = new ItemStack(typeId, 1);
        const inv = player.getComponent("inventory")?.container || player.getComponent("minecraft:inventory")?.container;
        const leftover = inv?.addItem(stack);
        if (leftover) {
            player.dimension.spawnItem(leftover, player.location);
        }
        return true;
    } catch (e) {
        return false;
    }
}

function tryPerformCaptureCube(player, target, event) {
    if (!player || !target || !event) return false;

    const held = getHeldItem(player);
    if (!held || !isCaptureCubeItem(held.typeId)) return false;
    if (target.typeId === "minecraft:player") return false;
    if (isBlockedCaptureMob(target.typeId, player)) return false;
    if (entityHasPlayerRider(target)) {
        event.cancel = true;
        denyCaptureWithRider(player);
        return true;
    }

    const plot = getCaptureCubeBlockedPlot(player, target.location, target.dimension.id);
    if (plot) {
        event.cancel = true;
        system.run(() => {
            toastDeny(
                player,
                `§cCapture cubes are disabled in ${plot.name || "this claim"}!`,
                "capture_claim_denied"
            );
        });
        return true;
    }

    event.cancel = true;

    const entityId = String(target.typeId || "");
    const shortName = entityId.replace(/^minecraft:/, "");
    const loc = target.location;
    const dim = target.dimension;

    system.run(() => {
        try {
            target.remove();
        } catch (e) {}

        consumeHeldCaptureCube(player);

        const itemCandidates = [
            `ulkd_ess:${shortName}_capture_cube`,
            `ulkd_ess:capture_cube_${shortName}`,
            `ulkd_ess:filled_capture_cube`,
        ];

        let captured = false;
        for (const id of itemCandidates) {
            if (givePlayerCaptureStack(player, id)) {
                captured = true;
                break;
            }
        }

        if (captured) {
            notify(
                player,
                "capture_ok",
                "§a§l[CAPTURE]§r",
                `§aCaptured §e${shortName.replace(/_/g, " ")}§a!`,
                "random.levelup",
                1500
            );
        } else {
            toastDeny(player, "§cCapture failed — mob removed but no valid capture item exists.", "capture_fail");
        }
    });

    return true;
}

function tryReleaseCaptureCube(player, itemStack, cancelEvent) {
    if (!player || !itemStack || !cancelEvent) return false;
    if (!isFilledCaptureCubeItem(itemStack.typeId)) return false;

    let releaseAt = null;
    try {
        const hit = player.getBlockFromViewDirection?.({ maxDistance: 10 });
        if (hit?.block?.location) {
            releaseAt = {
                x: hit.block.location.x,
                y: hit.block.location.y + 2,
                z: hit.block.location.z,
            };
        }
    } catch (e) { }

        if (releaseAt) {
        const releasePlot = getCaptureCubeBlockedPlot(player, releaseAt, player.dimension.id);
        if (releasePlot) {
            cancelEvent.cancel = true;
            system.run(() => {
                toastDeny(
                    player,
                    `§cCapture cubes are disabled in ${releasePlot.name || "this claim"}!`,
                    "capture_claim_denied"
                );
            });
            return true;
        }
    }

    const entityType = resolveCaptureCubeEntityType(itemStack.typeId);
    if (!entityType) return false;

    if (isBlockedCaptureMob(entityType, player)) {
        cancelEvent.cancel = true;
        denyBlockedCapture(player, entityType);
        return true;
    }

    cancelEvent.cancel = true;

    system.run(() => {
        if (!consumeOneHeldItem(player)) return;

        const view = player.getViewDirection?.() ?? { x: 0, y: 0, z: 1 };
        const spawnAt = {
            x: player.location.x + view.x * 1.5,
            y: player.location.y,
            z: player.location.z + view.z * 1.5,
        };

        try {
            player.dimension.spawnEntity(entityType, spawnAt);
            notify(
                player,
                "capture_release_ok",
                "§a§l[CAPTURE]§r",
                `§aReleased §e${entityType.replace(/^minecraft:/, "").replace(/_/g, " ")}§a.`,
                "random.levelup",
                1500
            );
        } catch (e) {
            givePlayerCaptureStack(player, itemStack.typeId);
            toastDeny(player, "§cCould not release this mob here.", "capture_release_fail");
        }
    });

    return true;
}

function isBannedBerry(blockId) {
    if (!blockId) return false;
    const id = blockId.toLowerCase();
    return id.includes("berry") && !id.includes("minecraft:sweet_berry");
}

// --- WORLD BUILDER 1.6 (handbook + toolbox — world_builder tag only) ---
const WORLD_BUILDER_HANDBOOK = "oreville_wb:gbpmshn";
const WORLD_BUILDER_ACCESS_TAG = "world_builder";

function isWorldBuilderStaffOnlyItem(typeId) {
    if (!typeId) return false;
    return String(typeId).toLowerCase().startsWith("oreville_wb:");
}

const ITEM_MAINT_EQUIP_SLOTS = [
    EquipmentSlot.Mainhand,
    EquipmentSlot.Offhand,
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
];

function canUseWorldBuilderTools(player) {
    return isWorldBuilderRole(player);
}

function stripWorldBuilderItems(player) {
    if (!player || canUseWorldBuilderTools(player)) return false;

    const inventory = player.getComponent("minecraft:inventory")?.container
        ?? player.getComponent("inventory")?.container;
    const equippable = player.getComponent("minecraft:equippable")
        ?? player.getComponent("equippable");
    let removed = false;

    if (equippable) {
        for (const slot of ITEM_MAINT_EQUIP_SLOTS) {
            const item = equippable.getEquipment(slot);
            if (!item || !isWorldBuilderStaffOnlyItem(item.typeId)) continue;
            equippable.setEquipment(slot, undefined);
            removed = true;
        }
    }

    if (inventory) {
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item || !isWorldBuilderStaffOnlyItem(item.typeId)) continue;
            inventory.setItem(i, undefined);
            removed = true;
        }
    }

    return removed;
}

function blockWorldBuilderStaffOnlyUse(player, itemStack, cancelEvent) {
    if (!player || !itemStack?.typeId || canUseWorldBuilderTools(player)) return false;
    if (!isWorldBuilderStaffOnlyItem(itemStack.typeId)) return false;
    if (cancelEvent && typeof cancelEvent.cancel !== "undefined") {
        cancelEvent.cancel = true;
    }
    system.run(() => stripWorldBuilderItems(player));
    return true;
}

const BANNED_ITEM = "ftb_tc:tnt_modifier";
const MAX_TOTEMS = 2;

const DEBUG_STICK_IDS = new Set([
    "minecraft:debug_stick",
    "ulkd_ess:debug_stick",
]);

function isDebugStick(typeId) {
    if (!typeId) return false;
    return DEBUG_STICK_IDS.has(String(typeId).toLowerCase());
}

function canUseDebugStick(player) {
    return isStaffPlayer(player);
}

function blockDebugStickUse(player, itemStack, cancelEvent) {
    if (!player || !itemStack || canUseDebugStick(player)) return false;
    if (!isDebugStick(itemStack.typeId)) return false;
    cancelEvent.cancel = true;
    system.run(() => {
        notify(
            player,
            "debug_stick_staff",
            "§r§c§l[STAFF]§r §cThe debug stick is staff-only.",
            "",
            "note.bass"
        );
    });
    return true;
}

for (const event of eventRegistry) {
    try {
        const register = () => {
            const eventGroup = event.type === 0 ? world.beforeEvents : world.afterEvents;
            if (eventGroup && eventGroup[event.name]) {
                eventGroup[event.name].subscribe((...args) => { event.run(...args); });
            }
        };
        register();
        system.run(register);
        if (event.name === "chatSend") {
            system.runTimeout(register, 40);
            if (world.afterEvents?.worldLoad) {
                world.afterEvents.worldLoad.subscribe(register);
            }
        }
    } catch (err) { }
}

system.runTimeout(() => startTpaExpiryRuntime(), 1);
system.runTimeout(() => { try { rebuildGlobalClaimChunkCache(true); } catch (e) {} }, 5);
initFloatingTexts();
initSoccerArena();
initCombatRules();
initBountyRuntime();
initClaimLockdownRuntime();
startAnvilColorCodeFixRuntime();
startTinkersAnvilRenameRuntime();
startSignColorCodeFixRuntime();
startGraveCleanupRuntime();
startPrisonRuntime();
startInfestedPotionRuntime();
let actionbarHudFrame = 0;

function updateRestrictedCreativeOnlineFlag(players) {
    restrictedCreativeOnline = false;
    for (const player of players) {
        if (isRestrictedCreativeRole(player)) {
            restrictedCreativeOnline = true;
            return;
        }
    }
}

function tickActionbarHud(players) {
    if (!players?.length) return;

    actionbarHudFrame++;
    const refreshStats = actionbarHudFrame % ACTIONBAR_STAT_REFRESH_LOOPS === 0;
    const batch = nextRealmPlayerBatch(players, ACTIONBAR_BATCH);

    for (const player of batch) {
        if (player.hasTag("hide_stats")) {
            if (actionbarLastSent.get(player.id) !== "") {
                try { player.onScreenDisplay.setActionBar(""); } catch (e) {}
                actionbarLastSent.set(player.id, "");
            }
            continue;
        }

        if (refreshStats) {
            refreshActionbarStatCache(player);
        }

        try {
            const text = buildActionbar(player, formatPlaytimeDHMS(livePlaytimeMsFor(player)));
            if (actionbarLastSent.get(player.id) === text) continue;
            actionbarLastSent.set(player.id, text);
            player.onScreenDisplay.setActionBar(text);
        } catch (e) {}
    }
}

registerRealmAuxHook((players) => {
    tickActionbarHud(players);
});
startRealmAuxLoop();

registerRealmHook(REALM_STAGGER.MEDIUM, (players) => {
    tickGamemodeTracking(players);
    for (const player of players) {
        if (player.hasTag("plot_making")) ensurePlotClaimWand(player);
    }
});

registerRealmAuxHook((players) => {
    for (const player of players) {
        if (!isCreativeBuilderRole(player)) continue;
        syncCreativeRoleTag(player);
        clearStaleBuilderSession(player);
        stripWorldBuilderItems(player);

        if (!isCreativeBuilderInCreative(player)) continue;

        if (builderNeedsInventoryStash(player) || !builderSessionActive(player)) {
            stashBuilderForCreative(player);
            continue;
        }

        rememberPlayerGamemode(player, "creative");
        setCreativeRoleTag(player, true);
    }
});

startPlaytimeRuntime();

// --- COMMANDS & CHAT ---

// ==========================================
// TRUE REALM-OPTIMIZED RTP (LAG-PROOF FIX)
// ==========================================
const RTP_CONFIG = {
    minRadius: 500,
    maxRadius: 10000,
    cooldownMs: 1000,
    maxAttempts: 8,
};

const rtpCooldowns = new Map();

const DANGEROUS_BLOCKS = [
    "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
    "minecraft:powder_snow", "minecraft:magma_block", "minecraft:fire", "minecraft:cactus",
    "minecraft:sweet_berry_bush" 
];

function executeSafeRTP(player) {
    if (isInCombat(player)) {
        const remain = getCombatRemainingSeconds(player);
        notify(player, "rtp_combat", "§c§l[RTP]§r", `§cYou are in combat!\n§eWait ${remain}s before RTP.`, "note.bass");
        return;
    }

    const now = Date.now();
    const lastUsed = rtpCooldowns.get(player.id) || 0;

    if (now - lastUsed < RTP_CONFIG.cooldownMs) {
        const timeLeft = Math.ceil((RTP_CONFIG.cooldownMs - (now - lastUsed)) / 1000);
        notify(player, "rtp_cooldown", "§c§l[COOLDOWN]§r", `§cRTP is on cooldown!\n§eWait ${timeLeft}s to use again.`, "note.bass");
        return;
    }

    rtpCooldowns.set(player.id, now);
    const playerId = player.id;
    const effectOptions = { amplifier: 255, showParticles: false };

    const retryLater = (attempts) => {
        system.runTimeout(() => tryFindSafeSpot(attempts), 2);
    };

    const tryFindSafeSpot = (attempts) => {
        if (!isPlayerOnline(player)) return;
        const dim = world.getDimension("overworld");

        if (attempts <= 0) {
            notify(
                player,
                "rtp_fail",
                "§c§l[RTP]§r",
                `§cCould not find safe land after ${RTP_CONFIG.maxAttempts} tries. Try again!`,
                "note.bass"
            );
            rtpCooldowns.delete(playerId);
            try { player.runCommandAsync(`effect @s clear`); } catch (e) {}
            return;
        }

        const currentAttempt = (RTP_CONFIG.maxAttempts - attempts) + 1;
        notify(
            player,
            "rtp_search",
            "§e§l[RTP]§r",
            `§eSearching for safe land...\n§7Attempt ${currentAttempt}/${RTP_CONFIG.maxAttempts}`,
            "random.orb"
        );

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (RTP_CONFIG.maxRadius - RTP_CONFIG.minRadius) + RTP_CONFIG.minRadius;
        const rx = Math.floor(Math.cos(angle) * dist);
        const rz = Math.floor(Math.sin(angle) * dist);

        try { player.addEffect("blindness", 120, effectOptions); } catch (e) {}
        try { player.addEffect("invisibility", 140, effectOptions); } catch (e) {}
        try { player.addEffect("slow_falling", 200, effectOptions); } catch (e) {}

        preloadChunkThen(
            player,
            dim,
            rx,
            rz,
            (loadedDim, fx, fz) => {
                if (!isPlayerOnline(player)) return;

                const surfaceY = findSafeSurfaceY(loadedDim, fx, fz, DANGEROUS_BLOCKS);
                if (surfaceY === null) {
                    retryLater(attempts - 1);
                    return;
                }

                const plot = getGlobalPlotAtLocation(
                    { x: fx, y: surfaceY, z: fz },
                    loadedDim.id
                );

                if (plot) {
                    retryLater(attempts - 1);
                    return;
                }

                player.teleport(
                    { x: fx + 0.5, y: surfaceY, z: fz + 0.5 },
                    { dimension: loadedDim }
                );
                try { player.addEffect("resistance", 400, effectOptions); } catch (e) {}
                try { player.runCommandAsync(`effect @s blindness 0`); } catch (e) {}
                try { player.runCommandAsync(`effect @s invisibility 0`); } catch (e) {}
                try { player.runCommandAsync(`effect @s slow_falling 0`); } catch (e) {}
                notify(
                    player,
                    "rtp_success",
                    "§a§l[RTP]§r",
                    `§aSafely teleported to the wilderness!\n§7X: ${fx} | Z: ${fz}`,
                    "mob.shulker.teleport"
                );
            },
            () => retryLater(attempts - 1)
        );
    };

    tryFindSafeSpot(RTP_CONFIG.maxAttempts);
}

function onChatSend(ev) {
        const player = ev.sender;
        const msg = (ev.message || "").toLowerCase();

        if (isVanished(player)) {
            ev.cancel = true;
            return;
        }

        // --- MUTE CHECK ---
        if (player.hasTag("bd_muted")) {
            ev.cancel = true;

            system.run(() => {
                notify(player, "chat_muted", "§cYou are muted and cannot chat.", "", "note.bass");
            });

            return;
        }

        // --- RTP COMMANDS ---
        if (msg === "!rtp" || msg === "/rtp" || msg === "!wild" || msg === "/wild") {
            ev.cancel = true;

            system.run(() => {
                executeSafeRTP(player);
            });

            return;
        }

        // --- MINECRAFT GAMEMODE COMMANDS (/gamemode c, /gm s, etc.) ---
        const gmMatch = (ev.message || "").trim().match(/^\/(?:gamemode|gm)\s+(\S+)/i);
        if (gmMatch && isBuilderOrTester(player)) {
            const targetMode = parseGamemodeCommandArg(gmMatch[1]);
            if (targetMode) {
                const fromMode =
                    getRememberedGamemode(player) ||
                    (getSafeGamemode(player) !== "unknown" ? getSafeGamemode(player) : null) ||
                    (player.hasTag("rain_creative_role") ? "creative" : "survival");

                if (fromMode !== targetMode || (targetMode === "creative" && isCreativeBuilderTagged(player))) {
                    system.runTimeout(() => {
                        applyBuilderTesterGamemodeChange(player, fromMode, targetMode);
                    }, 3);
                }
            }
        }

        if (msg === "!fixkit" || msg === "-fixkit") {
            ev.cancel = true;

            system.run(() => {
                const invComp = player.getComponent("inventory");

                if (invComp && invComp.container) {
                    for (let i = 0; i < invComp.container.size; i++) {
                        const itm = invComp.container.getItem(i);
                        if (itm && itm.lockMode !== ItemLockMode.none) {
                            itm.lockMode = ItemLockMode.none;
                            invComp.container.setItem(i, itm);
                        }
                    }
                    invComp.container.clearAll();
                }

                const eqComp = player.getComponent("equippable");

                if (eqComp) {
                    const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
                    for (const slot of slots) {
                        const itm = eqComp.getEquipment(slot);
                        if (itm) {
                            itm.lockMode = ItemLockMode.none;
                            eqComp.setEquipment(slot, undefined);
                        }
                    }
                }

                const tagsToRemove = [
                    "in_arena",
                    "arena_pvp",
                    "arena_player_1",
                    "arena_player_2",
                    "in_spleef",
                    "spleef_p1",
                    "spleef_p2",
                    "spleef_p3",
                    "spleef_p4"
                ];

                for (const tag of tagsToRemove) {
                    if (player.hasTag(tag)) {
                        player.removeTag(tag);
                    }
                }

                notify(player, "fixkit_used", "§r§a§l[SYSTEM]§r §aYour kit has been forcefully wiped and your arena tags have been removed!", "", "random.levelup");
            });

            return;
        }

        // --- TPA chat commands disabled (GUI only) ---
        const trimmed = (ev.message || "").trim().toLowerCase();
        if (
            trimmed.startsWith("/tpa") ||
            trimmed.startsWith("!tpa") ||
            trimmed === "/tpaccept" ||
            trimmed === "/tpdeny" ||
            trimmed.startsWith("/tpaccept ") ||
            trimmed.startsWith("/tpdeny ")
        ) {
            ev.cancel = true;

            system.run(() => {
                if (isCreativeBuilderTagged(player) && isCreativeBuilderInCreative(player)) {
                    notify(
                        player,
                        "tpa_builder_block",
                        "§r§c§l[BUILDER]§r §cTeleport commands are disabled in creative mode!",
                        "",
                        "note.bass"
                    );
                    return;
                }

                notify(
                    player,
                    "tpa_gui_only",
                    "§r§e§l[TPA]§r §eUse the Rain SMP GUI → TPA to send, accept, or deny requests.",
                    "",
                    "note.bass"
                );
            });

            return;
        }

        const rawMessage = (ev.message || "").trim();
        if (rawMessage.startsWith("/")) return;

        // --- CUSTOM CHAT FORMAT (original) ---
        ev.cancel = true;
        deliverFormattedChat(player, ev.message);
        return;
}

startRankChatRuntime(onChatSend);

// --- PLAYER SPAWN & K/D TRACKER ---
if (world.afterEvents && world.afterEvents.playerSpawn) {
    world.afterEvents.playerSpawn.subscribe((event) => {
        const player = event.player;

        if (event.initialSpawn) {
            seedPlaytimeSession(player);
            syncStaffTagsOnJoin(player);
            stripStaleCreativeRoleTag(player);
            system.runTimeout(() => {
                syncOwnedPlotsFromGlobal(player);
                syncCreativeRoleTag(player);
                runPlayerItemMaintenance(player);
        if (isCreativeBuilderRole(player) && isCreativeBuilderInCreative(player)) {
            stashBuilderForCreative(player);
        } else if (isCreativeBuilderRole(player)) {
            clearStaleBuilderSession(player);
        }
                if (!canUseWorldBuilderTools(player)) {
                    stripWorldBuilderItems(player);
                }
            }, 20);
            system.runTimeout(() => {
                if (giveRainGuiOnFirstJoin(player)) {
                    notify(player, "welcome_msg", "§r§d§lWelcome! §r§7Use this Rain SMP GUI to get started.", "", "random.levelup");
                }
            }, 10);
            return;
        }

        system.runTimeout(() => {
            seedPlaytimeSession(player);
            syncStaffTagsOnJoin(player);
            stripStaleCreativeRoleTag(player);
            syncOwnedPlotsFromGlobal(player);
            syncCreativeRoleTag(player);
            if (!isRainGuiMinigamePlayer(player)) {
                ensureRainGuiItem(player);
            }
            runPlayerItemMaintenance(player);
        if (isCreativeBuilderRole(player) && isCreativeBuilderInCreative(player)) {
            stashBuilderForCreative(player);
        } else if (isCreativeBuilderRole(player)) {
            clearStaleBuilderSession(player);
        }
        }, 10);

        if (isArenaMinigamePlayer(player)) {
            player.teleport(FRONT_OF_ARENA, { dimension: world.getDimension("overworld") });

            system.runTimeout(() => {
                restoreMinigameInventory(player);
                notify(player, "arena_death", "§r§c§l[ARENA]§r §cYou died! Your items have been safely restored.");
            }, 10);

            const winner = world.getPlayers({ tags: ["in_arena"], excludeNames: [player.name] })[0];
            if (winner) {
                system.runTimeout(() => {
                    restoreMinigameInventory(winner);
                    winner.teleport(FRONT_OF_ARENA, { dimension: world.getDimension("overworld") });
                    notify(winner, "arena_win", "§r§a§l[ARENA]§r §aYou won the match! Your items have been safely restored.", "", "random.levelup");
                }, 20);
            }
        }
        else if (isSpleefMinigamePlayer(player)) {
            player.teleport(SPLEEF_EXIT_POS, { dimension: world.getDimension("overworld") });
            
            system.runTimeout(() => {
                restoreMinigameInventory(player);
                notify(player, "spleef_death", "§r§c§l[SPLEEF]§r §cYou fell! Your items have been safely restored.");
            }, 10);
        }
    });
}

if (world.afterEvents && world.afterEvents.entityDie) {
    world.afterEvents.entityDie.subscribe((e) => {
        const dead = e.deadEntity;
        if (dead?.typeId === 'minecraft:player') {
            clearCombatLogOnDeath(dead);
            playerCombatStates.set(dead.id, 0);

            const deaths = getCachedNumberStat(dead, DEATHS_KEY, cachedDeaths) + 1;
            setCachedNumberStat(dead, DEATHS_KEY, cachedDeaths, deaths);
            const killer = getPlayerKiller(e.damageSource);
            if (killer && killer.id !== dead.id) {
                const kills = getCachedNumberStat(killer, KILLS_KEY, cachedKills) + 1;
                setCachedNumberStat(killer, KILLS_KEY, cachedKills, kills);
            }
        }
    });
}

// --- OPTIMIZED CORE LOOPS ---

function tickRtpQueue() {
    try {
        const queuedPlayers = world.getPlayers({ tags: ["queue_rtp"] });
        for (const p of queuedPlayers) {
            p.removeTag("queue_rtp");
            executeSafeRTP(p);
        }
    } catch (e) {}
}

// ✨ 20-Tick Loop (~1s): Realm master loop — one interval drives staggered subsystems
system.runInterval(() => {
    const frame = nextRealmFrame();
    if (onRealmFrame(REALM_TICK.CACHE_FALLBACK, frame)) {
        rebuildGlobalClaimChunkCache(true);
    }

    const players = refreshRealmPlayers();
    const now = Date.now();
    updateRestrictedCreativeOnlineFlag(players);

    if (onRealmFrame(1, frame)) {
        tickRtpQueue();
    }

    runRealmHooks(frame, players, now);

    if (onRealmFrame(REALM_STAGGER.SLOW, frame)) {
        pruneToastCooldowns();
    }

    tickInfestedPotionRealm(frame, players);

    if (anyCachedPlayerHasTag("in_arena") || anyCachedPlayerHasTag("in_spleef")) {
        tickMinigameWaits(players);
    }

    tickWorldBorderStaggered(players, now);

    if (onRealmFrame(1, frame)) {
        tickCombatSnapshots(players, now);
    }

    if (onRealmFrame(3, frame)) {
        tickCombatSnapshotItems(players, now);
    }

    const combatRemainingById = buildCombatRemainingMap(players, now);

    tickCombatElytra(players, combatRemainingById);
    tickMaceSlowness();

    if (onRealmFrame(1, frame)) {
        tickPlotEnterSafezoneStaggered(players);
    }

    if (onRealmFrame(REALM_STAGGER.ITEM_MAINT, frame)) {
        tickSlowPlayerMaintenance(players);
    }

    if (onRealmFrame(10, frame)) {
        tickSugarcaneWaterScan(players);
    }

    if (onRealmFrame(NAMETAG_EVERY_LOOPS, frame)) {
        for (const taggedPlayer of nextRealmPlayerBatch(players, REALM_STAGGER.NAMETAG_BATCH)) {
            taggedPlayer.nameTag = formatNameTag(taggedPlayer);
        }
    }

    for (const playerId of collectCombatTrackedPlayerIds(combatRemainingById)) {
        const player = getRealmPlayerById(playerId);
        if (!player) continue;

        const remaining = combatRemainingById.get(playerId) ?? 0;
        const lastRemaining = playerCombatStates.get(playerId) || 0;
        if (remaining === 0 && lastRemaining === 0) continue;
        const wasInCombat = lastRemaining > 0;

        if (player.hasTag("hide_stats")) {
            if (remaining > 0 && !wasInCombat) {
                try { player.onScreenDisplay.setActionBar(""); } catch (e) {}
            } else if (remaining === 0 && wasInCombat) {
                try { player.onScreenDisplay.setActionBar(""); } catch (e) {}
            }
        }

        if (remaining > 0) {
            if (!wasInCombat) {
                notify(
                    player,
                    "combat_enter",
                    "§r§c§l[COMBAT]§r",
                    "§cYou are now in combat! Do not log out!",
                    "random.bowhit"
                );
            } else if (lastRemaining > 15 && remaining <= 15) {
                notify(
                    player,
                    "combat_15",
                    "§r§c§l[COMBAT]§r",
                    "§e15 seconds left",
                    "random.bowhit"
                );
            } else if (lastRemaining > 5 && remaining <= 5) {
                notify(
                    player,
                    "combat_5",
                    "§r§c§l[COMBAT]§r",
                    "§e5 seconds left",
                    "random.bowhit"
                );
            }
            playerCombatStates.set(playerId, remaining);
        } else if (remaining === 0 && wasInCombat) {
            notify(
                player,
                "combat_exit",
                "§r§a§l[COMBAT]§r",
                "§aYou are out of combat. Safe to log out!",
                "random.levelup"
            );
            clearCombatLog(player);
            playerCombatStates.set(playerId, 0);
            enforcePlotEnterDenyForPlayer(player);
        }
    }
}, SIDEBAR_LOOP_TICKS);

// --- PLOT & LAND SYSTEM ---
function getPlotAtLocation(loc, dimId) {
    return getGlobalPlotAtLocation(loc, dimId);
}

// ✨ THE UPGRADED PERMISSION CHECKER
function hasPlotPermission(plot, player, permKey) {
    if (!plot) return false;
    if (!isRestrictedCreativeRole(player) && isStaffPlayer(player)) return true;

    if (hasTesterClaimBuildBypass(plot, player)) return true;

    if (plot.ownerId === player.id || plot.ownerName === player.name) return true;

    if (isClaimPermAllowed(plot, player, permKey)) return true;

    return false;
}

// Plot enter/safezone — only when the player moves to a new block
function buildCombatRemainingMap(players, now) {
    const map = new Map();
    if (!players?.length) return map;

    for (const player of players) {
        const lastRemaining = playerCombatStates.get(player.id) || 0;
        if (lastRemaining > 0) {
            map.set(player.id, getCombatRemainingSeconds(player, now));
        }
    }

    combatScanRot = (combatScanRot + 1) % players.length;
    const scanPlayer = players[combatScanRot];
    if (!map.has(scanPlayer.id)) {
        const remaining = getCombatRemainingSeconds(scanPlayer, now);
        if (remaining > 0) {
            map.set(scanPlayer.id, remaining);
        }
    }

    return map;
}

function collectCombatTrackedPlayerIds(combatRemainingById) {
    const ids = new Set();

    for (const [playerId, remaining] of combatRemainingById) {
        if (remaining > 0) ids.add(playerId);
    }

    for (const [playerId, lastRemaining] of playerCombatStates) {
        if (lastRemaining > 0) ids.add(playerId);
    }

    return ids;
}

function tickPlotEnterSafezoneStaggered(players) {
    if (!players?.length) return;

    const batch = Math.min(
        players.length > 12 ? Math.max(2, Math.floor(PLOT_ENTER_BATCH / 2)) : PLOT_ENTER_BATCH,
        players.length
    );
    for (let i = 0; i < batch; i++) {
        plotEnterRot = (plotEnterRot + 1) % players.length;
        tickPlotEnterSafezone(players[plotEnterRot]);
    }
}

function tickPlotEnterSafezone(player) {
    try {
        const loc = player.location;
        const blockKey = `${Math.floor(loc.x)}:${Math.floor(loc.y)}:${Math.floor(loc.z)}:${player.dimension.id}`;
        if (playerLastPlotBlock.get(player.id) === blockKey) return;
        playerLastPlotBlock.set(player.id, blockKey);

        const plot = getPlotAtLocation(loc, player.dimension.id);
        const lastPlot = playerCurrentPlot.get(player.id);

        if (plot && (plot.permissions?.default?.protectPvp === true || plot.permissions?.default?.protectPvp === undefined)) {
            if (!player.hasTag("in_safezone")) player.addTag("in_safezone");
        } else {
            if (player.hasTag("in_safezone")) player.removeTag("in_safezone");
        }

        const visiblePlot = plot?.isSubclaim ? (getParentClaim(plot) || plot) : plot;
        const visibleLastPlot = lastPlot?.isSubclaim ? (getParentClaim(lastPlot) || lastPlot) : lastPlot;

        const currentName = visiblePlot ? (visiblePlot.name || visiblePlot.id || "Claimed Land") : "Wilderness";
        const lastName = visibleLastPlot ? (visibleLastPlot.name || visibleLastPlot.id || "Claimed Land") : "Wilderness";

        if (currentName !== lastName) {
            const claimToastSound = "random.toast";
            const claimToastVolume = 0.72;
            const suppressEnter = visiblePlot && plotHidesEnterToastForRole(visiblePlot, player);
            const suppressWilderness =
                !visiblePlot && visibleLastPlot && plotHidesEnterToastForRole(visibleLastPlot, player);

            if (visiblePlot && !suppressEnter) {
                const ownerDisp = visiblePlot.ownerName ? visiblePlot.ownerName : "Server";

                notify(
                    player,
                    "claim_enter",
                    `§b§lEntering: ${currentName}`,
                    `§7Owner: §f${ownerDisp}`,
                    claimToastSound,
                    2000,
                    claimToastVolume
                );
            } else if (!visiblePlot && !suppressWilderness) {
                notify(
                    player,
                    "claim_wilderness",
                    `§a§lEntering: Wilderness`,
                    `§7Unclaimed Land`,
                    claimToastSound,
                    2000,
                    claimToastVolume
                );
            }
        }

        playerCurrentPlot.set(player.id, plot);
    } catch (e) {}
}

function tickMinigameWaits(players) {
    const arenaPlayers = [];
    const spleefPlayers = [];
    for (const p of players) {
        if (p.hasTag("in_arena")) arenaPlayers.push(p);
        else if (p.hasTag("in_spleef")) spleefPlayers.push(p);
    }
    if (!arenaPlayers.length && !spleefPlayers.length) return;

    const now = Date.now();

    if (arenaPlayers.length === 1) {
        const p = arenaPlayers[0];
        if (!arenaWaitTime.has(p.id)) {
            arenaWaitTime.set(p.id, now);
            arenaWaitWarning.delete(p.id);
            notify(p, "arena_waiting", "§eWaiting for an opponent...", "You will be kicked in 30s if no one joins.");
        } else {
            const elapsed = now - arenaWaitTime.get(p.id);
            if (elapsed >= 30000) {
                restoreMinigameInventory(p);
                p.teleport(FRONT_OF_ARENA, { dimension: world.getDimension("overworld") });
                notify(p, "arena_timeout", "§cKicked from Arena", "No opponent joined in time.", "note.bass");
                arenaWaitTime.delete(p.id);
                arenaWaitWarning.delete(p.id);
            } else if (elapsed >= 15000 && !arenaWaitWarning.has(p.id)) {
                arenaWaitWarning.add(p.id);
                notify(p, "arena_warning", "§e15 Seconds Left!", "You will be kicked soon if no one joins.", "ui.button.click");
            }
        }
    } else {
        arenaWaitTime.clear();
        arenaWaitWarning.clear();
    }

    if (spleefPlayers.length === 1) {
        const p = spleefPlayers[0];
        if (!spleefWaitTime.has(p.id)) {
            spleefWaitTime.set(p.id, now);
            spleefWaitWarning.delete(p.id);
            notify(p, "spleef_waiting", "§eWaiting for opponents...", "You will be kicked in 30s if no one joins.");
        } else {
            const elapsed = now - spleefWaitTime.get(p.id);
            if (elapsed >= 30000) {
                restoreMinigameInventory(p);
                p.teleport(SPLEEF_EXIT_POS, { dimension: world.getDimension("overworld") });
                notify(p, "spleef_timeout", "§cKicked from Spleef", "No opponents joined in time.", "note.bass");
                spleefWaitTime.delete(p.id);
                spleefWaitWarning.delete(p.id);
            } else if (elapsed >= 15000 && !spleefWaitWarning.has(p.id)) {
                spleefWaitWarning.add(p.id);
                notify(p, "spleef_warning", "§e15 Seconds Left!", "You will be kicked soon if no one joins.", "ui.button.click");
            }
        }
    } else {
        spleefWaitTime.clear();
        spleefWaitWarning.clear();
    }
}

function tickWorldBorderForPlayer(player, now) {
    if (isStaffPlayer(player)) return;
    if (isTester(player)) return;

    let loc;
    try { loc = player.location; } catch (e) { return; }

    let newX = loc.x;
    let newZ = loc.z;
    let outOfBounds = false;

    if (loc.x > 10000) { newX = 9995; outOfBounds = true; }
    else if (loc.x < -10000) { newX = -9995; outOfBounds = true; }
    if (loc.z > 10000) { newZ = 9995; outOfBounds = true; }
    else if (loc.z < -10000) { newZ = -9995; outOfBounds = true; }

    const lastWarn = borderWarningCooldown.get(player.id) || 0;

    if (outOfBounds) {
        try {
            teleportClamped(player, newX, newZ);
            player.runCommandAsync("playsound mob.elderguardian.curse @s ~ ~ ~ 1 0.5");
            player.runCommandAsync("particle minecraft:dragon_breath_trail ~ ~1 ~");

            if (now - lastWarn > 3000) {
                notify(player, "border_reach", "§r§c§l[BORDER]§r §cYou have reached the World Border!");
                borderWarningCooldown.set(player.id, now);
            }
        } catch (e) {}
    } else if (loc.x > 9990 || loc.x < -9990 || loc.z > 9990 || loc.z < -9990) {
        if (now - lastWarn > 3000) {
            notify(player, "border_approach", "§r§e§l[BORDER]§r §eYou are approaching the World Border!");
            borderWarningCooldown.set(player.id, now);
        }
    }
}

function tickWorldBorderStaggered(players, now) {
    if (!players.length) return;

    for (let i = 0; i < REALM_STAGGER.BORDER_BATCH; i++) {
        const player = nextRealmPlayer(players);
        if (!player) break;

        let loc;
        try { loc = player.location; } catch (e) { continue; }
        if (Math.abs(loc.x) < 9900 && Math.abs(loc.z) < 9900) continue;

        tickWorldBorderForPlayer(player, now);
    }
}

function tickCombatElytra(players, combatRemainingById) {
    for (const [playerId, remaining] of combatRemainingById) {
        if (remaining <= 0) continue;

        const player = getRealmPlayerById(playerId);
        if (!player) continue;

        const equippable = player.getComponent("minecraft:equippable");
        if (!equippable) continue;

        const chestItem = equippable.getEquipment(EquipmentSlot.Chest);
        if (!chestItem || chestItem.typeId !== "minecraft:elytra") continue;

        equippable.setEquipment(EquipmentSlot.Chest, undefined);
        const inventory = player.getComponent("minecraft:inventory");
        let addedToInv = false;
        if (inventory?.container?.emptySlotsCount > 0) {
            try {
                inventory.container.addItem(chestItem);
                addedToInv = true;
                notify(
                    player,
                    "combat_elytra",
                    "§r§c§l[COMBAT]§r",
                    "§cElytras are disabled in combat! Moved to your inventory.",
                    "note.bass"
                );
            } catch (e) {}
        }
        if (!addedToInv) {
            try {
                player.dimension.spawnItem(chestItem, player.location);
                notify(
                    player,
                    "combat_elytra_drop",
                    "§r§c§l[COMBAT]§r",
                    "§cElytras disabled! Your inventory was full, so it dropped on the ground.",
                    "note.bass"
                );
            } catch (e) {}
        }
        player.playSound("armor.equip_generic");
    }
}

function trimExcessTotems(player, inventory, equippable, totemCount, offhandTotems, dropTypeId) {
    if (totemCount <= MAX_TOTEMS) return;

    let excess = totemCount - MAX_TOTEMS;
    let dropped = 0;

    if (inventory) {
        for (let i = 0; i < inventory.size && excess > 0; i++) {
            const item = inventory.getItem(i);
            if (!item || !isTotemItem(item.typeId)) continue;

            dropTypeId = item.typeId;
            if (item.amount <= excess) {
                dropped += item.amount;
                excess -= item.amount;
                inventory.setItem(i, undefined);
            } else {
                dropped += excess;
                const newItem = item.clone();
                newItem.amount -= excess;
                inventory.setItem(i, newItem);
                excess = 0;
            }
        }
    }

    if (excess > 0 && equippable && offhandTotems > 0) {
        const offhand = equippable.getEquipment(EquipmentSlot.Offhand);
        if (offhand && isTotemItem(offhand.typeId)) {
            dropTypeId = offhand.typeId;
            if (offhand.amount <= excess) {
                dropped += offhand.amount;
                equippable.setEquipment(EquipmentSlot.Offhand, undefined);
            } else {
                dropped += excess;
                const newItem = offhand.clone();
                newItem.amount -= excess;
                equippable.setEquipment(EquipmentSlot.Offhand, newItem);
            }
        }
    }

    if (dropped > 0) {
        dropItemsAtPlayer(player, dropTypeId, dropped);
        notify(player, "totem_limit", "§c§l[SYSTEM]§r §cYou can only hold a maximum of 2 Totems of Undying. Excess totems were dropped!", "", "note.bass");
    }
}

function inventoryChangeStack(event) {
    return event?.itemStack ?? event?.newItemStack ?? event?.beforeItemStack ?? event?.afterItemStack;
}

/** World Builder handbook/toolbox spam inventory events — defer to slow tick only. */
function shouldScheduleEventItemMaintenance(player, event) {
    if (!player?.id) return false;
    if (isWorldBuilderRole(player)) return false;

    const changed = inventoryChangeStack(event);
    if (isWorldBuilderStaffOnlyItem(changed?.typeId)) return false;

    return true;
}

/** One inventory pass: banned items, staff-only tools, debug sticks, totem cap. */
function runPlayerItemMaintenance(player, { stripWorldBuilder = false } = {}) {
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const equippable = player.getComponent("minecraft:equippable");
    if (!inventory && !equippable) return;

    const stripBanned = !isTester(player);
    const stripWb = (stripWorldBuilder || !canUseWorldBuilderTools(player)) && !canUseWorldBuilderTools(player);
    const stripDebug = !canUseDebugStick(player);
    let bannedRemoved = false;
    let totemCount = 0;
    let offhandTotems = 0;
    let dropTypeId = "minecraft:totem_of_undying";

    if (equippable) {
        for (const slot of ITEM_MAINT_EQUIP_SLOTS) {
            const item = equippable.getEquipment(slot);
            if (!item) continue;

            const typeId = item.typeId;
            if (stripBanned && typeId === BANNED_ITEM) {
                equippable.setEquipment(slot, undefined);
                bannedRemoved = true;
                continue;
            }
            if (stripWb && isWorldBuilderStaffOnlyItem(typeId)) {
                equippable.setEquipment(slot, undefined);
                continue;
            }
            if (stripDebug && isDebugStick(typeId)) {
                equippable.setEquipment(slot, undefined);
                continue;
            }
            if (isTotemItem(typeId)) {
                totemCount += item.amount;
                if (slot === EquipmentSlot.Offhand) {
                    offhandTotems = item.amount;
                    dropTypeId = typeId;
                }
            }
        }
    }

    if (inventory) {
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) continue;

            const typeId = item.typeId;
            if (stripBanned && typeId === BANNED_ITEM) {
                inventory.setItem(i, undefined);
                bannedRemoved = true;
                continue;
            }
            if (stripWb && isWorldBuilderStaffOnlyItem(typeId)) {
                inventory.setItem(i, undefined);
                continue;
            }
            if (stripDebug && isDebugStick(typeId)) {
                inventory.setItem(i, undefined);
                continue;
            }
            if (isTotemItem(typeId)) {
                totemCount += item.amount;
                dropTypeId = typeId;
            }
        }
    }

    if (bannedRemoved) {
        notify(player, "tnt_modifier_inv_removed", "§cThe TNT Modifier is banned and has been removed from your inventory.", "", "note.bass");
    }

    trimExcessTotems(player, inventory, equippable, totemCount, offhandTotems, dropTypeId);
}

const itemMaintScheduled = new Set();

function schedulePlayerItemMaintenance(player) {
    if (!player?.id || itemMaintScheduled.has(player.id)) return;
    itemMaintScheduled.add(player.id);
    system.run(() => {
        itemMaintScheduled.delete(player.id);
        if (!isPlayerOnline(player)) return;
        if (stripWorldBuilderItems(player)) return;
        runPlayerItemMaintenance(player, { stripWorldBuilder: true });
    });
}

function tickSlowPlayerMaintenance(players) {
    if (!players.length) return;

    for (let i = 0; i < REALM_STAGGER.SLOW_MAINT_BATCH; i++) {
        const player = nextRealmPlayer(players);
        if (!player) break;

        runPlayerItemMaintenance(player, { stripWorldBuilder: true });
    }
}

const maceSlownessActive = new Set();
const maceHolderIds = new Set();
const MACE_SLOWNESS_DURATION = 25;

function syncMaceHolderState(player) {
    if (!player?.id) return;

    const equipment = player.getComponent("minecraft:equippable");
    const mainHand = equipment?.getEquipment("Mainhand");
    const holdingMace = mainHand?.typeId === "minecraft:mace";

    if (holdingMace) {
        maceHolderIds.add(player.id);
        return;
    }

    maceHolderIds.delete(player.id);
    if (maceSlownessActive.has(player.id)) {
        try {
            player.removeEffect("minecraft:slowness");
        } catch (e) {}
        maceSlownessActive.delete(player.id);
    }
}

function tickMaceSlownessForPlayer(player) {
    const equipment = player.getComponent("minecraft:equippable");
    if (!equipment) return;

    const mainHand = equipment.getEquipment("Mainhand");
    const holdingMace = mainHand?.typeId === "minecraft:mace";

    if (holdingMace) {
        maceHolderIds.add(player.id);
        try {
            player.addEffect("slowness", MACE_SLOWNESS_DURATION, {
                amplifier: 0,
                showParticles: false
            });
            maceSlownessActive.add(player.id);
        } catch (e) {}
    } else {
        maceHolderIds.delete(player.id);
        if (maceSlownessActive.has(player.id)) {
            try {
                player.removeEffect("minecraft:slowness");
            } catch (e) {}
            maceSlownessActive.delete(player.id);
        }
    }
}

function tickMaceSlowness() {
    if (!maceHolderIds.size) return;

    for (const playerId of [...maceHolderIds]) {
        const player = getRealmPlayerById(playerId);
        if (!player) {
            maceHolderIds.delete(playerId);
            maceSlownessActive.delete(playerId);
            continue;
        }
        tickMaceSlownessForPlayer(player);
    }
}

function applyMaceSlownessIfHolding(player) {
    if (!player) return;
    syncMaceHolderState(player);
    if (maceHolderIds.has(player.id)) {
        tickMaceSlownessForPlayer(player);
    }
}

function buildActionbar(player, time) {
    let stats = actionbarStatCache.get(player.id);
    if (!stats) {
        refreshActionbarStatCache(player);
        stats = actionbarStatCache.get(player.id);
    }

    const base =
        `§r\n§r  §b${player.name}\n§r\n` +
        `§r§a Kills§7: §f${stats.kills}\n§r§c Deaths§7: §f${stats.deaths}\n` +
        `§r§e K/D§7: §f${(stats.kills / Math.max(1, stats.deaths)).toFixed(2)}\n§r\n` +
        `§r§b Rank§7: §d${stats.rank}\n§r§d CPS§7: §f${stats.cps}\n§r\n` +
        `§r §f${time}`;

    if (isSoccerPlayer(player)) {
        return base + getSoccerHudFooter(player);
    }
    return base;
}

function refreshActionbarStatCache(player) {
    actionbarStatCache.set(player.id, {
        kills: getCachedNumberStat(player, KILLS_KEY, cachedKills),
        deaths: getCachedNumberStat(player, DEATHS_KEY, cachedDeaths),
        rank: getRankMeta(player).label,
        cps: getPlayerCPS(player),
    });
}

// --- THE ENFORCERS (PVP — must use entityHurt; entityDamage is unreliable on Bedrock) ---
function shouldBlockClaimPvp(victim, attacker) {
    if (!victim || !attacker) return false;
    if (victim.typeId !== "minecraft:player" || attacker.typeId !== "minecraft:player") return false;

    if (isSoccerPlayer(victim) || isSoccerPlayer(attacker)) return true;

    if (
        attacker.hasTag("arena_pvp") && victim.hasTag("arena_pvp") &&
        attacker.hasTag("in_arena") && victim.hasTag("in_arena")
    ) {
        return false;
    }

    if (isRestrictedCreativeRole(attacker)) return false;

    const victimPlot = getPlotAtLocation(victim.location, victim.dimension.id);
    const attackerPlot = getPlotAtLocation(attacker.location, attacker.dimension.id);
    const bountyOk = allowsBountyPvp(victim, attacker);
    const lockdownOk = allowsClaimLockdownPvp(victim);

    if (bountyOk || lockdownOk) return false;

    if (victimPlot && !isPvpAllowedInClaim(victimPlot, attacker)) return true;
    if (attackerPlot && !isPvpAllowedInClaim(attackerPlot, attacker)) return true;

    return false;
}

if (world.beforeEvents?.entityHurt) {
    world.beforeEvents.entityHurt.subscribe((event) => {
        try {
            const victim = event.hurtEntity;
            const attacker = getPlayerDamageSource(event.damageSource)
                ?? event.damageSource?.damagingEntity;

            if (victim?.typeId === "minecraft:player" && attacker?.typeId === "minecraft:player") {
                if (isSoccerPlayer(victim) || isSoccerPlayer(attacker)) {
                    event.cancel = true;
                    return;
                }

                if (isRestrictedCreativeRole(attacker)) {
                    event.cancel = true;
                    system.run(() => {
                        notify(attacker, "anti_abuse_pvp", "§r§c§l[ANTI-ABUSE]§r §cYou cannot attack players in Creative mode!", "", "note.bass");
                    });
                    return;
                }
            }

            if (!shouldBlockClaimPvp(victim, attacker)) return;

            event.cancel = true;
            system.run(() => {
                notify(attacker, "claim_no_pvp", `§r§c§l[CLAIM]§r §cPVP is disabled inside this claim!`, "", "note.bass");
            });
        } catch (e) { }
    });
}

if (world.afterEvents?.entityHurt) {
    world.afterEvents.entityHurt.subscribe((event) => {
        try {
            const victim = event.hurtEntity;
            const attacker = getPlayerDamageSource(event.damageSource)
                ?? event.damageSource?.damagingEntity;

            if (!shouldBlockClaimPvp(victim, attacker)) return;

            const damage = Number(event.damage) || 0;
            if (damage <= 0) return;

            system.run(() => {
                try {
                    const health = victim.getComponent("minecraft:health");
                    if (health) {
                        health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + damage));
                    }
                } catch (e) {}
            });
        } catch (e) {}
    });
}


const totemLimiterDropUntil = new Map();

function isTotemItem(typeId) {
    const id = String(typeId || "").toLowerCase();
    return id === "minecraft:totem_of_undying" || id === "minecraft:totem" || id.includes("totem_of_undying");
}

function markTotemLimiterDrop(player, durationMs = 8000) {
    totemLimiterDropUntil.set(player.id, Date.now() + durationMs);
}

function isInTotemLimiterDropGrace(player) {
    return (totemLimiterDropUntil.get(player?.id) || 0) > Date.now();
}

if (world.beforeEvents && world.beforeEvents.playerBreakBlock) {
    world.beforeEvents.playerBreakBlock.subscribe((event) => {
        try {
            const blockId = event.block.typeId;
            const player = event.player;

            if (player.hasTag("in_spleef")) {
                if (isSpleefBreakableBlock(blockId)) return;
                else {
                    event.cancel = true;
                    system.run(() => { notify(player, "spleef_break", "§r§c§l[SPLEEF]§r §cYou can only break snow in the arena!"); });
                    return;
                }
            }

            const breakResult = resolveRestrictedCreativeBreak(player, event.block, event);
            if (breakResult === "blocked" || breakResult === "allowed") {
                if (breakResult === "blocked") event.cancel = true;
                return;
            }

            if (isBannedBerry(blockId) && !isStaffPlayer(player)) {
                event.cancel = true;
                system.run(() => {
                    notify(player, "banned_berry", "§r§c§l[SERVER]§r §cThese ore berries are completely banned!", "", "note.bass");
                });
                return;
            }

            // --- TESTER 10k: only block when not in admin claim or tester-enabled claim ---
            if (isTesterRestrictedAt(player, event.block.location)) {
                event.cancel = true;
                system.run(() => {
                    denyTesterCreativeOnly(
                        player,
                        "break",
                        "You can only break blocks inside Admin Claims or Tester-enabled claims.",
                        "Survival · 10k radius"
                    );
                });
                return;
            }

        } catch (e) { }
    });
}

// --- Sugarcane orphan cleanup: destroy unsupported reed columns immediately after a nearby break ---
world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
        const dim = event.player.dimension;
        const { x, y, z } = event.block.location;
        const neighbors = [
            { x: x + 1, y, z }, { x: x - 1, y, z },
            { x, y, z: z + 1 }, { x, y, z: z - 1 },
            { x, y: y + 1, z }, { x, y: y - 1, z },
        ];
        for (const loc of neighbors) {
            try {
                const nb = dim.getBlock(loc);
                if (nb?.typeId !== "minecraft:reeds") continue;
                // Walk down to the base of this column
                let base = nb;
                while (true) {
                    const below = dim.getBlock({ x: base.location.x, y: base.location.y - 1, z: base.location.z });
                    if (below?.typeId === "minecraft:reeds") { base = below; } else { break; }
                }
                // Check water adjacency at the base
                const bx = base.location.x, by = base.location.y, bz = base.location.z;
                const waterNeighbors = [
                    dim.getBlock({ x: bx + 1, y: by, z: bz }),
                    dim.getBlock({ x: bx - 1, y: by, z: bz }),
                    dim.getBlock({ x: bx, y: by, z: bz + 1 }),
                    dim.getBlock({ x: bx, y: by, z: bz - 1 }),
                ];
                const hasWater = waterNeighbors.some(b => b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water"));
                if (hasWater) continue;
                // No water — destroy the entire column
                let cur = base;
                while (cur?.typeId === "minecraft:reeds") {
                    cur.setType("minecraft:air");
                    cur = dim.getBlock({ x: cur.location.x, y: cur.location.y + 1, z: cur.location.z });
                }
            } catch (_) { }
        }
    } catch (e) { }
});

// --- tickSugarcaneWaterScan: passive scan every 200 ticks (~10s), one player per pass ---
let _sugarcanePlayerRot = 0;
function tickSugarcaneWaterScan(players) {
    if (!players.length) return;
    const player = players[_sugarcanePlayerRot % players.length];
    _sugarcanePlayerRot++;
    if (!player?.isValid) return;
    const dim = player.dimension;
    const { x: px, y: py, z: pz } = player.location;
    const RADIUS = 12;
    for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dz = -RADIUS; dz <= RADIUS; dz++) {
            for (let dy = -RADIUS; dy <= RADIUS; dy++) {
                try {
                    const block = dim.getBlock({ x: Math.floor(px + dx), y: Math.floor(py + dy), z: Math.floor(pz + dz) });
                    if (block?.typeId !== "minecraft:reeds") continue;
                    // Only process base reeds (block below is not also a reed)
                    const below = dim.getBlock({ x: block.location.x, y: block.location.y - 1, z: block.location.z });
                    if (below?.typeId === "minecraft:reeds") continue;
                    const bx = block.location.x, by = block.location.y, bz = block.location.z;
                    const adj = [
                        dim.getBlock({ x: bx + 1, y: by, z: bz }),
                        dim.getBlock({ x: bx - 1, y: by, z: bz }),
                        dim.getBlock({ x: bx, y: by, z: bz + 1 }),
                        dim.getBlock({ x: bx, y: by, z: bz - 1 }),
                    ];
                    const hasWater = adj.some(b => b && (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water"));
                    if (hasWater) continue;
                    let cur = block;
                    while (cur?.typeId === "minecraft:reeds") {
                        cur.setType("minecraft:air");
                        cur = dim.getBlock({ x: cur.location.x, y: cur.location.y + 1, z: cur.location.z });
                    }
                } catch (_) { }
            }
        }
    }
}

if (world.beforeEvents && world.beforeEvents.playerPlaceBlock) {
    world.beforeEvents.playerPlaceBlock.subscribe((event) => {
        try {
            const player = event.player;
            const blockId = event.block.typeId.toLowerCase();
            const itemStack = event.itemStack;

            const placeResult = resolveRestrictedCreativePlace(player, event.block, event);
            if (placeResult === "blocked" || placeResult === "allowed") {
                if (placeResult === "blocked") event.cancel = true;
                return;
            }

            // --- TESTER: shulker place restrictions ---
            if (
                blockTesterCreativeShulkerPlaceOrOpen(player, itemStack, event.block, "place") ||
                blockTesterBoldShulkerPlaceOrOpen(player, itemStack, event.block, "place")
            ) {
                event.cancel = true;
                return;
            }

            // --- TESTER 10k placement ---
            if (isTesterRestrictedAt(player, event.block.location)) {
                event.cancel = true;
                system.run(() => {
                    denyTesterCreativeOnly(
                        player,
                        "build",
                        "You can only build inside Admin Claims or Tester-enabled claims.",
                        "Survival · 10k radius"
                    );
                });
                return;
            }

            if (isRestrictedCreativeRole(player)) {
                if (blockId.includes("tnt") || blockId.includes("respawn_anchor")) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "anti_abuse_tnt", "You cannot place explosives in Creative mode.");
                    });
                    return;
                }
            }
        } catch (e) { }
    });
}

if (world.beforeEvents && world.beforeEvents.itemUse) {
    world.beforeEvents.itemUse.subscribe((event) => {
        try {
            const player = event.source;
            if (!player || player.typeId !== "minecraft:player") return;

            if (isRainGuiItem(event.itemStack) && isRainGuiBlocked(player)) {
                event.cancel = true;
                system.run(() => {
                    stripRainGuiForGravestone(player);
                    notify(player, "rain_gui_blocked", "§c§l[BLOCKED]§r", "§cYour RAIN GUI access is disabled.", "note.bass");
                });
                return;
            }

            if (isCaptureCubeItem(event.itemStack?.typeId)) {
                const target = getLookedAtEntity(player);
                if (target && tryBlockCaptureCubeUse(player, target, event)) return;
            }

            if (isRestrictedCreativeRole(player) && isRestrictedCreativeItem(event.itemStack?.typeId)) {
                event.cancel = true;
                system.run(() => {
                    denyRestrictedCreative(player, "anti_abuse_item", "This item is locked in Creative mode.");
                });
            }
        } catch (e) { }
    });
}

if (world.beforeEvents && world.beforeEvents.itemUseOn) {
    world.beforeEvents.itemUseOn.subscribe((ev) => {
        try {
            const player = ev.source;
            const block = ev.block;
            const item = ev.itemStack;

            if (!block || player?.typeId !== "minecraft:player") return;

            const blockId = block.typeId.toLowerCase();

            if (isRestrictedCreativeRole(player)) {
                if (isRestrictedUsableBlock(blockId)) {
                    ev.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(
                            player,
                            "anti_abuse_usable",
                            "Containers, workstations, and shelves are locked in Creative mode."
                        );
                    });
                    return;
                }

                if (item && isRestrictedCreativeItem(item.typeId)) {
                    ev.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "builder_blacklist", "This item is permanently blacklisted in Creative mode.");
                    });
                    return;
                }

                if (isDecorPlacementBlock(blockId) || blockId.includes("frame")) {
                    ev.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "anti_abuse_frame_use", "You cannot put items on Item Frames or Armor Stands.");
                    });
                    return;
                }
            }

            if (isClaimWorkstationBlock(blockId)) return;

            const isContainer = isStorageContainerBlock(blockId);

            if (isContainer) {
                if (
                    blockTesterCreativeShulkerPlaceOrOpen(player, item, block, "open") ||
                    blockTesterBoldShulkerPlaceOrOpen(player, item, block, "open")
                ) {
                    ev.cancel = true;
                    return;
                }
                if (isTesterRestrictedAt(player, block.location)) {
                    ev.cancel = true;
                    system.run(() => {
                        denyTesterCreativeOnly(
                            player,
                            "container",
                            "You cannot open containers in the 10k radius.",
                            "Use Admin Claims or enable Tester Build/Break on this claim."
                        );
                    });
                    return;
                }

                const plot = getPlotAtLocation(block.location, player.dimension.id);
                if (plot && blocksBountyContainerAccess(player, plot)) {
                    ev.cancel = true;
                    system.run(() => denyBountyContainer(player));
                    return;
                }
                if (plot && !hasPlotPermission(plot, player, "protectContainer")) {
                    ev.cancel = true;
                    system.run(() => {
                        notify(player, "claim_container", `§r§c§l[CLAIM]§r §cYou cannot open containers in ${plot.name || "this claim"}!`, "", "note.bass");
                    });
                    return;
                }
            }
        } catch (e) { }
    });
}

if (world.beforeEvents && world.beforeEvents.playerInteractWithEntity) {
    world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
        try {
            const player = event.player;
            const target = event.target;

            if (tryBlockCaptureCubeUse(player, target, event)) return;

            const targetId = target.typeId.toLowerCase();

            if (isRestrictedCreativeRole(player)) {
                const heldItem = getHeldItem(player);
                if (heldItem && isRestrictedCreativeItem(heldItem.typeId)) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "anti_abuse_use", "You cannot use this item in Creative mode.");
                    });
                    return;
                }

                if (isRestrictedEntityContainer(targetId)) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(
                            player,
                            "anti_abuse_stand",
                            "Entity inventories, stands, and frames are locked in Creative mode."
                        );
                    });
                    return;
                }
            }

            // --- TESTER: entity container restrictions in 10k ---
            if (isTesterRestrictedAt(player, player.location)) {
                const isEntityContainer = targetId === "minecraft:allay" || targetId.includes("donkey") || targetId.includes("mule") || targetId.includes("llama") || targetId.includes("minecart");

                if (isEntityContainer) {
                    event.cancel = true;
                    system.run(() => {
                        denyTesterCreativeOnly(
                            player,
                            "entity_container",
                            "You cannot open entity inventories in the 10k radius.",
                            "Survival · 10k radius"
                        );
                    });
                    return;
                }
            }
        } catch (e) { }
    });
}

if (world.beforeEvents && world.beforeEvents.entityHitEntity) {
    world.beforeEvents.entityHitEntity.subscribe((event) => {
        try {
            const player = event.damagingEntity;
            const target = event.hitEntity;
            if (!player || player.typeId !== "minecraft:player" || !target) return;
            const held = getHeldItem(player);
            if (!held || !isAnyCaptureCubeItem(held.typeId)) return;

            const blocked = isBlockedCaptureMob(target.typeId, player);
            const plot = getCaptureCubeBlockedPlot(player, target.location, target.dimension?.id || player.dimension.id);
            if (!plot && !blocked) return;

            event.cancel = true;
            if (plot) {
                toastDeny(
                    player,
                    `§cCapture cubes are disabled in ${plot.name || "this claim"}!`,
                    "capture_claim_denied"
                );
            } else {
                denyBlockedCapture(player, target);
            }
        } catch (e) { }
    });
}

if (world.beforeEvents && world.beforeEvents.playerInteractWithBlock) {
    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        try {
            const block = event.block;
            const blockId = block.typeId.toLowerCase();
            const player = event.player;

            if (isRestrictedCreativeRole(player)) {
                if (isRestrictedUsableBlock(blockId)) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(
                            player,
                            "anti_abuse_usable_interact",
                            "Containers, workstations, and shelves are locked in Creative mode."
                        );
                    });
                    return;
                }

                const heldItem = getHeldItem(player);
                if (heldItem && isRestrictedCreativeItem(heldItem.typeId)) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "anti_abuse_item", "This item is locked in Creative mode.");
                    });
                    return;
                }

                if (blockId.includes("frame") || blockId.includes("armor_stand")) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "anti_abuse_frame_use", "You cannot put items on Item Frames or Armor Stands.");
                    });
                    return;
                }
            }

            if (isClaimWorkstationBlock(blockId)) return;

            // --- TESTER: shulker open restrictions only ---
            const testerHeldItem = getHeldItem(player);
            if (
                blockTesterCreativeShulkerPlaceOrOpen(player, testerHeldItem, block, "open") ||
                blockTesterBoldShulkerPlaceOrOpen(player, testerHeldItem, block, "open")
            ) {
                event.cancel = true;
                return;
            }

            if (isBannedBerry(blockId) && (!isStaffPlayer(player) || isTester(player))) {
                event.cancel = true;
                system.run(() => {
                    notify(player, "banned_berry", "§r§c§l[SERVER]§r §cThese ore berries are completely banned!", "", "note.bass");
                });
                return;
            }

            const heldItem = getHeldItem(player);
            if (heldItem && isRestrictedCreativeRole(player)) {
                const itemId = heldItem.typeId.toLowerCase();
                if ((blockId.includes("frame") || blockId.includes("glow_frame")) && itemId.includes("ore")) {
                    event.cancel = true;
                    system.run(() => {
                        denyRestrictedCreative(player, "anti_abuse_ore", "You cannot place ores in Item Frames in Creative mode.");
                    });
                    return;
                }
            }

            const isContainer = isStorageContainerBlock(blockId);

            if (isContainer) {
                if (
                    blockTesterCreativeShulkerPlaceOrOpen(player, heldItem, block, "open") ||
                    blockTesterBoldShulkerPlaceOrOpen(player, heldItem, block, "open")
                ) {
                    event.cancel = true;
                    return;
                }
                if (isTesterRestrictedAt(player, block.location)) {
                    event.cancel = true;
                    system.run(() => {
                        denyTesterCreativeOnly(
                            player,
                            "interact",
                            "You cannot interact with containers in the 10k radius.",
                            "Use Admin Claims or enable Tester Build/Break on this claim."
                        );
                    });
                    return;
                }

                const plot = getPlotAtLocation(block.location, player.dimension.id);
                if (plot && blocksBountyContainerAccess(player, plot)) {
                    event.cancel = true;
                    system.run(() => denyBountyContainer(player));
                    return;
                }
                if (plot && !hasPlotPermission(plot, player, "protectContainer")) {
                    event.cancel = true;
                    system.run(() => {
                        notify(player, "claim_container", `§r§c§l[CLAIM]§r §cYou cannot open containers in ${plot.name || "this claim"}!`, "", "note.bass");
                    });
                }
            }
        } catch (e) { }
    });
}

if (world.beforeEvents?.playerDropItem) {
    world.beforeEvents.playerDropItem.subscribe((event) => {
        const player = event.source;
        if (!player || player.typeId !== "minecraft:player") return;
        syncCreativeRoleTag(player);
        if (!shouldBlockCreativeRoleDrop(player)) return;
        if (isRainGuiItem(event.itemStack)) return;

        event.cancel = true;
        system.run(() => {
            if (event.itemStack) {
                stashItemStackToBuilderVault(player, event.itemStack);
            }
            denyRestrictedCreative(player, "anti_abuse_drop", "Dropped items are stored in your builder vault.");
        });
    });
}

function vacuumCreativeBuilderDropEntity(ent, attempt = 0) {
    if (!ent?.isValid || ent.typeId !== "minecraft:item") return;

    const stack = ent.getComponent("item")?.itemStack ?? ent.getComponent("minecraft:item")?.itemStack;
    if (!stack) {
        if (attempt < 5) {
            system.runTimeout(() => vacuumCreativeBuilderDropEntity(ent, attempt + 1), 2);
        }
        return;
    }

    if (isRainGuiItem(stack)) {
        ent.kill();
        return;
    }

    try {
        const closePlayers = ent.dimension.getPlayers({ location: ent.location, maxDistance: 5 });
        for (const player of closePlayers) {
            syncCreativeRoleTag(player);
            if (!shouldBlockCreativeRoleDrop(player)) continue;
            if (isInTotemLimiterDropGrace(player)) continue;

            const isBuilder = isCreativeBuilderTagged(player);
            if (isBuilder) {
                ent.kill();
                system.run(() => {
                    denyRestrictedCreative(
                        player,
                        "anti_abuse_drop_vault",
                        "Dropped items are removed in Creative mode."
                    );
                });
                return;
            }
        }
    } catch (e) { }
}

if (world.afterEvents?.entitySpawn) {
    world.afterEvents.entitySpawn.subscribe((event) => {
        const entity = event.entity;
        if (!entity) return;

        if (entity.typeId === "minecraft:item") {
            if (!restrictedCreativeOnline) return;
            system.run(() => vacuumCreativeBuilderDropEntity(entity));
            return;
        }

        // Staff testing bypass: if a blocked capture mob (warden, wither, etc.) is spawned
        // near a staff member (ignoring tester tag), tag it so prison cleanup doesn't kill it.
        if (BLOCKED_CAPTURE_MOBS.has(entity.typeId)) {
            try {
                const nearbyStaff = entity.dimension.getPlayers({
                    location: entity.location,
                    maxDistance: 24,
                }).some((p) => p.hasTag("staff") && !isRestrictedCreativeRole(p));
                if (nearbyStaff && entity?.isValid) {
                    entity.addTag("staff_exempt");
                    if (entity.typeId === "minecraft:wither") {
                        // Peaceful difficulty or external cleanup can delete withers right after
                        // the birth explosion. Staff-spawned test withers should behave normally.
                        system.run(() => {
                            try { entity.dimension.runCommandAsync("difficulty normal"); } catch (e) {}
                        });
                    }
                }
            } catch (e) {}
        }

        if (!restrictedCreativeOnline) return;

        try {
            const nearby = entity.dimension.getPlayers({
                location: entity.location,
                maxDistance: 8,
            });

            for (const player of nearby) {
                if (!isRestrictedCreativeRole(player)) continue;

                if (isRestrictedDecorEntity(entity.typeId)) {
                    entity.kill();
                    system.run(() => {
                        denyRestrictedCreative(
                            player,
                            "anti_abuse_decor_spawn",
                            "Item Frames and Armor Stands are locked in Creative mode."
                        );
                    });
                    return;
                }
            }
        } catch (e) {}
    });
}

// --- INVENTORY PRESERVATION SYSTEM ---
const savedInventories = new Map();
const testerSavedInventories = new Map(); 

function clearArenaTags(player) {
    if (!player) return;
    player.removeTag("in_arena");
    player.removeTag("arena_pvp");
    player.removeTag("arena_player_1");
    player.removeTag("arena_player_2");
}

function clearSpleefTags(player) {
    if (!player) return;
    player.removeTag("in_spleef");
    player.removeTag("spleef_p1");
    player.removeTag("spleef_p2");
    player.removeTag("spleef_p3");
    player.removeTag("spleef_p4");
}

function clearMinigameTags(player) {
    clearArenaTags(player);
    clearSpleefTags(player);
}

function cloneEquipmentItem(item) {
    if (!item || isRainGuiItem(item)) return undefined;
    return item.clone();
}

function saveAndClearInventory(player, type) {
    const invComp = player.getComponent("inventory");
    const eqComp = player.getComponent("equippable");
    const container = invComp.container;

    const savedData = { inventory: [], equipment: {} };

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (isRainGuiItem(item)) continue;
        savedData.inventory[i] = item?.clone();
    }

    savedData.equipment[EquipmentSlot.Head] = cloneEquipmentItem(eqComp.getEquipment(EquipmentSlot.Head));
    savedData.equipment[EquipmentSlot.Chest] = cloneEquipmentItem(eqComp.getEquipment(EquipmentSlot.Chest));
    savedData.equipment[EquipmentSlot.Legs] = cloneEquipmentItem(eqComp.getEquipment(EquipmentSlot.Legs));
    savedData.equipment[EquipmentSlot.Feet] = cloneEquipmentItem(eqComp.getEquipment(EquipmentSlot.Feet));
    savedData.equipment[EquipmentSlot.Offhand] = cloneEquipmentItem(eqComp.getEquipment(EquipmentSlot.Offhand));

    savedInventories.set(player.id, savedData);

    container.clearAll();
    eqComp.setEquipment(EquipmentSlot.Head, undefined);
    eqComp.setEquipment(EquipmentSlot.Chest, undefined);
    eqComp.setEquipment(EquipmentSlot.Legs, undefined);
    eqComp.setEquipment(EquipmentSlot.Feet, undefined);
    eqComp.setEquipment(EquipmentSlot.Offhand, undefined);

    stripRainGuiForGravestone(player);
    player.addTag(type);
}

/** Restore saved survival items only — never puts the Rain GUI back from the snapshot. */
function restoreInventory(player) {
    if (!savedInventories.has(player.id)) return;

    const savedData = savedInventories.get(player.id);
    const invComp = player.getComponent("inventory");
    const eqComp = player.getComponent("equippable");
    const container = invComp.container;

    // Unlock minigame kit items first to prevent 'Item is locked' crashes when clearing.
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) {
            item.lockMode = ItemLockMode.none;
            container.setItem(i, item);
        }
    }

    const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
    for (const slot of slots) {
        const eqItem = eqComp.getEquipment(slot);
        if (eqItem) {
            eqItem.lockMode = ItemLockMode.none;
            eqComp.setEquipment(slot, eqItem);
        }
    }

    container.clearAll();

    for (let i = 0; i < container.size; i++) {
        const item = savedData.inventory[i];
        if (!item || isRainGuiItem(item)) continue;
        container.setItem(i, item);
    }

    for (const slot of slots) {
        const item = savedData.equipment[slot];
        eqComp.setEquipment(slot, isRainGuiItem(item) ? undefined : item);
    }

    stripRainGuiForGravestone(player);
    savedInventories.delete(player.id);
}

/** After arena/spleef ends: clear tags, restore items, then give one Rain GUI if eligible. */
function restoreMinigameInventory(player) {
    if (!player) return;

    clearMinigameTags(player);
    restoreInventory(player);
    stripRainGuiForGravestone(player);
    ensureRainGuiItem(player);
}

function saveTesterInventory(player) {
    const invComp = player.getComponent("inventory");
    const eqComp = player.getComponent("equippable");
    const container = invComp.container;

    const savedData = { inventory: [], equipment: {} };
    for (let i = 0; i < container.size; i++) {
        savedData.inventory[i] = container.getItem(i)?.clone();
    }

    savedData.equipment[EquipmentSlot.Head] = eqComp.getEquipment(EquipmentSlot.Head)?.clone();
    savedData.equipment[EquipmentSlot.Chest] = eqComp.getEquipment(EquipmentSlot.Chest)?.clone();
    savedData.equipment[EquipmentSlot.Legs] = eqComp.getEquipment(EquipmentSlot.Legs)?.clone();
    savedData.equipment[EquipmentSlot.Feet] = eqComp.getEquipment(EquipmentSlot.Feet)?.clone();
    savedData.equipment[EquipmentSlot.Offhand] = eqComp.getEquipment(EquipmentSlot.Offhand)?.clone();

    testerSavedInventories.set(player.id, savedData);

    container.clearAll();
    eqComp.setEquipment(EquipmentSlot.Head, undefined);
    eqComp.setEquipment(EquipmentSlot.Chest, undefined);
    eqComp.setEquipment(EquipmentSlot.Legs, undefined);
    eqComp.setEquipment(EquipmentSlot.Feet, undefined);
    eqComp.setEquipment(EquipmentSlot.Offhand, undefined);
}

function restoreTesterInventory(player) {
    if (!testerSavedInventories.has(player.id)) return;
    const savedData = testerSavedInventories.get(player.id);
    const invComp = player.getComponent("inventory");
    const eqComp = player.getComponent("equippable");
    const container = invComp.container;

    container.clearAll();

    for (let i = 0; i < container.size; i++) {
        if (savedData.inventory[i]) {
            container.setItem(i, savedData.inventory[i]);
        }
    }

    eqComp.setEquipment(EquipmentSlot.Head, savedData.equipment[EquipmentSlot.Head]);
    eqComp.setEquipment(EquipmentSlot.Chest, savedData.equipment[EquipmentSlot.Chest]);
    eqComp.setEquipment(EquipmentSlot.Legs, savedData.equipment[EquipmentSlot.Legs]);
    eqComp.setEquipment(EquipmentSlot.Feet, savedData.equipment[EquipmentSlot.Feet]);
    eqComp.setEquipment(EquipmentSlot.Offhand, savedData.equipment[EquipmentSlot.Offhand]);

    testerSavedInventories.delete(player.id);
}

// --- CREATIVE BUILDER VAULT ---
const VAULT_X = 1200;
const VAULT_Y = 250;
const BUILDER_VAULT_ACTIVE_DP = "builder_vault_active";

system.runTimeout(() => ensureVaultTickingArea(), 40);

function getBuilderVaultDimension() {
    try {
        return world.getDimension("overworld");
    } catch (e) {
        return null;
    }
}

function resolveBuilderVaultZ(player) {
    let vz = player.getDynamicProperty("builder_vault_z");

    if (vz === undefined || vz > 140) {
        vz = world.getDynamicProperty("next_builder_vault_z") ?? 100;
        if (vz > 140) vz = 100;
        world.setDynamicProperty("next_builder_vault_z", vz + 2);
        player.setDynamicProperty("builder_vault_z", vz);
    }

    return vz;
}

function getBuilderVaultContainers(vz, dim = getBuilderVaultDimension()) {
    if (!dim) return null;

    let b1 = dim.getBlock({ x: VAULT_X, y: VAULT_Y, z: vz });
    let b2 = dim.getBlock({ x: VAULT_X, y: VAULT_Y, z: vz + 1 });
    if (!b1 || !b2) return null;

    if (b1.typeId !== "minecraft:barrel") b1.setType("minecraft:barrel");
    if (b2.typeId !== "minecraft:barrel") b2.setType("minecraft:barrel");

    const vComp1 = b1.getComponent("inventory") || b1.getComponent("minecraft:inventory");
    const vComp2 = b2.getComponent("inventory") || b2.getComponent("minecraft:inventory");
    if (!vComp1?.container || !vComp2?.container) return null;

    return { vInv1: vComp1.container, vInv2: vComp2.container };
}

function builderHasStashableItems(player) {
    const invComp = player.getComponent("inventory") || player.getComponent("minecraft:inventory");
    const eqComp = player.getComponent("equippable") || player.getComponent("minecraft:equippable");
    const container = invComp?.container;
    if (!container && !eqComp) return false;

    if (container) {
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && !isRainGuiItem(item)) return true;
        }
    }

    if (eqComp) {
        const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
        for (const slot of slots) {
            if (eqComp.getEquipment(slot)) return true;
        }
    }

    return false;
}

function stashItemStackToBuilderVault(player, itemStack) {
    if (!player || !itemStack || isRainGuiItem(itemStack)) return false;

    const vz = resolveBuilderVaultZ(player);
    ensureVaultTickingArea();

    system.run(() => {
        try {
            const vault = getBuilderVaultContainers(vz);
            if (!vault) return;

            let leftover = vault.vInv1.addItem(itemStack.clone());
            if (leftover) vault.vInv2.addItem(leftover);
            player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, true);
        } catch (e) { }
    });

    return true;
}

function executeVaultSwap(player, isStoring, vz, dim) {
    const finishWithMemoryFallback = () => {
        if (isStoring) {
            if (builderHasStashableItems(player) && !builderSavedInventories.has(player.id)) {
                saveBuilderInventory(player);
                player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, true);
            }
            return;
        }
        if (builderSavedInventories.has(player.id)) {
            restoreBuilderInventory(player);
            player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, undefined);
        }
    };

    const runSwapAtVault = () => {
        try {
            let b1 = dim.getBlock({ x: VAULT_X, y: VAULT_Y, z: vz });
            let b2 = dim.getBlock({ x: VAULT_X, y: VAULT_Y, z: vz + 1 });

            if (!b1 || !b2) {
                finishWithMemoryFallback();
                return;
            }

            if (b1.typeId !== "minecraft:barrel") b1.setType("minecraft:barrel");
            if (b2.typeId !== "minecraft:barrel") b2.setType("minecraft:barrel");

            const vComp1 = b1.getComponent("inventory") || b1.getComponent("minecraft:inventory");
            const vComp2 = b2.getComponent("inventory") || b2.getComponent("minecraft:inventory");

            if (!vComp1 || !vComp2) {
                finishWithMemoryFallback();
                return;
            }

            performActualSwap(player, isStoring, vComp1, vComp2);
        } catch (e) {
            finishWithMemoryFallback();
            notify(player, "vault_crash", `§r§c§l[ERROR]§r §cVault error — used memory backup.`, "", "note.bass");
        }
    };

    if (isChunkColumnLoaded(dim, VAULT_X, vz)) {
        runSwapAtVault();
        return;
    }

    const originalLoc = { ...player.location };
    const originalDim = player.dimension;

    preloadChunkThen(
        player,
        dim,
        VAULT_X,
        vz,
        () => {
            runSwapAtVault();
            try {
                if (player.isValid) player.teleport(originalLoc, { dimension: originalDim });
            } catch (e) { }
        },
        () => {
            finishWithMemoryFallback();
            try {
                if (player.isValid) player.teleport(originalLoc, { dimension: originalDim });
            } catch (e) { }
            notify(
                player,
                "vault_memory",
                "§r§e§l[BUILDER]§r §eVault chunk slow — used memory stash instead.",
                "",
                "random.orb"
            );
        }
    );
}

function performActualSwap(player, isStoring, vComp1, vComp2) {
    const vInv1 = vComp1.container;
    const vInv2 = vComp2.container;
    const pInvComp = player.getComponent("inventory") || player.getComponent("minecraft:inventory");
    const pEqComp = player.getComponent("equippable") || player.getComponent("minecraft:equippable");
    const pInv = pInvComp.container;
    const pEq = pEqComp;

    if (isStoring) {
        vInv1.clearAll(); vInv2.clearAll();
        for (let i = 0; i < pInv.size; i++) {
            const itm = pInv.getItem(i);
            if (itm) {
                if (vInv1.emptySlotsCount > 0) vInv1.addItem(itm);
                else vInv2.addItem(itm);
                pInv.setItem(i, undefined);
            }
        }
        const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
        for (const slot of slots) {
            const itm = pEq.getEquipment(slot);
            if (itm) { vInv1.addItem(itm); pEq.setEquipment(slot, undefined); }
        }
        ensureRainGuiItem(player);
        player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, true);
        notify(player, "vault_stashed", "§r§e§l[BUILDER]§r §eSurvival items stashed safely.", "", "armor.equip_iron");
    } else {
        builderSavedInventories.delete(player.id);
        pInv.clearAll();
        const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand];
        for (const s of slots) pEq.setEquipment(s, undefined);

        const restore = (v) => {
            for (let i = 0; i < v.size; i++) {
                const itm = v.getItem(i);
                if (itm) { pInv.addItem(itm); v.setItem(i, undefined); }
            }
        };
        restore(vInv1); restore(vInv2);
        ensureRainGuiItem(player);
        player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, undefined);
        notify(player, "vault_restored", "§r§a§l[BUILDER]§r §aSurvival items restored.", "", "random.levelup");
    }
}

function handleVault(player, isStoring) {
    const dim = getBuilderVaultDimension();
    if (!dim) return;

    const vz = resolveBuilderVaultZ(player);
    ensureVaultTickingArea();

    system.runTimeout(() => {
        executeVaultSwap(player, isStoring, vz, dim);
    }, 10);
}

// --- GAMEMODE TRACKING (Builders & Testers) ---
const builderSavedInventories = new Map();
const builderStashLastAttempt = new Map();
const BUILDER_STASH_COOLDOWN_MS = 3000;

function saveBuilderInventory(player) {
    if (builderSavedInventories.has(player.id)) return true;
    if (!builderHasStashableItems(player)) return false;

    const invComp = player.getComponent("inventory") || player.getComponent("minecraft:inventory");
    const eqComp = player.getComponent("equippable") || player.getComponent("minecraft:equippable");
    if (!invComp?.container || !eqComp) return false;

    const container = invComp.container;
    const savedData = { inventory: [], equipment: {} };

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (isRainGuiItem(item)) continue;
        savedData.inventory[i] = item?.clone();
    }

    savedData.equipment[EquipmentSlot.Head] = eqComp.getEquipment(EquipmentSlot.Head)?.clone();
    savedData.equipment[EquipmentSlot.Chest] = eqComp.getEquipment(EquipmentSlot.Chest)?.clone();
    savedData.equipment[EquipmentSlot.Legs] = eqComp.getEquipment(EquipmentSlot.Legs)?.clone();
    savedData.equipment[EquipmentSlot.Feet] = eqComp.getEquipment(EquipmentSlot.Feet)?.clone();
    savedData.equipment[EquipmentSlot.Offhand] = eqComp.getEquipment(EquipmentSlot.Offhand)?.clone();

    builderSavedInventories.set(player.id, savedData);

    container.clearAll();
    eqComp.setEquipment(EquipmentSlot.Head, undefined);
    eqComp.setEquipment(EquipmentSlot.Chest, undefined);
    eqComp.setEquipment(EquipmentSlot.Legs, undefined);
    eqComp.setEquipment(EquipmentSlot.Feet, undefined);
    eqComp.setEquipment(EquipmentSlot.Offhand, undefined);

    ensureRainGuiItem(player);
    notify(player, "vault_stashed", "§r§e§l[BUILDER]§r §eSurvival items stashed safely.", "", "armor.equip_iron");
    return true;
}

function restoreBuilderInventory(player) {
    if (!builderSavedInventories.has(player.id)) return;

    const savedData = builderSavedInventories.get(player.id);
    const invComp = player.getComponent("inventory") || player.getComponent("minecraft:inventory");
    const eqComp = player.getComponent("equippable") || player.getComponent("minecraft:equippable");
    if (!invComp?.container || !eqComp) return;

    const container = invComp.container;
    container.clearAll();

    for (let i = 0; i < container.size; i++) {
        const item = savedData.inventory[i];
        if (!item || isRainGuiItem(item)) continue;
        container.setItem(i, item);
    }

    eqComp.setEquipment(EquipmentSlot.Head, savedData.equipment[EquipmentSlot.Head]);
    eqComp.setEquipment(EquipmentSlot.Chest, savedData.equipment[EquipmentSlot.Chest]);
    eqComp.setEquipment(EquipmentSlot.Legs, savedData.equipment[EquipmentSlot.Legs]);
    eqComp.setEquipment(EquipmentSlot.Feet, savedData.equipment[EquipmentSlot.Feet]);
    eqComp.setEquipment(EquipmentSlot.Offhand, savedData.equipment[EquipmentSlot.Offhand]);

    builderSavedInventories.delete(player.id);
    ensureRainGuiItem(player);
    notify(player, "vault_restored", "§r§a§l[BUILDER]§r §aSurvival items restored.", "", "random.levelup");
}

function isCreativeBuilderRole(player) {
    return isCreativeBuilderTagged(player);
}

function builderSessionActive(player) {
    return !!player?.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP) || builderSavedInventories.has(player?.id);
}

function purgeBuilderCreativeInventory(player) {
    /** Wipe creative-menu blocks when leaving builder mode — not while actively building. */
    if (!isCreativeBuilderRole(player)) return;

    const plotClaiming = player.hasTag("plot_making");
    const invComp = player.getComponent("inventory") || player.getComponent("minecraft:inventory");
    const eqComp = player.getComponent("equippable") || player.getComponent("minecraft:equippable");
    const container = invComp?.container;
    if (!container && !eqComp) return;

    if (container) {
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item || isRainGuiItem(item)) continue;
            if (plotClaiming && item.typeId === "minecraft:wooden_axe") continue;
            container.setItem(i, undefined);
        }
    }

    if (eqComp) {
        for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]) {
            if (eqComp.getEquipment(slot)) eqComp.setEquipment(slot, undefined);
        }
    }

    ensureRainGuiItem(player);

    if (plotClaiming) ensurePlotClaimWand(player);
}

function clearBuilderVaultBarrels(player) {
    const vz = player?.getDynamicProperty?.("builder_vault_z");
    if (vz === undefined) return;

    const dim = getBuilderVaultDimension();
    if (!dim) return;

    try {
        const vault = getBuilderVaultContainers(vz, dim);
        if (!vault) return;
        vault.vInv1.clearAll();
        vault.vInv2.clearAll();
    } catch (e) { }
}

function builderInventoryStashed(player) {
    return builderSavedInventories.has(player?.id);
}

function builderNeedsInventoryStash(player) {
    if (!isCreativeBuilderRole(player)) return false;
    if (builderInventoryStashed(player)) return false;
    return builderHasStashableItems(player);
}

function builderNeedsCreativeSession(player) {
    if (!isCreativeBuilderRole(player)) return false;
    if (builderSessionActive(player)) return false;
    return isCreativeBuilderInCreative(player);
}

function clearStaleBuilderSession(player) {
    if (!isCreativeBuilderRole(player)) return;
    if (builderInventoryStashed(player)) return;
    if (!player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP)) return;

    if (isCreativeBuilderInCreative(player)) return;

    player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, undefined);
    setCreativeRoleTag(player, false);
    rememberPlayerGamemode(player, "survival");
    builderStashLastAttempt.delete(player.id);
}

function builderNeedsStash(player) {
    if (!player?.id) return false;
    if (builderSavedInventories.has(player.id)) return false;
    if (player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP)) return false;
    return builderHasStashableItems(player);
}

function syncMemoryToBarrels(player) {
    if (!player?.isValid) return;

    const saved = builderSavedInventories.get(player.id);
    if (!saved) return;

    ensureVaultTickingArea();
    const vz = resolveBuilderVaultZ(player);
    const dim = getBuilderVaultDimension();
    if (!dim) return;

    const pushToVault = () => {
        const vault = getBuilderVaultContainers(vz, dim);
        if (!vault) return false;

        vault.vInv1.clearAll();
        vault.vInv2.clearAll();

        const addItem = (item) => {
            if (!item || isRainGuiItem(item)) return;
            try {
                const stack = item.clone ? item.clone() : item;
                let leftover = vault.vInv1.addItem(stack);
                if (leftover) vault.vInv2.addItem(leftover);
            } catch (e) { }
        };

        for (const item of saved.inventory) addItem(item);
        addItem(saved.equipment[EquipmentSlot.Head]);
        addItem(saved.equipment[EquipmentSlot.Chest]);
        addItem(saved.equipment[EquipmentSlot.Legs]);
        addItem(saved.equipment[EquipmentSlot.Feet]);
        addItem(saved.equipment[EquipmentSlot.Offhand]);
        return true;
    };

    if (isChunkColumnLoaded(dim, VAULT_X, vz)) {
        pushToVault();
        return;
    }

    system.runTimeout(() => pushToVault(), 25);
}

function stashBuilderForCreative(player) {
    if (!isCreativeBuilderRole(player)) return false;
    if (!isCreativeBuilderInCreative(player)) return false;

    if (builderNeedsInventoryStash(player)) {
        const now = Date.now();
        const last = builderStashLastAttempt.get(player.id) || 0;
        if (now - last >= BUILDER_STASH_COOLDOWN_MS) {
            builderStashLastAttempt.set(player.id, now);
            if (saveBuilderInventory(player)) {
                system.runTimeout(() => syncMemoryToBarrels(player), 5);
            }
        }
    } else {
        builderStashLastAttempt.delete(player.id);
    }

    player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, true);
    rememberPlayerGamemode(player, "creative");
    setCreativeRoleTag(player, true);
    return true;
}

function restoreBuilderForSurvival(player) {
    if (!isCreativeBuilderRole(player)) return;

    purgeBuilderCreativeInventory(player);
    clearBuilderVaultBarrels(player);

    if (builderSavedInventories.has(player.id)) {
        restoreBuilderInventory(player);
    } else if (player.getDynamicProperty(BUILDER_VAULT_ACTIVE_DP)) {
        handleVault(player, false);
    }

    player.setDynamicProperty(BUILDER_VAULT_ACTIVE_DP, undefined);
    setCreativeRoleTag(player, false);
    rememberPlayerGamemode(player, "survival");
    builderStashLastAttempt.delete(player.id);
}

function applyBuilderTesterGamemodeChange(player, fromMode, toMode) {
    if (isWorldBuilderRole(player)) return;

    const _isTester = isTester(player);
    const isBuilder = isCreativeBuilderRole(player);
    if (!isBuilder && !_isTester) return;

    if (toMode === "creative") {
        if (isBuilder) {
            stashBuilderForCreative(player);
        }
        if (_isTester && !testerSavedInventories.has(player.id)) {
            saveTesterInventory(player);
            testerNotify(
                player,
                "tester_inv_saved",
                "Survival inventory saved. Creative mode engaged.",
                "Your survival gear is stored safely.",
                "random.levelup",
                "success"
            );
        }
    } else if (toMode === "survival") {
        if (isBuilder && (fromMode === "creative" || builderSessionActive(player) || player.hasTag("rain_creative_role"))) {
            restoreBuilderForSurvival(player);
        }
        if (_isTester && testerSavedInventories.has(player.id)) {
            restoreTesterInventory(player);
            testerNotify(
                player,
                "tester_inv_restored",
                "Survival inventory restored. Creative items wiped.",
                "You are back in Survival mode.",
                "random.levelup",
                "success"
            );
        }
    }

    if (toMode && toMode !== "unknown") {
        rememberPlayerGamemode(player, toMode);
        setCreativeRoleTag(player, toMode === "creative");
    }
}

function tickGamemodeTracking(players) {
    for (const player of players) {
        if (isWorldBuilderRole(player)) continue;

        const _isTester = isTester(player);
        const isBuilder = isCreativeBuilderRole(player);
        if (!isBuilder && !_isTester) continue;

        if (isBuilder) {
            clearStaleBuilderSession(player);
            stripWorldBuilderItems(player);

            if (isCreativeBuilderInCreative(player)) {
                if (builderNeedsInventoryStash(player) || !builderSessionActive(player)) {
                    stashBuilderForCreative(player);
                } else {
                    rememberPlayerGamemode(player, "creative");
                    setCreativeRoleTag(player, true);
                }
            }
        }

        let direct = null;
        try {
            const raw = player.getGameMode?.() ?? player.gameMode;
            direct = gamemodeEnumToKey(raw);
        } catch (e) { }

        syncCreativeRoleTag(player);

        const lastMode = getRememberedGamemode(player);
        const vaultActive = isBuilder && builderSessionActive(player);

        if (isBuilder) {
            if (isCreativeBuilderInCreative(player)) {
                if (lastMode !== "creative") {
                    applyBuilderTesterGamemodeChange(player, lastMode ?? "survival", "creative");
                } else {
                    rememberPlayerGamemode(player, "creative");
                }
                continue;
            }
            if (vaultActive) continue;
        }

        if (!direct) continue;

        if (direct === "creative" && _isTester) {
            if (lastMode !== "creative") {
                applyBuilderTesterGamemodeChange(player, lastMode ?? "survival", "creative");
            } else {
                rememberPlayerGamemode(player, "creative");
            }
            continue;
        }

        if (vaultActive) continue;

        if (lastMode !== direct) {
            applyBuilderTesterGamemodeChange(player, lastMode ?? "survival", direct);
        } else {
            rememberPlayerGamemode(player, direct);
        }
    }
}

setBuilderTesterGamemodeHandler(applyBuilderTesterGamemodeChange);

if (world.afterEvents?.playerGameModeChange) {
    world.afterEvents.playerGameModeChange.subscribe((event) => {
        const player = event.player;
        if (!player || !isBuilderOrTester(player)) return;

        const fromMode =
            gamemodeEnumToKey(event.fromGameMode) ||
            getRememberedGamemode(player) ||
            "survival";
        const toMode = gamemodeEnumToKey(event.toGameMode);
        if (!fromMode || !toMode || fromMode === toMode || toMode === "unknown") return;

        rememberPlayerGamemode(player, toMode);
        setCreativeRoleTag(player, toMode === "creative");

        system.run(() => {
            applyBuilderTesterGamemodeChange(player, fromMode, toMode);
        });
    });
}

// --- MINIGAMES ---
const BUTTON_PLAYER_1 = { x: 1215, y: 72, z: 74 };
const BUTTON_PLAYER_2 = { x: 1211, y: 72, z: 74 };
const ARENA_SPAWN_1 = { x: 1213, y: 71, z: 77 };
const ARENA_SPAWN_2 = { x: 1213, y: 71, z: 99 };
const FRONT_OF_ARENA = { x: 1213, y: 72, z: 70 };

const SPLEEF_BTN_1 = { x: 1214, y: 59, z: 68 };
const SPLEEF_BTN_2 = { x: 1213, y: 59, z: 68 };
const SPLEEF_BTN_3 = { x: 1212, y: 59, z: 68 };
const SPLEEF_BTN_4 = { x: 1211, y: 59, z: 68 };
const SPLEEF_RESET_BTN = { x: 1207, y: 59, z: 68 };
const SPLEEF_SPAWN_1 = { x: 1226, y: 66, z: 61 };
const SPLEEF_SPAWN_2 = { x: 1200, y: 66, z: 61 };
const SPLEEF_SPAWN_3 = { x: 1200, y: 66, z: 35 };
const SPLEEF_SPAWN_4 = { x: 1226, y: 66, z: 35 };
const SPLEEF_EXIT_POS = { x: 1212, y: 58, z: 64 };
const FLOOR_CORNER_1 = { x: 1226, y: 65, z: 35 };
const FLOOR_CORNER_2 = { x: 1200, y: 65, z: 61 };

const arenaWaitTime = new Map();
const spleefWaitTime = new Map();
const arenaWaitWarning = new Set();
const spleefWaitWarning = new Set();

function isArenaMinigamePlayer(player) {
    return player?.hasTag("in_arena") || player?.hasTag("arena_player_1") || player?.hasTag("arena_player_2");
}

function isSpleefMinigamePlayer(player) {
    return (
        player?.hasTag("in_spleef") ||
        player?.hasTag("spleef_p1") ||
        player?.hasTag("spleef_p2") ||
        player?.hasTag("spleef_p3") ||
        player?.hasTag("spleef_p4")
    );
}

function isSpleefBreakableBlock(blockId) {
    const id = String(blockId || "").toLowerCase();
    return id === "minecraft:snow" || id === "minecraft:snow_layer" || id.includes("snow");
}

function makeLockedKitItem(id, amount = 1) {
    const item = new ItemStack(id, amount);
    item.keepOnDeath = true;
    item.lockMode = ItemLockMode.slot;
    return item;
}

function equipLockedArmor(playerEq, slot, item) {
    playerEq.setEquipment(slot, item);
    try {
        const slotRef = playerEq.getEquipmentSlot(slot);
        slotRef.lockMode = ItemLockMode.slot;
        slotRef.setItem(item);
    } catch (e) {}
}

function giveArenaKit(player) {
    const playerEq = player.getComponent("equippable");
    const playerInv = player.getComponent("inventory")?.container;
    if (!playerEq) return;

    equipLockedArmor(playerEq, EquipmentSlot.Head, makeLockedKitItem("minecraft:diamond_helmet"));
    equipLockedArmor(playerEq, EquipmentSlot.Chest, makeLockedKitItem("minecraft:diamond_chestplate"));
    equipLockedArmor(playerEq, EquipmentSlot.Legs, makeLockedKitItem("minecraft:diamond_leggings"));
    equipLockedArmor(playerEq, EquipmentSlot.Feet, makeLockedKitItem("minecraft:diamond_boots"));

    if (playerInv) {
        playerInv.setItem(0, makeLockedKitItem("minecraft:diamond_sword"));
        playerInv.setItem(1, makeLockedKitItem("minecraft:cooked_beef", 64));
    }
}

function giveSpleefKit(player) {
    try {
        player.runCommand('give @s diamond_shovel 1 0 {"minecraft:can_destroy":{"blocks":["snow"]},"minecraft:item_lock":{"mode":"lock_in_inventory"},"minecraft:keep_on_death":{}}');
    } catch (e) {
        const playerInv = player.getComponent("inventory").container;
        const shovel = new ItemStack("minecraft:diamond_shovel", 1);
        shovel.keepOnDeath = true;
        shovel.lockMode = ItemLockMode.slot;
        playerInv.addItem(shovel);
    }
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    const block = event.block;
    const player = event.player;
    if (!block.typeId.includes("button")) return;

    if (block.location.x === BUTTON_PLAYER_1.x && block.location.y === BUTTON_PLAYER_1.y && block.location.z === BUTTON_PLAYER_1.z) {
        if (player.hasTag("in_arena") || player.hasTag("in_spleef")) return;
        if (world.getPlayers({ tags: ["arena_player_1"] }).length > 0) {
            notify(player, "arena_p1_taken", "§r§c§l[ARENA]§r §cPlayer 1's spot is currently taken!", "", "note.bass"); return;
        }
        notify(player, "arena_p1_join", "§r§e§l[ARENA]§r §eStoring items securely... You are Player 1!", "", "armor.equip_diamond");
        saveAndClearInventory(player, "in_arena");
        player.addTag("arena_player_1");
        player.addTag("arena_pvp");
        giveArenaKit(player);
        player.teleport(ARENA_SPAWN_1, { dimension: world.getDimension("overworld") });
        notify(player, "arena_pvp_on", "§r§c§l[ARENA]§r §aPvP enabled — fight when both players are in!", "", "random.bowhit");
        return;
    }

    if (block.location.x === BUTTON_PLAYER_2.x && block.location.y === BUTTON_PLAYER_2.y && block.location.z === BUTTON_PLAYER_2.z) {
        if (player.hasTag("in_arena") || player.hasTag("in_spleef")) return;
        if (world.getPlayers({ tags: ["arena_player_2"] }).length > 0) {
            notify(player, "arena_p2_taken", "§r§c§l[ARENA]§r §cPlayer 2's spot is currently taken!", "", "note.bass"); return;
        }
        notify(player, "arena_p2_join", "§r§e§l[ARENA]§r §eStoring items securely... You are Player 2!", "", "armor.equip_diamond");
        saveAndClearInventory(player, "in_arena");
        player.addTag("arena_player_2");
        player.addTag("arena_pvp");
        giveArenaKit(player);
        player.teleport(ARENA_SPAWN_2, { dimension: world.getDimension("overworld") });
        notify(player, "arena_pvp_on", "§r§c§l[ARENA]§r §aPvP enabled — fight when both players are in!", "", "random.bowhit");
        return;
    }

    const spleefButtons = [
        { loc: SPLEEF_BTN_1, tag: "spleef_p1", spawn: SPLEEF_SPAWN_1, name: "Player 1" },
        { loc: SPLEEF_BTN_2, tag: "spleef_p2", spawn: SPLEEF_SPAWN_2, name: "Player 2" },
        { loc: SPLEEF_BTN_3, tag: "spleef_p3", spawn: SPLEEF_SPAWN_3, name: "Player 3" },
        { loc: SPLEEF_BTN_4, tag: "spleef_p4", spawn: SPLEEF_SPAWN_4, name: "Player 4" }
    ];

    for (const btn of spleefButtons) {
        if (block.location.x === btn.loc.x && block.location.y === btn.loc.y && block.location.z === btn.loc.z) {
            if (player.hasTag("in_spleef") || player.hasTag("in_arena")) return;
            if (world.getPlayers({ tags: [btn.tag] }).length > 0) {
                notify(player, "spleef_spot_taken", `§r§c§l[SPLEEF]§r §c${btn.name}'s spot is taken!`, "", "note.bass"); return;
            }
            notify(player, "spleef_join", `§r§b§l[SPLEEF]§r §bStoring items... You are ${btn.name}!`, "", "armor.equip_diamond");
            saveAndClearInventory(player, "in_spleef");
            player.addTag(btn.tag);
            giveSpleefKit(player);
            player.teleport(btn.spawn, { dimension: world.getDimension("overworld") });
            notify(player, "spleef_break_on", "§r§b§l[SPLEEF]§r §aYou can break snow blocks in the arena!", "", "random.toast");
            return;
        }
    }

    if (block.location.x === SPLEEF_RESET_BTN.x && block.location.y === SPLEEF_RESET_BTN.y && block.location.z === SPLEEF_RESET_BTN.z) {
        notify(player, "spleef_reset", "§r§a§l[SPLEEF]§r §aResetting Arena...", "", "random.levelup");

        for (const p of world.getPlayers({ tags: ["in_spleef"] })) {
            restoreMinigameInventory(p);
            p.teleport(SPLEEF_EXIT_POS, { dimension: world.getDimension("overworld") });
            notify(p, "spleef_reset_restore", "§r§e§l[SPLEEF]§r §eThe arena was reset. Your items are restored!");
        }

        system.run(() => {
            try {
                const dim = world.getDimension("overworld");
                const minX = Math.min(FLOOR_CORNER_1.x, FLOOR_CORNER_2.x);
                const maxX = Math.max(FLOOR_CORNER_1.x, FLOOR_CORNER_2.x);
                const minY = Math.min(FLOOR_CORNER_1.y, FLOOR_CORNER_2.y);
                const maxY = Math.max(FLOOR_CORNER_1.y, FLOOR_CORNER_2.y);
                const minZ = Math.min(FLOOR_CORNER_1.z, FLOOR_CORNER_2.z);
                const maxZ = Math.max(FLOOR_CORNER_1.z, FLOOR_CORNER_2.z);

                for (let x = minX; x <= maxX; x++) {
                    for (let y = minY; y <= maxY; y++) {
                        for (let z = minZ; z <= maxZ; z++) {
                            const b = dim.getBlock({ x, y, z });
                            if (!b) continue;
                            if (b.typeId === "minecraft:air") {
                                b.setType("minecraft:snow");
                            }
                        }
                    }
                }
            } catch (e) { }
        });

        return;
    }
});

// --- WORLD BORDER / COMBAT ELYTRA / SLOW MAINT — handled in Realm master loop ---

// ==========================================
// 🚫 BANNED ITEM BLOCKER (CRASH-PROOF) & TOTEM LIMITER
// ==========================================

if (world.beforeEvents && world.beforeEvents.itemUse) {
    world.beforeEvents.itemUse.subscribe((event) => {
        // ✨ FIX: Allow Testers to use the item
        if (event.itemStack && event.itemStack.typeId === BANNED_ITEM && !isTester(event.source)) {
            event.cancel = true;
            notify(event.source, "tnt_modifier_ban", "§cThe TNT Modifier is banned and cannot be used.");
        }
    });
}

if (world.beforeEvents && world.beforeEvents.itemUseOn) {
    world.beforeEvents.itemUseOn.subscribe((event) => {
        // ✨ FIX: Allow Testers to use the item
        if (event.itemStack && event.itemStack.typeId === BANNED_ITEM && !isTester(event.source)) {
            event.cancel = true;
            notify(event.source, "tnt_modifier_ban", "§cThe TNT Modifier is banned and cannot be used.");
        }
    });
}

if (world.afterEvents && world.afterEvents.playerInteractWithBlock) {
    world.afterEvents.playerInteractWithBlock.subscribe((event) => {
        const block = event.block;
        const player = event.player;
        if (!block) return;

        // ✨ FIX: Ignore chest-sweeping if a Tester is opening it
        if (isTester(player)) return; 

        const inventory = block.getComponent("inventory");
        if (!inventory) return;

        const container = inventory.container;
        let itemDestroyed = false;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && item.typeId === BANNED_ITEM) {
                container.setItem(i, undefined);
                itemDestroyed = true;
            }
        }

        if (itemDestroyed) {
            notify(player, "tnt_modifier_destroyed", "§cAn illegal TNT Modifier was found in this container and has been destroyed.");
        }
    }); 
}

function dropItemsAtPlayer(player, typeId, amount) {
    if (!player || amount <= 0) return;

    markTotemLimiterDrop(player);

    system.runTimeout(() => {
        if (!isPlayerOnline(player)) return;

        let remaining = amount;
        const loc = player.location;
        let forwardX = 0;
        let forwardZ = 1;

        try {
            const view = player.getViewDirection();
            forwardX = view.x;
            forwardZ = view.z;
        } catch (e) { }

        const dropLoc = {
            x: loc.x + forwardX * 2.5,
            y: loc.y + 1.1,
            z: loc.z + forwardZ * 2.5,
        };

        while (remaining > 0) {
            const stackAmount = Math.min(64, remaining);

            try {
                const stack = new ItemStack(typeId, stackAmount);
                const itemEnt = player.dimension.spawnItem(stack, dropLoc);
                if (itemEnt?.applyImpulse) {
                    itemEnt.applyImpulse({
                        x: forwardX * 0.65,
                        y: 0.35,
                        z: forwardZ * 0.65,
                    });
                }
            } catch (e) {}

            remaining -= stackAmount;
        }
    }, 2);
}

// ==========================================
// WORLD BUILDER 1.6 — STAFF & CREATIVE BUILDER HANDBOOK & TOOLBOX
// ==========================================
if (world.beforeEvents?.itemUse) {
    world.beforeEvents.itemUse.subscribe((event) => {
        try {
            const player = event.source;
            if (!player || player.typeId !== "minecraft:player") return;
            blockWorldBuilderStaffOnlyUse(player, event.itemStack, event);
            blockDebugStickUse(player, event.itemStack, event);
            tryReleaseCaptureCube(player, event.itemStack, event);
        } catch (e) { }
    });
}

if (world.beforeEvents?.itemUseOn) {
    world.beforeEvents.itemUseOn.subscribe((ev) => {
        try {
            const player = ev.source;
            if (!player || player.typeId !== "minecraft:player") return;
            blockWorldBuilderStaffOnlyUse(player, ev.itemStack, ev);
            blockDebugStickUse(player, ev.itemStack, ev);
            tryReleaseCaptureCube(player, ev.itemStack, ev);
        } catch (e) { }
    });
}

if (world.afterEvents?.playerInventoryItemChange) {
    world.afterEvents.playerInventoryItemChange.subscribe((event) => {
        schedulePlayerItemMaintenance(event.player);
        applyMaceSlownessIfHolding(event.player);
    });
}

if (world.afterEvents?.playerHotbarSelectedSlotChange) {
    world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {
        applyMaceSlownessIfHolding(event.player);
    });
}

// Item security — event-driven + backup sweep in Realm master loop (tickSlowPlayerMaintenance)

// ==========================================
// ENDER PEARL COOLDOWN (2.5 SECONDS)
// ==========================================
const enderPearlCooldowns = new Map();
const ENDER_PEARL_COOLDOWN_MS = 2500;

function restoreCancelledPearl(player, expectedAmount = 1) {
    if (!player?.isValid) return;
    system.run(() => {
        try {
            const inv = player.getComponent("minecraft:inventory")?.container;
            if (!inv) return;

            const desired = Math.max(1, Math.floor(Number(expectedAmount) || 1));
            const slot = player.selectedSlotIndex;
            const current = inv.getItem(slot);

            if (current?.typeId === "minecraft:ender_pearl") {
                if ((current.amount || 0) >= desired) return;
                const diff = desired - (current.amount || 0);
                const add = new ItemStack("minecraft:ender_pearl", diff);
                const leftover = inv.addItem(add);
                if (leftover) player.dimension.spawnItem(leftover, player.location);
                return;
            }

            const pearl = new ItemStack("minecraft:ender_pearl", desired);
            const leftover = inv.addItem(pearl);
            if (leftover) player.dimension.spawnItem(leftover, player.location);
        } catch (e) { }
    });
}

if (world.beforeEvents && world.beforeEvents.itemUse) {
    world.beforeEvents.itemUse.subscribe((event) => {
        const player = event.source;
        if (!player || player.typeId !== "minecraft:player") return;

        if (event.itemStack && event.itemStack.typeId === "minecraft:ender_pearl") {
            if (event.cancel) return;

            const now = Date.now();
            const lastUsed = enderPearlCooldowns.get(player.id) || 0;

            if (now - lastUsed < ENDER_PEARL_COOLDOWN_MS) {
                event.cancel = true;
                restoreCancelledPearl(player, event.itemStack?.amount ?? 1);
                const timeLeft = ((ENDER_PEARL_COOLDOWN_MS - (now - lastUsed)) / 1000).toFixed(1);

                system.run(() => {
                    notify(
                        player,
                        "pearl_cooldown",
                        "§c§l[COOLDOWN]",
                        `§cEnder Pearls are on cooldown!\n§eWait ${timeLeft}s to use again.`,
                        "note.bass",
                        1000
                    );
                });
            }
        }
    });
}

if (world.afterEvents?.itemUse) {
    world.afterEvents.itemUse.subscribe((event) => {
        const player = event.source;
        if (!player || player.typeId !== "minecraft:player") return;
        if (event.itemStack?.typeId !== "minecraft:ender_pearl") return;
        enderPearlCooldowns.set(player.id, Date.now());
    });
}

// ==========================================
// MACE DAMAGE CAP + WIND CHARGE COOLDOWN
// ==========================================

const windChargeCooldowns = new Map();
const WIND_CHARGE_COOLDOWN_MS = 5000;
const WIND_CHARGE_COOLDOWN_TICKS = 5 * 20;

if (world.beforeEvents?.entityHurt) {
    world.beforeEvents.entityHurt.subscribe((event) => {
        const player = event.damageSource?.damagingEntity;

        if (!player || player.typeId !== "minecraft:player") return;

        const equipment = player.getComponent("minecraft:equippable");
        const mainHand = equipment?.getEquipment("Mainhand");

        if (mainHand?.typeId !== "minecraft:mace") return;

        // Cap mace damage to 20 damage / 10 hearts
        if (event.damage > 20) {
            event.damage = 20;
        }
    });
}


// ==========================================
// WIND CHARGE COOLDOWN: 5 SECONDS
// ==========================================
if (world.beforeEvents?.itemUse) {
    world.beforeEvents.itemUse.subscribe((event) => {
        const player = event.source;

        if (!player || player.typeId !== "minecraft:player") return;

        if (event.itemStack?.typeId === "minecraft:wind_charge") {
            const now = Date.now();
            const lastUsed = windChargeCooldowns.get(player.id) || 0;
            const elapsed = now - lastUsed;

            if (elapsed < WIND_CHARGE_COOLDOWN_MS) {
                event.cancel = true;

                const timeLeft = ((WIND_CHARGE_COOLDOWN_MS - elapsed) / 1000).toFixed(1);

                system.run(() => {
                    try {
                        player.startItemCooldown("wind_charge", Math.ceil((WIND_CHARGE_COOLDOWN_MS - elapsed) / 50));
                    } catch (e) {}

                    notify(
                        player,
                        "wind_charge_cooldown",
                        "§c§l[COOLDOWN]",
                        `§cWind Charges are recharging!\n§eWait ${timeLeft}s to use again.`,
                        "note.bass",
                        1000
                    );
                });

                return;
            }

            windChargeCooldowns.set(player.id, now);

            // Start vanilla cooldown animation
            system.run(() => {
                try {
                    player.startItemCooldown("wind_charge", WIND_CHARGE_COOLDOWN_TICKS);
                } catch (e) {}
            });
        }
    });
}

export { notify, toast, toastError, toastSuccess, toastInfo, toastWarning, toastDeny, formatToast };
