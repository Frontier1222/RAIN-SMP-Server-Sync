import { world, system } from "@minecraft/server";
import { notify, toastDeny } from "../utils/realmPerf.js";

export const BOUNTY_TARGET_TAG = "bounty_target";
const BOUNTIES_KEY = "nf.bounties";

function readStore() {
    const raw = world.getDynamicProperty(BOUNTIES_KEY);
    if (typeof raw !== "string" || !raw.length) return {};
    try {
        const obj = JSON.parse(raw);
        return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
        return {};
    }
}

function writeStore(store) {
    world.setDynamicProperty(BOUNTIES_KEY, JSON.stringify(store));
}

export function getAllBounties() {
    return readStore();
}

export function getBounty(targetName) {
    const name = String(targetName || "").trim();
    if (!name) return null;
    return readStore()[name] || null;
}

export function isBountyTarget(player) {
    return !!player?.hasTag(BOUNTY_TARGET_TAG);
}

export function syncBountyTag(player) {
    if (!player?.isValid) return;
    const bounty = getBounty(player.name);
    if (bounty) {
        if (!player.hasTag(BOUNTY_TARGET_TAG)) player.addTag(BOUNTY_TARGET_TAG);
    } else if (player.hasTag(BOUNTY_TARGET_TAG)) {
        player.removeTag(BOUNTY_TARGET_TAG);
    }
}

export function placeBounty(targetName, amount, placedBy) {
    const name = String(targetName || "").trim();
    const reward = Math.max(0, Math.floor(Number(amount) || 0));
    if (!name || reward <= 0) return false;

    const store = readStore();
    store[name] = {
        amount: reward,
        placedBy: String(placedBy || "Unknown"),
        placedAt: Date.now(),
    };
    writeStore(store);

    for (const player of world.getAllPlayers()) {
        if (player.name === name) syncBountyTag(player);
    }

    return true;
}

export function clearBounty(targetName) {
    const name = String(targetName || "").trim();
    if (!name) return false;

    const store = readStore();
    if (!store[name]) return false;
    delete store[name];
    writeStore(store);

    for (const player of world.getAllPlayers()) {
        if (player.name === name) syncBountyTag(player);
    }

    return true;
}

/** Bounty targets may be attacked even in PVP-disabled claims / safe zones. */
export function allowsBountyPvp(victim) {
    return isBountyTarget(victim);
}

/** Bounty targets cannot open containers in claims they do not own. */
export function blocksBountyContainerAccess(player, plot) {
    if (!player || !plot || !isBountyTarget(player)) return false;
    if (plot.ownerId === player.id) return false;
    if (String(plot.ownerName || plot.owner || "").toLowerCase() === player.name.toLowerCase()) return false;
    if (Array.isArray(plot.members) && plot.members.map((n) => String(n).toLowerCase()).includes(player.name.toLowerCase())) {
        return false;
    }
    return true;
}

export function denyBountyContainer(player) {
    toastDeny(player, "§cBounty targets cannot open chests in other players' claims.", "bounty_no_chest");
}

export function initBountyRuntime() {
    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            system.run(() => syncBountyTag(event.player));
        });
    }
}
