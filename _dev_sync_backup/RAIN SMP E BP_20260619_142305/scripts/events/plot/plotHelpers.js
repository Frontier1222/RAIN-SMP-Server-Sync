import { world } from '@minecraft/server';

import {
    getAllGlobalClaims,
    markGlobalClaimsDirty,
    rebuildGlobalClaimChunkCache,
    getGlobalPlotAtLocation,
    getGlobalPlotsAtLocation,
} from '../../utils/plotClaimCache.js';
import { isLivePlayer, safePlayerId, safePlayerName } from '../../utils/livePlayer.js';

export {
    getAllGlobalClaims,
    markGlobalClaimsDirty,
    rebuildGlobalClaimChunkCache,
    getGlobalPlotAtLocation,
    getGlobalPlotsAtLocation,
};

// --- CONFIGURATION ---
const MAX_BUCKETS = 200;
const MAX_PLOTS_PER_BUCKET = 25;
/** Bedrock hard cap per string dynamic property. */
const MAX_BUCKET_BYTES = 32767;
/** Stay well under the cap — Realms reject writes closer to the limit. */
const TARGET_BUCKET_BYTES = 24000;

function singleClaimKey(plotId) {
    return `claim_plot_${plotId}`;
}

function collectClaimBucketKeys() {
    const keys = new Set(['claimed_plots']);
    for (let i = 2; i <= MAX_BUCKETS; i++) {
        keys.add(`claimed_plots_${i}`);
    }
    try {
        const ids = world.getDynamicPropertyIds?.();
        if (ids) {
            for (const id of ids) {
                const name = String(id);
                if (name.startsWith('claim_stage_')) continue;
                if (
                    name === 'claimed_plots' ||
                    name.startsWith('claimed_plots_') ||
                    name.startsWith('claim_plot_')
                ) {
                    keys.add(name);
                }
            }
        }
    } catch (e) {}
    return keys;
}

function readClaimBucket(key) {
    const str = world.getDynamicProperty(key);
    if (!str) return null;
    try {
        const arr = JSON.parse(str);
        return Array.isArray(arr) ? arr : null;
    } catch (e) {
        return null;
    }
}

function readSingleClaim(key) {
    const str = world.getDynamicProperty(key);
    if (!str) return null;
    try {
        const plot = JSON.parse(str);
        return plot?.id ? plot : null;
    } catch (e) {
        return null;
    }
}

function bucketPayloadSize(arr) {
    if (!Array.isArray(arr)) return Infinity;
    try {
        return JSON.stringify(arr).length;
    } catch (e) {
        return Infinity;
    }
}

function plotPayloadSize(plot) {
    try {
        return JSON.stringify(plot).length;
    } catch (e) {
        return Infinity;
    }
}

function compactPlotForStorage(plot) {
    try {
        const copy = JSON.parse(JSON.stringify(plot));
        delete copy.area;
        return copy;
    } catch (e) {
        return plot;
    }
}

function clearDynamicProperty(key) {
    try {
        world.setDynamicProperty(key, undefined);
        return true;
    } catch (e) {
        try {
            world.setDynamicProperty(key, '[]');
            return true;
        } catch (e2) {
            return false;
        }
    }
}

function writeRawProperty(key, payload, maxBytes = MAX_BUCKET_BYTES) {
    if (!payload || payload.length > maxBytes) return false;
    try {
        world.setDynamicProperty(key, payload);
        return true;
    } catch (e) {
        return false;
    }
}

function writeClaimBucket(key, arr) {
    if (!Array.isArray(arr)) return false;
    const payload = JSON.stringify(arr);
    if (!payload) return false;
    if (payload.length <= TARGET_BUCKET_BYTES) {
        return writeRawProperty(key, payload, MAX_BUCKET_BYTES);
    }
    if (payload.length <= MAX_BUCKET_BYTES) {
        return writeRawProperty(key, payload, MAX_BUCKET_BYTES);
    }
    return false;
}

function writeSingleClaim(plot) {
    const stored = compactPlotForStorage(plot);
    const payload = JSON.stringify(stored);
    if (!payload || payload.length > MAX_BUCKET_BYTES) return false;
    if (!writeRawProperty(singleClaimKey(stored.id), payload, MAX_BUCKET_BYTES)) return false;
    markGlobalClaimsDirty();
    return true;
}

function bucketHasRoom(bucket, plot) {
    const trial = bucket.concat([plot]);
    return trial.length <= MAX_PLOTS_PER_BUCKET && bucketPayloadSize(trial) <= TARGET_BUCKET_BYTES;
}

function claimBucketKey(index) {
    return index === 1 ? 'claimed_plots' : `claimed_plots_${index}`;
}

/** Reset buckets with corrupt JSON so they can be written again. */
export function healCorruptClaimBuckets() {
    let healed = 0;
    for (const key of collectClaimBucketKeys()) {
        if (key.startsWith('claim_plot_')) continue;
        const existing = world.getDynamicProperty(key);
        if (!existing) continue;
        if (readClaimBucket(key) !== null) continue;
        if (clearDynamicProperty(key)) healed++;
    }
    if (healed > 0) markGlobalClaimsDirty();
    return healed;
}

function findWritableBucketKeyFor(plotsToAdd) {
    const plots = Array.isArray(plotsToAdd) ? plotsToAdd : [plotsToAdd];
    const addSize = bucketPayloadSize(plots);
    if (addSize > MAX_BUCKET_BYTES) return null;

    for (let i = 1; i <= MAX_BUCKETS; i++) {
        const key = claimBucketKey(i);
        const existing = world.getDynamicProperty(key);
        let arr = readClaimBucket(key);

        if (existing && arr === null) {
            clearDynamicProperty(key);
            arr = [];
        }
        if (!arr) return key;

        const merged = arr.concat(plots);
        if (merged.length <= MAX_PLOTS_PER_BUCKET && bucketPayloadSize(merged) <= TARGET_BUCKET_BYTES) {
            return key;
        }
        if (merged.length <= MAX_PLOTS_PER_BUCKET && bucketPayloadSize(merged) <= MAX_BUCKET_BYTES) {
            return key;
        }
    }

    const fallbackKey = `claimed_plots_${Date.now()}`;
    return plots.length <= MAX_PLOTS_PER_BUCKET && addSize <= MAX_BUCKET_BYTES ? fallbackKey : null;
}

function rebalanceClaimBucket(key, arr) {
    if (!Array.isArray(arr) || arr.length < 2) return false;

    const half = Math.ceil(arr.length / 2);
    const keep = arr.slice(0, half);
    const move = arr.slice(half);
    const targetKey = findWritableBucketKeyFor(move);
    if (!targetKey) return false;

    const targetArr = readClaimBucket(targetKey) || [];
    const merged = targetArr.concat(move);
    if (!writeClaimBucket(targetKey, merged)) return false;
    return writeClaimBucket(key, keep);
}

function removeClaimFromBucket(key, arr, plotIndex) {
    const without = arr.filter((_, index) => index !== plotIndex);
    if (writeClaimBucket(key, without)) return true;
    return rebalanceClaimBucket(key, without);
}

function relocateClaimFromBucket(key, arr, plotIndex, plot) {
    if (!removeClaimFromBucket(key, arr, plotIndex)) return false;
    markGlobalClaimsDirty();
    return insertNewGlobalClaim(plot) !== false;
}

export function isValidClaimPlot(plot) {
    if (!plot?.id) return false;
    return (
        Number.isFinite(plot.minX) &&
        Number.isFinite(plot.maxX) &&
        Number.isFinite(plot.minZ) &&
        Number.isFinite(plot.maxZ)
    );
}

/** Replace an existing claim entry in-place (safe for permission edits). */
export function updateGlobalClaim(plot) {
    if (!isValidClaimPlot(plot)) return false;
    const stored = compactPlotForStorage(plot);

    const soloKey = singleClaimKey(stored.id);
    if (world.getDynamicProperty(soloKey) != null) {
        if (writeSingleClaim(stored)) return true;
    }

    for (const key of collectClaimBucketKeys()) {
        if (key.startsWith('claim_plot_')) continue;

        let arr = readClaimBucket(key);
        if (!arr) {
            if (world.getDynamicProperty(key) != null) {
                clearDynamicProperty(key);
            }
            continue;
        }

        const idx = arr.findIndex((p) => p && p.id === stored.id);
        if (idx === -1) continue;

        arr[idx] = stored;
        if (writeClaimBucket(key, arr)) {
            markGlobalClaimsDirty();
            return true;
        }

        if (writeSingleClaim(stored) && removeClaimFromBucket(key, arr, idx)) {
            markGlobalClaimsDirty();
            return true;
        }

        return relocateClaimFromBucket(key, arr, idx, stored);
    }

    return false;
}

/** Insert a claim that is not already stored in any bucket. */
export function insertNewGlobalClaim(plot) {
    if (!isValidClaimPlot(plot)) return false;
    const stored = compactPlotForStorage(plot);

    if (updateGlobalClaim(stored)) return true;

    for (let i = 1; i <= MAX_BUCKETS; i++) {
        const key = claimBucketKey(i);
        const existing = world.getDynamicProperty(key);
        let arr = readClaimBucket(key);

        if (existing && arr === null) {
            clearDynamicProperty(key);
            arr = [];
        }
        if (!arr) arr = [];

        if (arr.some((p) => p && p.id === stored.id)) {
            return updateGlobalClaim(stored);
        }

        if (bucketHasRoom(arr, stored)) {
            arr.push(stored);
            if (writeClaimBucket(key, arr)) {
                markGlobalClaimsDirty();
                return true;
            }
        }
    }

    if (writeSingleClaim(stored)) return true;

    const fallbackKey = findWritableBucketKeyFor([stored]);
    if (fallbackKey && writeClaimBucket(fallbackKey, [stored])) {
        markGlobalClaimsDirty();
        return fallbackKey;
    }

    return false;
}

function trySaveGlobalClaim(plot) {
    const stored = compactPlotForStorage(plot);
    return updateGlobalClaim(stored) || insertNewGlobalClaim(stored) !== false;
}

function packClaimsIntoBuckets(claims) {
    const buckets = [];
    const singles = [];
    let current = [];

    const flush = () => {
        if (!current.length) return;
        buckets.push(current);
        current = [];
    };

    for (const plot of claims) {
        if (!bucketHasRoom(current, plot)) {
            flush();
            current = [plot];
            if (bucketPayloadSize(current) > MAX_BUCKET_BYTES) {
                singles.push(plot);
                current = [];
            }
        } else {
            current.push(plot);
        }
    }
    flush();

    const normalizedBuckets = [];
    for (const bucket of buckets) {
        const size = bucketPayloadSize(bucket);
        if (size <= MAX_BUCKET_BYTES) {
            normalizedBuckets.push(bucket);
            continue;
        }
        for (const plot of bucket) {
            if (plotPayloadSize(plot) <= TARGET_BUCKET_BYTES) {
                let placed = false;
                for (const target of normalizedBuckets) {
                    if (bucketHasRoom(target, plot)) {
                        target.push(plot);
                        placed = true;
                        break;
                    }
                }
                if (!placed) normalizedBuckets.push([plot]);
            } else {
                singles.push(plot);
            }
        }
    }

    return { buckets: normalizedBuckets, singles };
}

/**
 * Re-pack claims without wiping storage first (Realm-safe).
 * Builds all payloads in memory, writes only when every payload is valid.
 */
export function rebalanceAllClaimBuckets() {
    healCorruptClaimBuckets();

    const byId = new Map();
    for (const raw of getAllGlobalClaims()) {
        if (!isValidClaimPlot(raw)) continue;
        byId.set(raw.id, compactPlotForStorage(raw));
    }

    const claims = [...byId.values()];
    const result = { ok: true, claims: claims.length, buckets: 0, singles: 0, error: null };

    if (!claims.length) return result;

    const packed = packClaimsIntoBuckets(claims);
    const writes = [];

    for (let i = 0; i < packed.buckets.length; i++) {
        const payload = JSON.stringify(packed.buckets[i]);
        if (payload.length > MAX_BUCKET_BYTES) {
            result.ok = false;
            result.error = 'bucket_too_large';
            return result;
        }
        writes.push({ key: claimBucketKey(i + 1), payload });
    }

    for (const plot of packed.singles) {
        const payload = JSON.stringify(plot);
        if (payload.length > MAX_BUCKET_BYTES) {
            result.ok = false;
            result.error = 'claim_too_large';
            return result;
        }
        writes.push({ key: singleClaimKey(plot.id), payload });
    }

    const stagePrefix = `claim_stage_${Date.now()}_`;
    const staged = writes.map((write, index) => ({
        stageKey: `${stagePrefix}${index}`,
        finalKey: write.key,
        payload: write.payload,
    }));

    for (const entry of staged) {
        if (!writeRawProperty(entry.stageKey, entry.payload, MAX_BUCKET_BYTES)) {
            for (const cleanup of staged) clearDynamicProperty(cleanup.stageKey);
            result.ok = false;
            result.error = 'realm_write_rejected';
            return result;
        }
    }

    for (const entry of staged) {
        if (!writeRawProperty(entry.finalKey, entry.payload, MAX_BUCKET_BYTES)) {
            for (const cleanup of staged) clearDynamicProperty(cleanup.stageKey);
            result.ok = false;
            result.error = 'realm_write_rejected';
            return result;
        }
    }

    for (const entry of staged) clearDynamicProperty(entry.stageKey);

    const keepKeys = new Set(writes.map((w) => w.key));
    for (const key of collectClaimBucketKeys()) {
        if (!keepKeys.has(key) && !key.startsWith('claim_stage_')) {
            clearDynamicProperty(key);
        }
    }

    result.buckets = packed.buckets.length;
    result.singles = packed.singles.length;
    markGlobalClaimsDirty();
    rebuildGlobalClaimChunkCache(true);
    return result;
}

/** Update if present, otherwise insert. Auto-heals and rebalances on Realm write failures. */
export function saveGlobalClaim(plot) {
    if (!isValidClaimPlot(plot)) return false;

    healCorruptClaimBuckets();
    if (trySaveGlobalClaim(plot)) return true;

    const repaired = rebalanceAllClaimBuckets();
    if (!repaired.ok) {
        return writeSingleClaim(plot);
    }

    if (trySaveGlobalClaim(plot)) return true;
    return writeSingleClaim(plot);
}

/** Backward-compatible alias for new claims and saves. */
export function addToGlobalClaims(plot) {
    return saveGlobalClaim(plot);
}

export function getPlayerOwnedClaims(player) {
    if (!isLivePlayer(player)) return [];
    const playerId = safePlayerId(player);
    const playerName = safePlayerName(player).toLowerCase();
    if (!playerId && !playerName) return [];
    return getAllGlobalClaims().filter(
        (p) =>
            p &&
            !p.isSubclaim &&
            !p.factionClaim &&
            (p.ownerId === playerId || String(p.ownerName || '').toLowerCase() === playerName)
    );
}

export function syncOwnedPlotsFromGlobal(player) {
    if (!isLivePlayer(player)) return [];
    const owned = getPlayerOwnedClaims(player);
    const payload = JSON.stringify(owned);

    try {
        if (payload.length > MAX_BUCKET_BYTES) {
            const slim = owned.map((plot) => ({
                id: plot.id,
                name: plot.name,
                ownerId: plot.ownerId,
                ownerName: plot.ownerName,
                minX: plot.minX,
                maxX: plot.maxX,
                minZ: plot.minZ,
                maxZ: plot.maxZ,
                y: plot.y,
                dimension: plot.dimension,
                isSubclaim: plot.isSubclaim,
                factionClaim: plot.factionClaim,
            }));
            player.setDynamicProperty('owned_plots', JSON.stringify(slim));
        } else {
            player.setDynamicProperty('owned_plots', payload);
        }
    } catch (e) {}

    return owned;
}

export function removeFromGlobalClaims(plotToRemove) {
    if (!plotToRemove || !plotToRemove.id) return false;

    let removed = false;
    const soloKey = singleClaimKey(plotToRemove.id);

    if (world.getDynamicProperty(soloKey) != null) {
        clearDynamicProperty(soloKey);
        removed = true;
    }

    for (const key of collectClaimBucketKeys()) {
        if (key.startsWith('claim_plot_')) continue;

        const arr = readClaimBucket(key);
        if (!arr) continue;

        const initialLength = arr.length;
        const next = arr.filter((p) => p && p.id !== plotToRemove.id);

        if (next.length !== initialLength) {
            if (!writeClaimBucket(key, next)) return false;
            markGlobalClaimsDirty();
            removed = true;
        }
    }

    return removed;
}
