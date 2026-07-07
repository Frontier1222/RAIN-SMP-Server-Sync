import { world } from '@minecraft/server';

// Map to store timestamps of clicks for each player
const playerClickMap = new Map();

/**
 * Records a click for a player using the current real-world time.
 */
function noteHit(player) {
    const id = player.id;
    const now = Date.now();
    
    if (!playerClickMap.has(id)) {
        playerClickMap.set(id, []);
    }
    
    playerClickMap.get(id).push(now);
}

/**
 * Returns the number of clicks in the last 1000ms.
 * Also cleans up old clicks to keep the Realm fast.
 */
export function getPlayerCPS(player) {
    const id = player.id;
    const clicks = playerClickMap.get(id);
    if (!clicks) return 0;

    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove clicks older than 1 second
    while (clicks.length > 0 && clicks[0] < oneSecondAgo) {
        clicks.shift();
    }

    // If no clicks left, clean up the Map to save memory
    if (clicks.length === 0) {
        playerClickMap.delete(id);
        return 0;
    }

    return clicks.length;
}

// Cleanup when players leave
world.afterEvents.playerLeave.subscribe(e => playerClickMap.delete(e.playerId));

export default {
  name: 'entityHitEntity',
  type: 1, // afterEvents
  run: ev => {
    const player = ev.damagingEntity;
    if (player?.typeId !== 'minecraft:player') return;
    noteHit(player);
  }
};