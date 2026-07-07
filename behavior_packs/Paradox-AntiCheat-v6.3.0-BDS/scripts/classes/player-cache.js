import { world, system } from "@minecraft/server";
import { EventCoordinator } from "./event-coordinator.js";
/**
 * Centralized cache of online players.
 * Eliminates repeated calls to `world.getPlayers()` across scripts.
 * Provides high-performance iteration, filtered access, and auto-cleanup of ghost players.
 */
export class PlayerCache {
    /** Map of player ID -> Player object */
    static playersById = new Map();
    /** Map of player name -> Player object for O(1) name lookups */
    static playersByName = new Map();
    /** Prevents double initialization */
    static initialized = false;
    /** Event subscriptions */
    static spawnSubscription;
    static leaveSubscription;
    /** Periodic cleanup interval ID */
    static cleanupInterval;
    /** Interval in ticks to reconcile ghost players */
    static CLEANUP_INTERVAL_TICKS = 1200; // 1 minute at 20 ticks/second
    /**
     * Initializes the player cache.
     * Subscribes to player join/leave events and populates initial cache.
     * Safe to call multiple times; will only initialize once.
     */
    static init() {
        if (this.initialized)
            return;
        this.initialized = true;
        // Populate initial cache
        for (const player of world.getPlayers()) {
            this.playersById.set(player.id, player);
            this.playersByName.set(player.name, player);
        }
        // Subscribe to player spawn
        this.spawnSubscription = (ev) => {
            if (!ev.initialSpawn)
                return;
            const p = ev.player;
            if (!this.playersById.has(p.id)) {
                this.playersById.set(p.id, p);
                this.playersByName.set(p.name, p);
            }
        };
        EventCoordinator.subscribeAfter("playerSpawn", this.spawnSubscription);
        // Subscribe to player leave
        this.leaveSubscription = (ev) => {
            const player = this.playersById.get(ev.player.id);
            if (!player)
                return;
            this.playersByName.delete(player.name);
            this.playersById.delete(ev.player.id);
        };
        EventCoordinator.subscribeBefore("playerLeave", this.leaveSubscription);
        // Start periodic cleanup of ghost players
        this.cleanupInterval = system.runInterval(() => this.reconcileCache(), this.CLEANUP_INTERVAL_TICKS);
    }
    /**
     * Removes any cached players that are no longer online.
     * Ensures the cache doesn't retain "ghost" players if leave events fail.
     */
    static reconcileCache() {
        const onlinePlayers = world.getPlayers();
        const onlineIds = new Set(onlinePlayers.map((p) => p.id));
        for (const [id, player] of this.playersById) {
            if (!onlineIds.has(id)) {
                this.playersById.delete(id);
                this.playersByName.delete(player.name);
            }
        }
    }
    /** Returns an iterator of all currently cached player names */
    static *getPlayerNames() {
        yield* this.playersByName.keys();
    }
    /** Returns a cached player by their unique ID */
    static getPlayerById(id) {
        return this.playersById.get(id);
    }
    /** Returns a cached player by their exact username */
    static getPlayerByName(name) {
        return this.playersByName.get(name);
    }
    /** Iterator over all cached players */
    static getPlayers() {
        return this.playersById.values();
    }
    /** Iterator over [ID, Player] entries */
    static entries() {
        return this.playersById.entries();
    }
    /** Iterator over players whose IDs exist in the provided Set */
    static *filterByIds(ids) {
        for (const id of ids) {
            const player = this.playersById.get(id);
            if (player)
                yield player;
        }
    }
    /** Number of currently cached players */
    static size() {
        return this.playersById.size;
    }
    /** Clears the cache, unsubscribes from events, and stops auto-cleanup */
    static destroy() {
        this.playersById.clear();
        this.playersByName.clear();
        if (this.spawnSubscription) {
            EventCoordinator.unsubscribeAfter("playerSpawn", this.spawnSubscription);
            this.spawnSubscription = undefined;
        }
        if (this.leaveSubscription) {
            EventCoordinator.unsubscribeBefore("playerLeave", this.leaveSubscription);
            this.leaveSubscription = undefined;
        }
        if (this.cleanupInterval !== undefined) {
            system.clearRun(this.cleanupInterval);
            this.cleanupInterval = undefined;
        }
        this.initialized = false;
    }
}
