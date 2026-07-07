import { world } from "@minecraft/server";

const MAX_BUCKETS = 200;
const MAX_CHUNKS_TO_INDEX = 256;

let cachedClaimsList = null;
let claimsListDirty = true;
let globalPlotsByChunk = new Map();
let globalLargePlotsByDim = new Map();
let chunkCacheDirty = true;

function plotDimId(plot) {
    return plot.dimension || "minecraft:overworld";
}

function chunkCoord(v) {
    return Math.floor(v) >> 4;
}

function collectClaimBucketKeys() {
    const keys = new Set(["claimed_plots"]);
    for (let i = 2; i <= MAX_BUCKETS; i++) {
        keys.add(`claimed_plots_${i}`);
    }
    try {
        const ids = world.getDynamicPropertyIds?.();
        if (ids) {
            for (const id of ids) {
                const name = String(id);
                if (name.startsWith("claim_stage_")) continue;
                if (
                    name === "claimed_plots" ||
                    name.startsWith("claimed_plots_") ||
                    name.startsWith("claim_plot_")
                ) {
                    keys.add(name);
                }
            }
        }
    } catch (e) {}
    return keys;
}

function loadAllBuckets() {
    const all = [];
    const seenIds = new Set();

    for (const key of collectClaimBucketKeys()) {
        const str = world.getDynamicProperty(key);
        if (!str) continue;

        if (key.startsWith("claim_plot_")) {
            try {
                const plot = JSON.parse(str);
                if (!plot?.id || seenIds.has(plot.id)) continue;
                seenIds.add(plot.id);
                all.push(plot);
            } catch (e) {}
            continue;
        }

        try {
            const arr = JSON.parse(str);
            if (!Array.isArray(arr)) continue;
            for (const plot of arr) {
                if (!plot?.id || seenIds.has(plot.id)) continue;
                seenIds.add(plot.id);
                all.push(plot);
            }
        } catch (e) {}
    }
    return all;
}

export function markGlobalClaimsDirty() {
    claimsListDirty = true;
    chunkCacheDirty = true;
}

export function getAllGlobalClaims() {
    if (claimsListDirty || !cachedClaimsList) {
        cachedClaimsList = loadAllBuckets();
        claimsListDirty = false;
        chunkCacheDirty = true;
    }
    return cachedClaimsList;
}

export function rebuildGlobalClaimChunkCache(force = false) {
    if (!force && !chunkCacheDirty) return;

    const plots = getAllGlobalClaims();
    const nextByChunk = new Map();
    const nextLargeByDim = new Map();

    for (const plot of plots) {
        if (!plot) continue;
        const dim = plotDimId(plot);
        const minChunkX = chunkCoord(plot.minX);
        const maxChunkX = chunkCoord(plot.maxX);
        const minChunkZ = chunkCoord(plot.minZ);
        const maxChunkZ = chunkCoord(plot.maxZ);
        const chunkCount = (maxChunkX - minChunkX + 1) * (maxChunkZ - minChunkZ + 1);

        if (chunkCount > MAX_CHUNKS_TO_INDEX) {
            let list = nextLargeByDim.get(dim);
            if (!list) {
                list = [];
                nextLargeByDim.set(dim, list);
            }
            list.push(plot);
            continue;
        }

        for (let cx = minChunkX; cx <= maxChunkX; cx++) {
            for (let cz = minChunkZ; cz <= maxChunkZ; cz++) {
                const key = `${dim}:${cx}:${cz}`;
                let list = nextByChunk.get(key);
                if (!list) {
                    list = [];
                    nextByChunk.set(key, list);
                }
                list.push(plot);
            }
        }
    }

    globalPlotsByChunk = nextByChunk;
    globalLargePlotsByDim = nextLargeByDim;
    chunkCacheDirty = false;
    // NOTE: Cross-pack claim data used to be published here via a world dynamic property
    // ("_rain_cc_regions") for Essentials BP to read. That never actually worked — Bedrock
    // isolates dynamic properties per behavior pack UUID, so Essentials could never see this
    // data regardless of timing. Cross-pack capture-cube checks now go through
    // system.sendScriptEvent("rain:cc_check", ...) instead (see main.js).
}

function getClaimArea(plot) {
    const minX = Math.min(plot.minX, plot.maxX);
    const maxX = Math.max(plot.minX, plot.maxX);
    const minZ = Math.min(plot.minZ, plot.maxZ);
    const maxZ = Math.max(plot.minZ, plot.maxZ);
    return Math.abs((maxX - minX + 1) * (maxZ - minZ + 1));
}

function isAdminClaim(plot) {
    if (!plot) return false;
    return (
        plot.ownerName === "Server" ||
        plot.ownerId === "server" ||
        plot.ownerId === "Server" ||
        plot.isAdminClaim === true ||
        plot.adminClaim === true
    );
}

function pickBestClaim(candidates) {
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
        if (a.isSubclaim && !b.isSubclaim) return -1;
        if (!a.isSubclaim && b.isSubclaim) return 1;
        const aAdmin = isAdminClaim(a);
        const bAdmin = isAdminClaim(b);
        if (aAdmin && !bAdmin) return -1;
        if (!aAdmin && bAdmin) return 1;
        return getClaimArea(a) - getClaimArea(b);
    });
    return candidates[0];
}

/** All global claims matching a location (for merge with per-player caches). */
export function getGlobalPlotsAtLocation(loc, dimId) {
    rebuildGlobalClaimChunkCache();

    const cx = Math.floor(loc.x / 16);
    const cz = Math.floor(loc.z / 16);
    const chunkKey1 = `${dimId}:${cx}:${cz}`;
    const chunkKey2 = `${dimId.replace("minecraft:", "")}:${cx}:${cz}`;

    const checkBounds = (plot, px, pz) => {
        const minX = Math.min(plot.minX, plot.maxX);
        const maxX = Math.max(plot.minX, plot.maxX);
        const minZ = Math.min(plot.minZ, plot.maxZ);
        const maxZ = Math.max(plot.minZ, plot.maxZ);
        return px >= minX && px <= maxX + 1 && pz >= minZ && pz <= maxZ + 1;
    };

    const candidates = [];
    const addMatches = (list) => {
        for (const plot of list || []) {
            if (!plot) continue;
            if (checkBounds(plot, loc.x, loc.z)) candidates.push(plot);
        }
    };

    addMatches(globalPlotsByChunk.get(chunkKey1));
    addMatches(globalPlotsByChunk.get(chunkKey2));
    addMatches(globalLargePlotsByDim.get(dimId));
    addMatches(globalLargePlotsByDim.get(dimId.replace("minecraft:", "")));

    return candidates;
}

/** Chunk-indexed global claim lookup (Realms-safe vs scanning every claim). */
export function getGlobalPlotAtLocation(loc, dimId) {
    return pickBestClaim(getGlobalPlotsAtLocation(loc, dimId));
}
