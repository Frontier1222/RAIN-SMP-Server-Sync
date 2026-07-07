import { world } from "@minecraft/server";
import { EventCoordinator } from "../classes/event-coordinator.js";
// High-performance runtime cache
let activeBans = new Set();
/**
 * Refreshes the in-memory ban cache from the world's dynamic properties.
 * This should be called on startup and whenever the global ban list is modified.
 */
export function refreshGlobalBanCache() {
    try {
        const banData = world.getDynamicProperty("globalBannedPlayers");
        if (!banData)
            return;
        const parsed = JSON.parse(banData);
        if (Array.isArray(parsed)) {
            activeBans = new Set(parsed.map((n) => n.toLowerCase()));
        }
    }
    catch (err) {
        console.error("[Paradox] Failed to refresh global ban cache:", err);
    }
}
/**
 * Registers the global ban check to run automatically on player join.
 */
export function initializeGlobalBanCheck() {
    // Perform the initial load into memory
    refreshGlobalBanCache();
    // We use playerSpawn (after) to ensure the player object is fully valid in the world
    EventCoordinator.subscribeAfter("playerSpawn", (event) => {
        // initialSpawn is true only when the player first joins the session
        if (!event.initialSpawn)
            return;
        const { player } = event;
        // O(1) lookup against the in-memory cache
        if (activeBans.has(player.name.toLowerCase())) {
            // Kick the player immediately with a custom message
            player.runCommand(`kick @s You are globally banned.`);
        }
    });
}
