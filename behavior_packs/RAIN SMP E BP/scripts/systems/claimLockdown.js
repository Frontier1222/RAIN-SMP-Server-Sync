import { world, system } from "@minecraft/server";

export const CLAIM_LOCKDOWN_TAG = "claim_lockdown";
const LOCKDOWN_KEY = "nf.claim_lockdown";

function readStore() {
    const raw = world.getDynamicProperty(LOCKDOWN_KEY);
    if (typeof raw !== "string" || !raw.length) return {};
    try {
        const obj = JSON.parse(raw);
        return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
        return {};
    }
}

function writeStore(store) {
    world.setDynamicProperty(LOCKDOWN_KEY, JSON.stringify(store));
}

export function getClaimLockdownRecord(name) {
    const key = String(name || "").trim();
    if (!key) return null;
    return readStore()[key] || null;
}

export function isClaimLockdownPlayer(player) {
    return !!player?.hasTag(CLAIM_LOCKDOWN_TAG);
}

export function syncClaimLockdownTag(player) {
    if (!player?.isValid) return;
    const record = getClaimLockdownRecord(player.name);
    if (record) {
        if (!player.hasTag(CLAIM_LOCKDOWN_TAG)) player.addTag(CLAIM_LOCKDOWN_TAG);
    } else if (player.hasTag(CLAIM_LOCKDOWN_TAG)) {
        player.removeTag(CLAIM_LOCKDOWN_TAG);
    }
}

/** Staff-applied worldwide enter ban — only staff can remove it. */
export function applyClaimLockdown(targetName, adminName) {
    const name = String(targetName || "").trim();
    if (!name) return false;

    const store = readStore();
    store[name] = {
        by: String(adminName || "Staff"),
        at: Date.now(),
    };
    writeStore(store);

    for (const player of world.getAllPlayers()) {
        if (player.name.toLowerCase() === name.toLowerCase()) {
            syncClaimLockdownTag(player);
        }
    }

    return true;
}

export function clearClaimLockdown(targetName) {
    const name = String(targetName || "").trim();
    if (!name) return false;

    const store = readStore();
    let removed = false;
    for (const key of Object.keys(store)) {
        if (key.toLowerCase() === name.toLowerCase()) {
            delete store[key];
            removed = true;
            break;
        }
    }
    if (!removed) return false;

    writeStore(store);

    for (const player of world.getAllPlayers()) {
        if (player.name.toLowerCase() === name.toLowerCase()) {
            syncClaimLockdownTag(player);
        }
    }

    return true;
}

export function listClaimLockdownNames() {
    return Object.keys(readStore());
}

function isPlotOwnerOrMember(plot, player) {
    if (!plot || !player) return false;
    if (plot.ownerId === player.id) return true;
    if (String(plot.ownerName || "").toLowerCase() === player.name.toLowerCase()) return true;

    const pName = player.name.toLowerCase();
    if (Array.isArray(plot.members) && plot.members.map((n) => String(n).toLowerCase()).includes(pName)) {
        return true;
    }
    if (Array.isArray(plot.trusted) && plot.trusted.map((n) => String(n).toLowerCase()).includes(pName)) {
        return true;
    }

    return false;
}

/** Lockdown players cannot enter claims they do not own or belong to. */
export function shouldClaimLockdownBlockEnter(player, plot) {
    if (!isClaimLockdownPlayer(player) || !plot) return false;
    return !isPlotOwnerOrMember(plot, player);
}

/** Lockdown players follow normal PVP rules everywhere (like bounty targets). */
export function allowsClaimLockdownPvp(player) {
    return isClaimLockdownPlayer(player);
}

export function initClaimLockdownRuntime() {
    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            system.run(() => syncClaimLockdownTag(event.player));
        });
    }
}
