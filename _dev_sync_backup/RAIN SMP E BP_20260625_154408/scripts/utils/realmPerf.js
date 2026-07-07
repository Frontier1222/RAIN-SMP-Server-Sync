import { system, world } from "@minecraft/server";

/** Shared tick cadence — BDS can run faster loops than Realms. */
export const REALM_TICK = {
    FAST: 2,
    NORMAL: 5,
    MEDIUM: 10,
    SLOW: 40,
    CACHE_FALLBACK: 600,
};

/** Stagger cadence inside the master loop (loop passes, not game ticks). */
export const REALM_STAGGER = {
    MEDIUM: 1,
    SLOW: 2,
    /** Backup item-security + Rain GUI sweep */
    ITEM_MAINT: 4,
    BORDER_BATCH: 2,
    SLOW_MAINT_BATCH: 2,
    NAMETAG_BATCH: 2,
    BUILDER_CLEANUP_BATCH: 2,
};

let realmFrame = 0;
let cachedRealmPlayers = [];
let realmPlayersById = new Map();
let realmPlayerRot = 0;
const realmHooks = [];
const auxHooks = [];
let auxLoopStarted = false;

/** Register work to run from the main Realm loop (everyFrames = master-loop passes, not game ticks). */
export function registerRealmHook(everyFrames, fn) {
    if (typeof fn !== "function" || everyFrames < 1) return;
    realmHooks.push({ everyFrames, fn });
}

export function runRealmHooks(frame, players, now) {
    for (const hook of realmHooks) {
        if (!onRealmFrame(hook.everyFrames, frame)) continue;
        try {
            hook.fn(players, now, frame);
        } catch (e) {}
    }
}

/** Call once per master loop to drive staggered sub-tasks (counts loop passes, not game ticks). */
export function nextRealmFrame() {
    realmFrame = (realmFrame + 1) % 1200;
    return realmFrame;
}

export function onRealmFrame(everyTicks, frame = realmFrame) {
    return everyTicks > 0 && frame % everyTicks === 0;
}

/** Refresh once per loop pass — avoids repeated getAllPlayers() in the same tick. */
export function refreshRealmPlayers() {
    try {
        cachedRealmPlayers = world.getAllPlayers();
        realmPlayersById = new Map();
        for (const player of cachedRealmPlayers) {
            if (player?.id) realmPlayersById.set(player.id, player);
        }
    } catch (e) {
        cachedRealmPlayers = [];
        realmPlayersById = new Map();
    }
    return cachedRealmPlayers;
}

export function getRealmPlayers() {
    return cachedRealmPlayers;
}

/** Tag check against the cached player list from the latest refreshRealmPlayers() call. */
export function anyCachedPlayerHasTag(tag) {
    if (!tag) return false;
    for (const player of cachedRealmPlayers) {
        try {
            if (player?.hasTag(tag)) return true;
        } catch (e) {}
    }
    return false;
}

/** Cached players with a tag — avoids repeated world.getAllPlayers() in hot paths. */
export function getCachedPlayersWithTag(tag) {
    if (!tag) return [];
    const out = [];
    for (const player of cachedRealmPlayers) {
        try {
            if (player?.hasTag(tag)) out.push(player);
        } catch (e) {}
    }
    return out;
}

/** O(1) lookup — uses cache from the latest refreshRealmPlayers() call. */
export function getRealmPlayerById(playerId) {
    if (!playerId) return null;
    return realmPlayersById.get(playerId) ?? null;
}

/** Register lightweight work for the 10-tick aux loop (gamemode, decor guard, etc.). */
export function registerRealmAuxHook(fn) {
    if (typeof fn !== "function") return;
    auxHooks.push(fn);
}

/** One shared aux loop (20 ticks) — actionbar batching; avoid 10-tick loops on Realms. */
export function startRealmAuxLoop(intervalTicks = REALM_TICK.NORMAL) {
    if (auxLoopStarted) return;
    auxLoopStarted = true;

    system.runInterval(() => {
        const players = cachedRealmPlayers.length ? cachedRealmPlayers : refreshRealmPlayers();
        for (const hook of auxHooks) {
            try {
                hook(players);
            } catch (e) {}
        }
    }, intervalTicks);
}

/** Round-robin N players for staggered per-player work inside a loop pass. */
export function nextRealmPlayerBatch(players = cachedRealmPlayers, count = 1) {
    if (!players?.length || count < 1) return [];

    const batch = [];
    for (let i = 0; i < count; i++) {
        const player = nextRealmPlayer(players);
        if (player) batch.push(player);
    }
    return batch;
}

/** Round-robin one player for staggered heavy work. */
export function nextRealmPlayer(players = cachedRealmPlayers) {
    if (!players?.length) return null;
    realmPlayerRot = (realmPlayerRot + 1) % players.length;
    return players[realmPlayerRot];
}

/** Small radius for liquid/fire cleanup ? full 16-block scans lag Realms badly. */
export const REALM_CLEANUP_RADIUS = { horizontal: 4, vertical: 4 };

let cleanupPlayerRot = 0;

/** Process one player per cleanup tick instead of scanning for everyone at once. */
export function nextCleanupPlayer(players) {
    if (!players?.length) return null;
    cleanupPlayerRot = (cleanupPlayerRot + 1) % players.length;
    return players[cleanupPlayerRot];
}

// --- Builder / tester gamemode change (hub → inventory vault) ---
let builderTesterGamemodeHandler = null;

export function setBuilderTesterGamemodeHandler(fn) {
    builderTesterGamemodeHandler = typeof fn === "function" ? fn : null;
}

/** Hub calls this with the mode before/after switch so loot is stashed immediately. */
export function runBuilderTesterGamemodeChange(player, fromMode, toMode) {
    if (!player?.id || !fromMode || !toMode || fromMode === toMode) return;
    if (!builderTesterGamemodeHandler) return;

    system.run(() => {
        try {
            builderTesterGamemodeHandler(player, fromMode, toMode);
        } catch (e) {}
    });
}

// --- Toast notifications (_r4ui) ---
const toastCooldowns = new Map();
export const DEFAULT_TOAST_COOLDOWN_MS = 5000;
const MC = "\u00A7";

export function formatToast(title, body = "") {
    const t = String(title ?? "");
    if (t.startsWith("_r4ui:")) return t;
    return `_r4ui:toast_1.tip.${t}${body ? `${MC}r\n${body}` : ""}`;
}

function sendToast(player, toastKey, message, sound = "random.orb", cooldownMs = DEFAULT_TOAST_COOLDOWN_MS) {
    if (!player) return false;

    const now = Date.now();
    const key = `${player.id}:${toastKey}`;
    const last = toastCooldowns.get(key) || 0;

    if (now - last < cooldownMs) return false;

    toastCooldowns.set(key, now);

    const formatted = String(message ?? "").startsWith("_r4ui:")
        ? String(message)
        : formatToast(message);

    system.run(() => {
        try {
            player.sendMessage(formatted);
        } catch (e) {}

        try {
            if (sound) player.playSound(sound);
        } catch (e) {}
    });

    return true;
}

export function notify(player, key, title, body = "", sound = "random.orb", cooldownMs = DEFAULT_TOAST_COOLDOWN_MS, volume = 1) {
    if (!player) return false;

    const now = Date.now();
    const cacheKey = `${player.id}:${key}`;
    const last = toastCooldowns.get(cacheKey) || 0;

    if (now - last < cooldownMs) return false;

    toastCooldowns.set(cacheKey, now);

    const message = formatToast(title, body);
    const soundVolume = Number.isFinite(volume) ? Math.max(0, Math.min(volume, 1)) : 1;

    system.run(() => {
        try {
            player.sendMessage(message);
        } catch (e) {}

        try {
            if (sound) {
                if (soundVolume < 1) {
                    player.playSound(sound, { volume: soundVolume });
                } else {
                    player.playSound(sound);
                }
            }
        } catch (e) {}
    });

    return true;
}

export function toast(player, message, key = "toast", sound = "random.orb", cooldownMs = DEFAULT_TOAST_COOLDOWN_MS) {
    return sendToast(player, key, message, sound, cooldownMs);
}

export function toastError(player, message, key = "error") {
    const text = String(message ?? "").trim();
    const body = text.startsWith(MC) ? text : `${MC}c${text}`;
    return notify(player, key, `${MC}c${MC}l[ERROR]${MC}r`, body, "note.bass");
}

export function toastSuccess(player, message, key = "success") {
    const text = String(message ?? "").trim();
    const body = text.startsWith(MC) ? text : `${MC}a${text}`;
    return notify(player, key, `${MC}a${MC}l[SUCCESS]${MC}r`, body, "random.levelup");
}

export function toastInfo(player, message, key = "info") {
    const text = String(message ?? "").trim();
    const body = text.startsWith(MC) ? text : `${MC}e${text}`;
    return notify(player, key, `${MC}e${MC}l[INFO]${MC}r`, body, "random.orb");
}

export function toastWarning(player, message, key = "warning") {
    const text = String(message ?? "").trim();
    const body = text.startsWith(MC) ? text : `${MC}6${text}`;
    return notify(player, key, `${MC}6${MC}l[WARNING]${MC}r`, body, "note.bass");
}

export function toastDeny(player, message, key = "deny", sound = "note.bass") {
    const text = String(message ?? "");
    if (text.startsWith("_r4ui:")) {
        return toast(player, text, key, sound);
    }
    return toast(player, formatToast(`${MC}c` + text.replace(new RegExp(`^${MC}c\\s*`), "")), key, sound);
}

/** Drop stale toast cooldown keys so long-running Realms do not grow memory forever. */
export function pruneToastCooldowns(maxAgeMs = 300_000) {
    if (toastCooldowns.size < 128) return;

    const now = Date.now();
    for (const [key, ts] of toastCooldowns) {
        if (now - ts > maxAgeMs) toastCooldowns.delete(key);
    }
}

/** Clear stuck _r4ui title left by broken toast experiment (restores invisible HUD). */
if (world.afterEvents?.playerSpawn) {
    world.afterEvents.playerSpawn.subscribe(({ player }) => {
        system.runTimeout(() => {
            try {
                player.onScreenDisplay.setTitle("");
            } catch (e) {}
        }, 5);
    });
}
