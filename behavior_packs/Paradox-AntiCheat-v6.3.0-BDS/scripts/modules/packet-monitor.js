import { system } from "@minecraft/server";
let beforeEvents;
/**
 * Maximum packets allowed in TIME_WINDOW.
 */
const SPAM_THRESHOLD = 250;
/**
 * Time window in milliseconds.
 */
const TIME_WINDOW = 5000;
/**
 * Cleanup interval in ticks.
 */
const CLEANUP_INTERVAL_TICKS = 1200;
/**
 * Packets ignored during monitoring.
 */
const IGNORED_PACKETS = new Set(["PlayerAuthInputPacket", "SubChunkRequestPacket", "ClientCacheBlobStatusPacket"]);
/**
 * Fixed buffer size.
 */
const BUFFER_SIZE = SPAM_THRESHOLD * 2;
/**
 * Ring buffer structure for packet timestamps.
 */
class TimestampBuffer {
    buffer = new Array(BUFFER_SIZE);
    start = 0;
    count = 0;
    push(timestamp) {
        const index = (this.start + this.count) % BUFFER_SIZE;
        this.buffer[index] = timestamp;
        if (this.count < BUFFER_SIZE) {
            this.count++;
        }
        else {
            this.start = (this.start + 1) % BUFFER_SIZE;
        }
    }
    prune(now) {
        while (this.count > 0) {
            const ts = this.buffer[this.start];
            if (now - ts <= TIME_WINDOW)
                break;
            this.start = (this.start + 1) % BUFFER_SIZE;
            this.count--;
        }
    }
    size() {
        return this.count;
    }
    empty() {
        return this.count === 0;
    }
}
/**
 * packetId -> playerName -> buffer
 */
const packetFrequency = new Map();
/**
 * Last warning timestamps.
 */
const lastWarning = new Map();
let cleanupTaskId;
/**
 * Checks packet spam using ring buffers.
 */
function checkPacketSpam(packetId, playerName) {
    const now = Date.now();
    let playerMap = packetFrequency.get(packetId);
    if (!playerMap) {
        playerMap = new Map();
        packetFrequency.set(packetId, playerMap);
    }
    let buffer = playerMap.get(playerName);
    if (!buffer) {
        buffer = new TimestampBuffer();
        playerMap.set(playerName, buffer);
    }
    buffer.push(now);
    buffer.prune(now);
    if (buffer.size() > SPAM_THRESHOLD) {
        const key = packetId + "|" + playerName;
        const last = lastWarning.get(key) ?? 0;
        if (now - last > TIME_WINDOW) {
            console.warn(`[Paradox] Potential spam detected | Packet: ${packetId} | Count: ${buffer.size()} | Player: ${playerName}`);
            lastWarning.set(key, now);
        }
    }
}
/**
 * Packet receive callback.
 */
const packetReceiveCallback = (event) => {
    const packetId = event.packetId;
    if (IGNORED_PACKETS.has(packetId))
        return;
    const playerName = event.sender?.isValid ? event.sender.name : "Unknown";
    checkPacketSpam(packetId, playerName);
};
/**
 * Memory cleanup task.
 */
function runCleanup() {
    const now = Date.now();
    for (const [packetId, playerMap] of packetFrequency) {
        for (const [playerName, buffer] of playerMap) {
            buffer.prune(now);
            if (buffer.empty()) {
                playerMap.delete(playerName);
            }
        }
        if (playerMap.size === 0) {
            packetFrequency.delete(packetId);
        }
    }
    for (const [key, time] of lastWarning) {
        if (now - time > TIME_WINDOW) {
            lastWarning.delete(key);
        }
    }
}
/**
 * Starts packet monitoring.
 */
export async function startPacketListener() {
    const networkModule = await import("@minecraft/server-net").catch(() => null);
    if (!networkModule) {
        console.warn("[Paradox] server-net unavailable. Packet monitor disabled.");
        return false;
    }
    beforeEvents = networkModule.beforeEvents;
    beforeEvents.packetReceive.subscribe(packetReceiveCallback);
    if (cleanupTaskId === undefined) {
        cleanupTaskId = system.runInterval(runCleanup, CLEANUP_INTERVAL_TICKS);
    }
    console.log("[Paradox] Packet spam detection initialized.");
    return true;
}
/**
 * Stops packet monitoring.
 */
export function stopPacketListener() {
    if (beforeEvents) {
        beforeEvents.packetReceive.unsubscribe(packetReceiveCallback);
    }
    if (cleanupTaskId !== undefined) {
        system.clearRun(cleanupTaskId);
        cleanupTaskId = undefined;
    }
    packetFrequency.clear();
    lastWarning.clear();
    console.log("[Paradox] Packet spam detection stopped.");
}
