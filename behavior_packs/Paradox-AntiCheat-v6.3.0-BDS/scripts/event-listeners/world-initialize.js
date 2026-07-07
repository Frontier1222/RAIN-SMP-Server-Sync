import { system, world } from "@minecraft/server";
import { lockdownCommand } from "../commands/moderation/lockdown.js";
import { startLagClear } from "../modules/lag-clear.js";
import { startGameModeCheck } from "../modules/game-mode.js";
import { startWorldBorderCheck } from "../modules/world-border.js";
import { startFlyCheck } from "../modules/fly.js";
import { startAFKChecker } from "../modules/afk.js";
import { initializePvPSystem } from "../modules/pvp-manager.js";
import { startHitReachCheck } from "../modules/reach.js";
import { startDoubleJump, doubleJumpCommand } from "../commands/utility/double-jump.js";
import { startAutoClicker } from "../modules/autoclicker.js";
import { startKillAuraCheck } from "../modules/killaura.js";
import { startScaffoldCheck } from "../modules/scaffold.js";
import { startNamespoofDetection } from "../modules/namespoof.js";
import { startXrayDetection } from "../modules/xray.js";
import { startInvSync } from "../modules/invsync.js";
import { globalBanPlayers } from "../data/global-ban.js";
import { paradoxVersion } from "../data/versioning.js";
import { OptimizedDatabase } from "../classes/database/data-hive.js";
import { startSelfAttackCheck } from "../modules/self-infliction.js";
import { startPacketHandler } from "../modules/rate-limit.js";
import { startPacketListener } from "../modules/packet-monitor.js";
import { startVisionCheck } from "../modules/vision.js";
import { CommandHandler } from "../classes/command-handler.js";
import { opCommand } from "../commands/moderation/op.js";
import { deopCommand } from "../commands/moderation/deop.js";
import { punishCommand } from "../commands/moderation/punish.js";
import { vanishCommand } from "../commands/moderation/vanish.js";
import { prefixCommand } from "../commands/moderation/prefix.js";
import { despawnCommand } from "../commands/moderation/despawn.js";
import { kickCommand } from "../commands/moderation/kick.js";
import { tpaCommand } from "../commands/moderation/tpa.js";
import { homeCommand } from "../commands/utility/home.js";
import { invseeCommand } from "../commands/utility/invsee.js";
import { opsecCommand } from "../commands/moderation/opsec.js";
import { tprCommand } from "../commands/utility/tpr.js";
import { setRankCommand } from "../commands/utility/rank.js";
import { banCommand } from "../commands/moderation/ban.js";
import { unbanCommand } from "../commands/moderation/unban.js";
import { lagClearCommand } from "../commands/settings/lag-clear.js";
import { gameModeCommand } from "../commands/settings/game-mode.js";
import { gameruleCommand } from "../commands/settings/gamerule.js";
import { worldBorderCommand } from "../commands/settings/world-border.js";
import { flyCheckCommand } from "../commands/settings/fly.js";
import { afkCommand } from "../commands/settings/afk.js";
import { antispamCommand } from "../commands/settings/spam.js";
import { pvpCooldownCommand, pvpToggleCommand, pvpToggleCooldownCommand } from "../commands/utility/pvp.js";
import { channelCommand } from "../commands/utility/channels.js";
import { hitReachCheckCommand } from "../commands/settings/reach.js";
import { autoClickerCommand } from "../commands/settings/autoclicker.js";
import { killauraCommand } from "../commands/settings/killaura.js";
import { modulesStatusCommand } from "../commands/moderation/modules.js";
import { scaffoldCommand } from "../commands/settings/scaffold.js";
import { imprisonCommand } from "../commands/moderation/freeze.js";
import { platformBlockCommand } from "../commands/settings/platform-block.js";
import { nameSpoofCommand } from "../commands/settings/namespoof.js";
import { xrayCommand } from "../commands/settings/xray.js";
import { whitelistCommand } from "../commands/moderation/whitelist.js";
import { guiCommand } from "../commands/gui/form-generator.js";
import { command } from "../commands/moderation/command.js";
import { selfAttackCheckCommand } from "../commands/settings/self-infliction.js";
import { rateLimitCommand } from "../commands/settings/rate-limit.js";
import { packetMonitorCommand } from "../commands/settings/packet-monitor.js";
import { allowlistCommand } from "../commands/moderation/allowlist.js";
import { visionCheckCommand } from "../commands/settings/vision.js";
import { invSyncCommand } from "../commands/settings/invsync.js";
import { healthChangeListener } from "./health-sync.js";
import { onPlayerSpawn } from "./player-spawn.js";
import { initializeGlobalBanCheck } from "./global-ban-listener.js";
import { initializeSecurityClearanceTracking } from "../utility/level-4-security-tracker.js";
import { chatSendSubscription } from "../classes/subscriptions/chat-send-subscriptions.js";
import { debugDBCommand } from "../commands/utility/debug-db.js";
import { noClipCommand } from "../commands/settings/noclip.js";
import { startNoClip } from "../modules/noclip.js";
import { PlayerCache } from "../classes/player-cache.js";
import { invCloneCommand } from "../commands/utility/invclone.js";
import { chestForensicCommand } from "../commands/settings/container-lock.js";
import { startChestLock } from "../modules/container-lock.js";
import { scriptureCommand } from "../commands/utility/scriptures.js";
import { paradoxInfoCommand } from "../commands/utility/paradox-info.js";
import { transferCommand } from "../commands/utility/transfer.js";
import { muteCommand } from "../commands/moderation/mute.js";
import { warnCommand } from "../commands/moderation/warn.js";
import { renameCommand } from "../commands/moderation/rename.js";
import { tpsCommand } from "../commands/utility/tps.js";
import { deathCoordsCommand } from "../commands/settings/death-coords.js";
import { startDeathCoords } from "../modules/death-coords.js";
import { startAimbotMonitor } from "../modules/aimbot-monitor.js";
import { aimbotMonitorCommand } from "../commands/settings/aimbot-monitor.js";
import { criticalsCommand } from "../commands/settings/criticals.js";
import { startCriticalsCheck } from "../modules/criticals.js";
import { autoTotemCommand } from "../commands/settings/autototem.js";
import { startAutoTotemCheck } from "../modules/autototem.js";
import { pathingCommand } from "../commands/settings/pathing-monitor.js";
import { startPathingMonitor } from "../modules/pathing-monitor.js";
import { anticrashCommand } from "../commands/settings/anticrash.js";
import { startAntiCrash } from "../modules/anticrash.js";
import { EventCoordinator } from "../classes/event-coordinator.js";
import { dimensionLockCommand } from "../commands/settings/dimension-lock.js";
import { startDimensionLock } from "../modules/dimension-lock.js";
import { itemUseSubscription } from "../classes/subscriptions/item-use-subscriptions.js";
import { guiItemCommand } from "../commands/settings/gui-item.js";
import { broadcastCommand } from "../commands/utility/broadcast.js";
import { whoisCommand } from "../commands/utility/whois.js";
import { waypointCommand, startWaypointHUD } from "../commands/utility/waypoint.js";
import { historyCommand } from "../commands/utility/history.js";
import { environmentCommand } from "../commands/utility/environment.js";
import { pingCommand } from "../commands/utility/ping.js";
// Store the lockDownMonitor function reference
let lockDownMonitor;
let wrappedLockDownMonitor;
// Declare the necessary objects to be exported
let paradoxModulesDB;
let channelsDB;
let disabledCommandsDB;
let spoofDB;
let whitelistDB;
let allowlistDB;
let banlistDB;
let warnsDB;
let invSyncSnapshotsDB;
let invSyncAuditDB;
let chestLockDB;
let playerMetadataDB;
let homesDB;
let commandHandler;
// Define all available commands
const allCommands = [
    opCommand,
    deopCommand,
    punishCommand,
    vanishCommand,
    prefixCommand,
    despawnCommand,
    kickCommand,
    lockdownCommand,
    tpaCommand,
    homeCommand,
    invseeCommand,
    opsecCommand,
    tprCommand,
    setRankCommand,
    banCommand,
    unbanCommand,
    lagClearCommand,
    gameModeCommand,
    gameruleCommand,
    worldBorderCommand,
    flyCheckCommand,
    afkCommand,
    antispamCommand,
    pvpToggleCommand,
    channelCommand,
    hitReachCheckCommand,
    autoClickerCommand,
    killauraCommand,
    modulesStatusCommand,
    scaffoldCommand,
    imprisonCommand,
    platformBlockCommand,
    nameSpoofCommand,
    pvpCooldownCommand,
    pvpToggleCooldownCommand,
    xrayCommand,
    whitelistCommand,
    guiCommand,
    command,
    selfAttackCheckCommand,
    rateLimitCommand,
    packetMonitorCommand,
    allowlistCommand,
    visionCheckCommand,
    doubleJumpCommand,
    debugDBCommand,
    invSyncCommand,
    noClipCommand,
    invCloneCommand,
    chestForensicCommand,
    scriptureCommand,
    paradoxInfoCommand,
    transferCommand,
    muteCommand,
    warnCommand,
    renameCommand,
    tpsCommand,
    deathCoordsCommand,
    aimbotMonitorCommand,
    criticalsCommand,
    autoTotemCommand,
    pathingCommand,
    anticrashCommand,
    dimensionLockCommand,
    guiItemCommand,
    broadcastCommand,
    whoisCommand,
    waypointCommand,
    historyCommand,
    environmentCommand,
    pingCommand,
];
/**
 * Initializes and instantiates all necessary systems (databases, command handler, etc.)
 */
async function initializeSystems() {
    // Instantiate Databases
    paradoxModulesDB = new OptimizedDatabase("paradoxModules");
    channelsDB = new OptimizedDatabase("channels");
    disabledCommandsDB = new OptimizedDatabase("disabledCommands");
    spoofDB = new OptimizedDatabase("trustedPlayers");
    whitelistDB = new OptimizedDatabase("whitelist");
    allowlistDB = new OptimizedDatabase("allowlist");
    banlistDB = new OptimizedDatabase("banlist");
    warnsDB = new OptimizedDatabase("warns");
    invSyncSnapshotsDB = new OptimizedDatabase("invSyncSnapshots");
    invSyncAuditDB = new OptimizedDatabase("invSyncAudit");
    chestLockDB = new OptimizedDatabase("chestLocks");
    playerMetadataDB = new OptimizedDatabase("playerMetadata");
    homesDB = new OptimizedDatabase("homes");
    // Clean up invalid entries (Optional: you can pass a custom validation function per DB if needed)
    const dbs = [paradoxModulesDB, channelsDB, disabledCommandsDB, spoofDB, whitelistDB, allowlistDB, banlistDB, warnsDB, invSyncAuditDB, invSyncSnapshotsDB, chestLockDB, playerMetadataDB, homesDB];
    const results = await Promise.allSettled(dbs.map((db) => db.clean()));
    results.forEach((result, i) => {
        if (result.status === "rejected") {
            console.warn(`[Paradox] Failed to clean DB at index ${i}:`, result.reason);
        }
    });
    // Clean up stagnant channels
    async function channelsDBCleanup() {
        const now = Date.now();
        const cutoff = now - 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        for (const [channelName, channel] of channelsDB.entries()) {
            if (typeof channel.lastActive !== "number")
                continue;
            if (channel.lastActive < cutoff) {
                await channelsDB.delete(channelName);
                console.warn(`[Paradox] Removed inactive channel '${channelName}' (last active ${new Date(channel.lastActive).toLocaleString()})`);
            }
        }
    }
    // Clean up stagnant channels
    await channelsDBCleanup();
    // Instantiate CommandHandler
    commandHandler = new CommandHandler();
    // Fetch disabled commands from the database and create a Set for faster lookups
    const disabledCommandsSet = new Set(disabledCommandsDB.entries().map((entry) => entry[0]));
    // Filter out disabled commands using the Set for faster lookup
    const enabledCommands = allCommands.filter((command) => !disabledCommandsSet.has(command.name));
    // Register only the enabled commands
    commandHandler.registerCommand(enabledCommands);
}
/**
 * Compares two version strings in the format "vX.Y.Z" and returns -1 if the first version is smaller,
 * 1 if the first version is greater, and 0 if both are equal.
 */
function compareVersions(version1, version2) {
    const parseVersion = (version) => {
        return version
            .slice(1)
            .split(".")
            .map((num) => parseInt(num, 10)); // Remove 'v' and split by '.'
    };
    const v1Parts = parseVersion(version1);
    const v2Parts = parseVersion(version2);
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] ?? 0; // Default to 0 if the version part doesn't exist
        const v2Part = v2Parts[i] ?? 0; // Default to 0 if the version part doesn't exist
        if (v1Part < v2Part)
            return -1;
        if (v1Part > v2Part)
            return 1;
    }
    return 0; // The versions are equal
}
/**
 * Validates the stored command prefix and resets it to default if it violates safety rules.
 */
function initializePrefix() {
    const DEFAULT_PREFIX = ":";
    const currentPrefix = world.getDynamicProperty("__prefix");
    if (currentPrefix === undefined) {
        world.setDynamicProperty("__prefix", DEFAULT_PREFIX);
        return;
    }
    const isIllegal = currentPrefix.length === 0 || currentPrefix.length > 2 || currentPrefix.includes("/") || currentPrefix.includes("§") || /\s/.test(currentPrefix) || /[a-zA-Z0-9]/.test(currentPrefix);
    if (isIllegal) {
        console.warn(`[Paradox] Invalid prefix "${currentPrefix}" detected during initialization. Resetting to "${DEFAULT_PREFIX}".`);
        world.setDynamicProperty("__prefix", DEFAULT_PREFIX);
    }
}
/**
 * Initializes the global banned players list if it does not exist.
 * If it doesn't exist, create it and store the `globalBanPlayers` list as a stringified JSON object.
 */
function initializeGlobalBanList() {
    const globalBannedPlayersKey = "globalBannedPlayers";
    // Get the current world version dynamically
    const version = world.getDynamicProperty("paradoxVersion");
    // Compare the world version with the paradox version
    if (!version || compareVersions(version, paradoxVersion) <= 0) {
        // Update the current world version
        world.setDynamicProperty("paradoxVersion", paradoxVersion);
        // Update global ban list for new version
        world.setDynamicProperty(globalBannedPlayersKey, JSON.stringify([...globalBanPlayers]));
        return;
    }
    // Check if the globalBannedPlayers dynamic property already exists
    const existingBanList = world.getDynamicProperty(globalBannedPlayersKey);
    if (!existingBanList) {
        // If it doesn't exist, initialize it with the globalBanPlayers array
        world.setDynamicProperty(globalBannedPlayersKey, JSON.stringify([...globalBanPlayers]));
    }
}
/**
 * Initializes and updates paradoxModules from the world dynamic property.
 * Starts corresponding modules based on their configured values.
 * @returns {Promise<void>}
 */
async function initializeParadoxModules() {
    // Retrieve paradoxModules from the OptimizedDatabase (paradoxModulesDB)
    const paradoxModules = paradoxModulesDB.entries();
    // Lookup table for module initialization
    const moduleActions = {
        lagClearCheck_b: () => {
            const settings = paradoxModulesDB.get("lagClearCheck_b")?.settings;
            if (settings && "hours" in settings && "minutes" in settings && "seconds" in settings) {
                startLagClear(settings.hours, settings.minutes, settings.seconds);
            }
            else {
                startLagClear(0, 5, 0); // fallback
            }
        },
        gamemodeCheck_b: () => startGameModeCheck(),
        worldBorderCheck_b: () => startWorldBorderCheck(),
        flyCheck_b: () => startFlyCheck(),
        afkCheck_b: () => {
            const settings = paradoxModulesDB.get("afkCheck_b")?.settings;
            if (settings && "hours" in settings && "minutes" in settings && "seconds" in settings) {
                startAFKChecker(settings.hours, settings.minutes, settings.seconds);
            }
            else {
                startAFKChecker(0, 10, 0);
            }
        },
        hitReachCheck_b: () => startHitReachCheck(),
        autoClickerCheck_b: () => startAutoClicker(),
        killAuraCheck_b: () => startKillAuraCheck(),
        scaffoldCheck_b: () => startScaffoldCheck(),
        nameSpoofCheck_b: () => startNamespoofDetection(),
        xrayDetection_b: () => startXrayDetection(),
        selfAttackCheck_b: () => startSelfAttackCheck(),
        rateLimitCheck_b: () => startPacketHandler(),
        packetMonitorCheck_b: () => startPacketListener(),
        visionCheck_b: () => startVisionCheck(),
        invSync_b: () => startInvSync(),
        noClipCheck_b: () => startNoClip(),
        chestLock_b: () => startChestLock(),
        deathCoords_b: () => startDeathCoords(),
        aimbotMonitorCheck_b: () => startAimbotMonitor(),
        criticalsCheck_b: () => startCriticalsCheck(),
        autoTotemCheck_b: () => startAutoTotemCheck(),
        pathingCheck_b: () => startPathingMonitor(),
        antiCrashCheck_b: () => startAntiCrash(),
        dimensionLock_b: () => startDimensionLock(),
    };
    const runModuleInitializers = () => {
        paradoxModules.forEach(([key, value]) => {
            if ("enabled" in value && value.enabled && moduleActions[key]) {
                moduleActions[key]();
            }
        });
    };
    system.run(runModuleInitializers);
}
/**
 * Subscribes to the lockdown event and sets up a monitor for player spawns.
 * If lockdown is active, the player spawn event will be handled by the lockdown monitor.
 */
function subscribeToLockDown() {
    lockDownMonitor = lockdownCommand.execute(undefined, undefined, undefined, true);
    if (lockDownMonitor) {
        wrappedLockDownMonitor = (event) => {
            const isLockdownActive = world.getDynamicProperty("lockdown_b");
            if (!isLockdownActive) {
                unsubscribeFromLockDown();
                return;
            }
            if (lockDownMonitor) {
                lockDownMonitor(event); // Call the original lockDownMonitor
            }
        };
        EventCoordinator.subscribeAfter("playerSpawn", wrappedLockDownMonitor);
    }
}
/**
 * Unsubscribes from the lockdown event and cleans up references to monitoring functions.
 * Stops handling player spawn events for lockdown if no longer active.
 */
function unsubscribeFromLockDown() {
    const cleanupLockdownState = () => {
        if (wrappedLockDownMonitor) {
            EventCoordinator.unsubscribeAfter("playerSpawn", wrappedLockDownMonitor);
            wrappedLockDownMonitor = undefined; // Clear the reference
        }
        lockDownMonitor = undefined; // Clear the reference to the original function
        EventCoordinator.unsubscribeAfter("worldLoad", onWorldInitialize); // Unsubscribe from world load to prevent re-initialization
    };
    system.run(cleanupLockdownState);
}
/**
 * Checks if lockdown is active and subscribes to the lockdown events if so.
 */
function handleLockDown() {
    const isLockdownActive = world.getDynamicProperty("lockdown_b");
    if (isLockdownActive) {
        subscribeToLockDown();
    }
}
/**
 * Checks if PvP is globally enabled and initializes the PvP system if so.
 * Sets the PvP game rule to true if the dynamic property is enabled.
 */
function handlePvP() {
    const isPvPGlobalEnabled = world.getDynamicProperty("pvpGlobalEnabled") ?? false;
    if (isPvPGlobalEnabled) {
        // Ensure the game rule is set to true if PvP is enabled globally
        world.gameRules.pvp = true;
        // Initialize the PvP system
        initializePvPSystem();
    }
}
/**
 * Checks if Double Jump is enabled and initializes the system if so.
 */
function handleDoubleJump() {
    const isDoubleJumpEnabled = world.getDynamicProperty("doubleJumpEnabled") ?? false;
    if (isDoubleJumpEnabled) {
        startDoubleJump();
    }
}
/**
 * Initializes paradoxModules and handles lockdown on world load.
 * @returns {Promise<void>}
 */
async function onWorldInitialize() {
    if (commandHandler.getGuiItem())
        itemUseSubscription.subscribe(); // Only subscribe if a GUI item is configured
    chatSendSubscription.subscribe(); // Subscribe to chat send events
    initializeSecurityClearanceTracking(); // Initializes the tracking of players with security clearance level 4.
    initializeGlobalBanList(); // Ensure the global banned player list is initialized
    initializeGlobalBanCheck(); // Initialize the global ban listener
    initializePrefix(); // Validate and initialize the command prefix
    await initializeParadoxModules(); // Ensure paradoxModules is initialized and modules are started
    handleLockDown(); // Handle lockdown if it's active
    handlePvP(); // Handle PvP if it's enabled
    handleDoubleJump(); // Handle Double Jump persistence
    onPlayerSpawn(); // Subscribe to player spawn events
    startWaypointHUD(); // Initialize the Waypoint navigation HUD
    healthChangeListener.start(); // Synchronize health
}
/**
 * Subscribes to the world load event.
 * Sets up paradoxModules and handles lockdown when the world initializes.
 */
export function subscribeToWorldInitialize() {
    EventCoordinator.subscribeAfter("worldLoad", async () => {
        await initializeSystems();
        PlayerCache.init(); // Initialize PlayerCache after systems are set up
        await onWorldInitialize();
    });
}
// Export the instantiated databases and command handler
export { allCommands, paradoxModulesDB, channelsDB, disabledCommandsDB, spoofDB, commandHandler, whitelistDB, allowlistDB, banlistDB, warnsDB, invSyncAuditDB, invSyncSnapshotsDB, chestLockDB, playerMetadataDB, homesDB };
