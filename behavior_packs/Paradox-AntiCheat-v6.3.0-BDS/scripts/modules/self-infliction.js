import { Player } from "@minecraft/server";
import { banlistDB } from "../event-listeners/world-initialize.js";
import { EventCoordinator } from "../classes/event-coordinator.js";
/**
 * Handle the entity hit event to check if the attacker attacked themselves.
 * If so, kick the attacker from the world.
 * @param eventData - The event data containing information about the hit.
 * @returns {Promise<void>}
 */
async function handleSelfAttack(eventData) {
    const attacker = eventData.damagingEntity;
    const victim = eventData.hitEntity;
    if (!(attacker instanceof Player && victim instanceof Player))
        return;
    if (attacker.id !== victim.id)
        return;
    const reason = "Using a client to attack oneself";
    const bannedPlayers = banlistDB.get("players") ?? {};
    if (!(attacker.name in bannedPlayers)) {
        bannedPlayers[attacker.name] = {
            reason,
            bannedBy: "System",
            timestamp: Date.now(),
        };
        await banlistDB.set("players", bannedPlayers);
    }
    attacker.runCommand(`kick @s ${reason}`);
}
/**
 * Initialize the self-attack detection system.
 */
export function startSelfAttackCheck() {
    // Process the entity hit events
    EventCoordinator.subscribeAfter("entityHitEntity", handleSelfAttack);
}
/**
 * Stop the self-attack detection system.
 */
export function stopSelfAttackCheck() {
    // Process the entity hit events
    EventCoordinator.unsubscribeAfter("entityHitEntity", handleSelfAttack);
}
