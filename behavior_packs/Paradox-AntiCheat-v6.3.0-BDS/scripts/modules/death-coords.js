import { Player } from "@minecraft/server";
import { EventCoordinator } from "../classes/event-coordinator.js";
/**
 * Reference to the death event subscription.
 */
let deathSubscription;
/**
 * Starts the Death Coordinates module.
 * Subscribes to entity death events and notifies players of their coordinates.
 */
export function startDeathCoords() {
    if (deathSubscription)
        return;
    deathSubscription = (event) => {
        const deadEntity = event.deadEntity;
        // Ensure the entity that died is a player
        if (deadEntity instanceof Player) {
            const { x, y, z } = deadEntity.location;
            const dimension = deadEntity.dimension.id.split(":")[1].replace(/_/g, " ");
            // Send the formatted coordinate message to the player
            deadEntity.sendMessage(`§2[§7Paradox§2]§o§7 You died at: §f${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)} §7in §f${dimension}§7.`);
        }
    };
    EventCoordinator.subscribeAfter("entityDie", deathSubscription);
}
/**
 * Stops the Death Coordinates module.
 * Unsubscribes from the death event to clean up resources.
 */
export function stopDeathCoords() {
    if (!deathSubscription)
        return;
    EventCoordinator.unsubscribeAfter("entityDie", deathSubscription);
    deathSubscription = undefined;
}
