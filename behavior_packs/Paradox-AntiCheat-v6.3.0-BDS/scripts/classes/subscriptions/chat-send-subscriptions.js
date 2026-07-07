import { world, system } from "@minecraft/server";
import { commandHandler, paradoxModulesDB, channelsDB } from "../../event-listeners/world-initialize.js";
import { PlayerCache } from "../player-cache.js";
import { EventCoordinator } from "../event-coordinator.js";
// Configuration for spam detection
const SPAM_THRESHOLD = 5; // Number of allowed messages
const TIME_WINDOW = 100; // Time window in ticks (5 seconds at 20 ticks per second)
const MUTE_DURATION = 2400; // Mute duration in ticks (2 minutes)
/**
 * Zero-allocation spam tracker using a circular buffer.
 */
class SpamTracker {
    buffer;
    index = 0;
    count = 0;
    mutedUntil = undefined;
    constructor() {
        this.buffer = new Uint32Array(SPAM_THRESHOLD + 1);
    }
    recordMessage(currentTick) {
        if (this.mutedUntil !== undefined && currentTick < this.mutedUntil) {
            return true;
        }
        if (this.mutedUntil !== undefined && currentTick >= this.mutedUntil) {
            this.mutedUntil = undefined;
            this.count = 0;
        }
        this.buffer[this.index] = currentTick;
        if (++this.index === this.buffer.length) {
            this.index = 0;
        }
        if (this.count < this.buffer.length) {
            this.count++;
        }
        if (this.count > SPAM_THRESHOLD) {
            const oldestTick = this.buffer[this.index];
            if (currentTick - oldestTick <= TIME_WINDOW) {
                this.mutedUntil = currentTick + MUTE_DURATION;
                return true;
            }
        }
        return false;
    }
    isFullyInactive() {
        return this.mutedUntil === undefined && this.count === 0;
    }
}
/**
 * Handles chat send events, including spam detection and command processing.
 */
class ChatSendSubscription {
    callback;
    spamData;
    channelMemberCache;
    constructor() {
        this.callback = null;
        this.spamData = new Map();
        this.channelMemberCache = new Map();
    }
    isSpamCheckEnabled() {
        return paradoxModulesDB.get("spamCheck_b")?.enabled === true;
    }
    isPlayerPropertyEqual(player, propertyKey, expectedValue) {
        const value = player.isValid ? player.getDynamicProperty(propertyKey) : undefined;
        return value === expectedValue;
    }
    getPlayerChannel(player) {
        const channels = channelsDB.entries();
        for (const [channelName, channelData] of channels) {
            if (channelData.Members[player.id])
                return channelName;
        }
        return undefined;
    }
    subscribe() {
        if (this.callback)
            return;
        this.callback = async (event) => {
            const player = event.sender;
            const playerId = player.id;
            const playerChannel = this.getPlayerChannel(player);
            const currentTick = system.currentTick;
            // 1️⃣ Command handling (Intercept first so muted players can still use commands)
            const prefix = world.getDynamicProperty("__prefix") || ":";
            if (event.message.startsWith(prefix)) {
                event.cancel = true;
                commandHandler.handleCommand(event, player, prefix);
                return;
            }
            // 2️⃣ Mute check - If the player is muted, cancel the event and inform them.
            const isMuted = player.getDynamicProperty("isMuted");
            if (isMuted) {
                event.cancel = true;
                player.sendMessage("§o§c[Paradox] You are currently muted and cannot send messages.");
                return; // Stop further processing for muted players
            }
            // 3️⃣ Spam detection
            if (this.isSpamCheckEnabled() && !this.isPlayerPropertyEqual(player, "securityClearance", 4)) {
                let tracker = this.spamData.get(playerId);
                if (!tracker) {
                    tracker = new SpamTracker();
                    tracker.mutedUntil = player.getDynamicProperty("mutedUntil");
                    this.spamData.set(playerId, tracker);
                }
                // actively muted
                if (tracker.mutedUntil && currentTick < tracker.mutedUntil) {
                    event.cancel = true;
                    const remainingSec = Math.ceil((tracker.mutedUntil - currentTick) / 20);
                    player.sendMessage(`§o§c[Paradox] You are muted for spamming. Wait ${remainingSec}s.`);
                    return;
                }
                const isSpam = tracker.recordMessage(currentTick);
                if (isSpam) {
                    event.cancel = true;
                    player.setDynamicProperty("mutedUntil", tracker.mutedUntil);
                    const muteSec = Math.ceil(MUTE_DURATION / 20);
                    player.sendMessage(`§o§c[Paradox] You have been muted for spamming. Wait ${muteSec}s.`);
                    return;
                }
                // clear stored mute once expired
                if (tracker.mutedUntil === undefined) {
                    player.setDynamicProperty("mutedUntil", undefined);
                }
                // cleanup once fully inactive
                if (tracker.isFullyInactive()) {
                    this.spamData.delete(playerId);
                }
            }
            // 4️⃣ Chat rank/global handling
            const isRankDisabled = world.getDynamicProperty("globalRankDisabled");
            if (isRankDisabled && !playerChannel)
                return;
            event.cancel = true;
            const playerRank = player.getDynamicProperty("chatRank") ?? "§2[§7Member§2]";
            const rank = playerChannel ?? playerRank;
            // Support for Rename/Alias system
            const alias = player.getDynamicProperty("paradoxAlias");
            const displayName = alias ?? player.name;
            const formattedMessage = `${rank} §7${displayName}§7: §r${event.message}`;
            // 5️⃣ Determine target players
            if (playerChannel) {
                const channelData = channelsDB.get(playerChannel);
                if (channelData) {
                    const now = Date.now();
                    const DEBOUNCE_INTERVAL = 5000;
                    // debounce lastActive writes
                    if (!channelData.lastActive || now - channelData.lastActive > DEBOUNCE_INTERVAL) {
                        channelData.lastActive = now;
                        system.run(() => {
                            channelsDB.set(playerChannel, channelData);
                        });
                    }
                    // cached member set
                    const cacheEntry = this.channelMemberCache.get(playerChannel);
                    let memberSet;
                    if (!cacheEntry || now - cacheEntry.lastUpdated > DEBOUNCE_INTERVAL) {
                        memberSet = new Set(Object.keys(channelData.Members));
                        this.channelMemberCache.set(playerChannel, {
                            memberSet,
                            lastUpdated: now,
                        });
                    }
                    else {
                        memberSet = cacheEntry.memberSet;
                    }
                    for (const p of PlayerCache.filterByIds(memberSet)) {
                        p.sendMessage(formattedMessage);
                    }
                }
                else {
                    // fallback global broadcast
                    for (const p of PlayerCache.getPlayers()) {
                        p.sendMessage(formattedMessage);
                    }
                }
            }
            else {
                // global broadcast
                for (const p of PlayerCache.getPlayers()) {
                    p.sendMessage(formattedMessage);
                }
            }
        };
        EventCoordinator.subscribeBefore("chatSend", this.callback);
    }
    unsubscribe() {
        if (!this.callback)
            return;
        EventCoordinator.unsubscribeBefore("chatSend", this.callback);
        this.callback = null;
    }
}
export const chatSendSubscription = new ChatSendSubscription();
