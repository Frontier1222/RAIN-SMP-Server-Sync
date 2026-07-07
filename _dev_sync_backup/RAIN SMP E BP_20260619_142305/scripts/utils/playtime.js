import { registerRealmHook, REALM_STAGGER } from "./realmPerf.js";

export const PLAYTIME_KEY = "bd_playtime_ms";
const PLAYTIME_FLUSH_INTERVAL_MS = 60_000;
const MAX_DELTA_MS = 120_000;

const playtimeLastMs = new Map();
const playtimePendingMs = new Map();
const playtimeBaseMs = new Map();
const playtimeLastFlushMs = new Map();

function clampNonNegative(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function formatPlaytimeDHMS(ms) {
    const s = Math.floor(clampNonNegative(ms) / 1000);
    return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
}

function getPersistedPlaytimeMs(player) {
    const key = player.id;
    if (playtimeBaseMs.has(key)) return playtimeBaseMs.get(key);

    const val = clampNonNegative(player.getDynamicProperty(PLAYTIME_KEY));
    playtimeBaseMs.set(key, val);
    return val;
}

/** Committed + pending playtime (updated on each tickPlayerPlaytime call). */
export function totalPlaytimeMsFor(player) {
    return getPersistedPlaytimeMs(player) + (playtimePendingMs.get(player.id) ?? 0);
}

/** Wall-clock playtime for HUD — includes elapsed time since the last tick (smooth seconds). */
export function livePlaytimeMsFor(player) {
    const id = player.id;
    const base = getPersistedPlaytimeMs(player) + (playtimePendingMs.get(id) ?? 0);
    const last = playtimeLastMs.get(id);
    if (last === undefined) return base;

    const elapsed = Date.now() - last;
    if (elapsed <= 0) return base;
    return base + Math.min(elapsed, MAX_DELTA_MS);
}

function maybeFlushPlaytime(player, now) {
    const key = player.id;
    const last = playtimeLastFlushMs.get(key) ?? 0;
    if (now - last < PLAYTIME_FLUSH_INTERVAL_MS) return;

    const pending = playtimePendingMs.get(key) ?? 0;
    if (pending > 0) {
        const next = getPersistedPlaytimeMs(player) + pending;
        playtimeBaseMs.set(key, next);
        playtimePendingMs.set(key, 0);
        player.setDynamicProperty(PLAYTIME_KEY, next);
    }

    playtimeLastFlushMs.set(key, now);
}

export function tickPlayerPlaytime(player, now = Date.now()) {
    if (!player?.id) return;

    const id = player.id;
    const last = playtimeLastMs.get(id);

    if (last === undefined) {
        playtimeLastMs.set(id, now);
        return;
    }

    let delta = now - last;
    if (delta <= 0) return;
    if (delta > MAX_DELTA_MS) delta = MAX_DELTA_MS;

    playtimeLastMs.set(id, now);
    playtimePendingMs.set(id, (playtimePendingMs.get(id) ?? 0) + delta);
    maybeFlushPlaytime(player, now);
}

export function flushPlaytimeNow(player) {
    if (!player?.id) return;

    const pending = playtimePendingMs.get(player.id) ?? 0;
    if (pending > 0) {
        const next = getPersistedPlaytimeMs(player) + pending;
        playtimeBaseMs.set(player.id, next);
        playtimePendingMs.set(player.id, 0);
        player.setDynamicProperty(PLAYTIME_KEY, next);
    }

    playtimeLastFlushMs.set(player.id, Date.now());
}

export function seedPlaytimeSession(player, now = Date.now()) {
    if (!player?.id) return;
    playtimeLastMs.set(player.id, now);
}

export function clearPlaytimeSession(playerId) {
    playtimeLastMs.delete(playerId);
    playtimePendingMs.delete(playerId);
    playtimeBaseMs.delete(playerId);
    playtimeLastFlushMs.delete(playerId);
}

/** Playtime accrual only — HUD runs on the staggered aux loop for smooth timers. */
export function startPlaytimeRuntime() {
    registerRealmHook(REALM_STAGGER.MEDIUM, (players, now) => {
        if (!players?.length) return;
        for (const player of players) {
            tickPlayerPlaytime(player, now);
        }
    });
}
