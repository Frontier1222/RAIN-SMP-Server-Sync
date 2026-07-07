import { world, system, Player, InputButton, ButtonState, EntityDamageCause } from "@minecraft/server";
import { PlayerCache } from "../../classes/player-cache.js";
import { EventCoordinator } from "../../classes/event-coordinator.js";
let runId;
let jobId = null;
let inputSubscription;
let leaveSubscription;
let hurtSubscription;
/**
 * Stores jump timing data to detect double-taps.
 */
const jumpCounters = new Map();
/**
 * Stores remaining air impulse charges.
 */
const remainingJumps = new Map();
/**
 * Tracks players who have performed a double jump and are immune to the next fall damage.
 */
const activeDoubleJumpers = new Set();
/**
 * Generator function to identify players on the ground and reset their jump charges.
 * Using PlayerCache.getPlayers() for better performance.
 */
function* groundCheckGenerator() {
    for (const player of PlayerCache.getPlayers()) {
        if (player.isOnGround) {
            remainingJumps.set(player.id, 2);
            activeDoubleJumpers.delete(player.id);
        }
        yield; // Slice execution after each player
    }
}
/**
 * Executes the ground check logic as a background job.
 */
async function executeGroundCheck() {
    if (jobId !== null)
        return;
    await new Promise((resolve) => {
        function* runner() {
            try {
                yield* groundCheckGenerator();
            }
            finally {
                jobId = null;
                resolve();
            }
        }
        jobId = system.runJob(runner());
    });
}
/**
 * Handles raw button inputs. Filters for the Jump button and increments
 * jump counters for double-tap detection.
 */
function handleButtonInput(event) {
    // Filter for the jump button pressed state since the coordinator doesn't support subscription options
    if (event.button !== InputButton.Jump || event.newButtonState !== ButtonState.Pressed)
        return;
    const player = event.player;
    const playerId = player.id;
    const currentTick = system.currentTick;
    let data = jumpCounters.get(playerId);
    if (!data) {
        data = { tick: 0, count: 0 };
        jumpCounters.set(playerId, data);
    }
    // If more than 10 ticks have passed since the last press, reset the double-tap count
    if (currentTick - data.tick >= 10) {
        data.count = 1;
    }
    else {
        data.count++;
        if (data.count >= 2) {
            data.count = 0;
            applyDoubleJump(player);
        }
    }
    data.tick = currentTick;
}
/**
 * Applies a vertical impulse if the player has charges remaining.
 */
function applyDoubleJump(player) {
    const charges = remainingJumps.get(player.id) ?? 0;
    if (charges <= 1)
        return; // Charge 2 is the double jump charge
    remainingJumps.set(player.id, charges - 1);
    player.applyImpulse({ x: 0, y: 0.7, z: 0 });
    activeDoubleJumpers.add(player.id);
}
/**
 * Prevents fall damage if the player is currently in a double-jump state.
 */
function handleHurt(event) {
    if (!(event.hurtEntity instanceof Player))
        return;
    if (event.damageSource.cause !== EntityDamageCause.fall)
        return;
    if (activeDoubleJumpers.has(event.hurtEntity.id)) {
        event.damage = 0;
    }
}
/**
 * Cleans up player data when they leave to prevent memory leaks.
 */
function handlePlayerLeave(event) {
    jumpCounters.delete(event.playerId);
    remainingJumps.delete(event.playerId);
    activeDoubleJumpers.delete(event.playerId);
}
/**
 * Starts the high-performance Double Jump module.
 */
export function startDoubleJump() {
    if (runId)
        return;
    EventCoordinator.subscribeAfter("playerButtonInput", handleButtonInput);
    EventCoordinator.subscribeBefore("entityHurt", handleHurt);
    EventCoordinator.subscribeAfter("playerLeave", handlePlayerLeave);
    inputSubscription = handleButtonInput;
    leaveSubscription = handlePlayerLeave;
    hurtSubscription = handleHurt;
    let isRunning = false;
    let runIdBackup;
    runId = system.runInterval(async () => {
        if (isRunning) {
            system.clearRun(runId);
            runId = runIdBackup;
            return;
        }
        runIdBackup = runId;
        isRunning = true;
        await executeGroundCheck();
        isRunning = false;
    }, 1);
}
/**
 * Stops the module and clears all tracked data.
 */
export function stopDoubleJump() {
    if (runId)
        system.clearRun(runId);
    if (inputSubscription)
        EventCoordinator.unsubscribeAfter("playerButtonInput", inputSubscription);
    if (hurtSubscription)
        EventCoordinator.unsubscribeBefore("entityHurt", hurtSubscription);
    if (leaveSubscription)
        EventCoordinator.unsubscribeAfter("playerLeave", leaveSubscription);
    if (jobId !== null)
        system.clearJob(jobId);
    jumpCounters.clear();
    remainingJumps.clear();
    activeDoubleJumpers.clear();
    runId = undefined;
    jobId = null;
}
/**
 * Command to toggle the Double Jump utility.
 */
export const doubleJumpCommand = {
    name: "doublejump",
    description: "Toggle the high-performance double jump utility.",
    usage: "{prefix}doublejump",
    examples: ["{prefix}doublejump"],
    category: "Utility",
    securityClearance: 4,
    icon: "textures/ui/jump_boost_effect",
    guiInstructions: {
        formType: "ActionFormData",
        title: "Double Jump Utility",
        description: "Enable or disable the mid-air double jump functionality for all players.\n\n" +
            "§7• When enabled, players can double-tap the jump button in mid-air to receive a vertical boost.\n" +
            "§7• Charges reset automatically upon touching the ground.\n\n",
        actions: [{ name: "Toggle Double Jump", icon: "textures/ui/refresh_light" }],
    },
    execute: (message) => {
        if (!message)
            return;
        if (runId !== undefined) {
            stopDoubleJump();
            world.setDynamicProperty("doubleJumpEnabled", false);
            message.sender.sendMessage("§2[§7Paradox§2]§o§7 Double Jump utility: §4Disabled");
        }
        else {
            startDoubleJump();
            world.setDynamicProperty("doubleJumpEnabled", true);
            message.sender.sendMessage("§2[§7Paradox§2]§o§7 Double Jump utility: §aEnabled");
        }
    },
};
