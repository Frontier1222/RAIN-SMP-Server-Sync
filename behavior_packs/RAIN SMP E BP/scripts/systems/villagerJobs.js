import { system, world } from "@minecraft/server";

const DIMENSIONS = ["overworld", "nether", "the_end"];
const SCAN_INTERVAL_TICKS = 20;
const SEARCH_RADIUS = 16;
const SEARCH_Y_RADIUS = 3;
const MAX_VILLAGERS_PER_PASS = 2;
const SITE_KEY = "rain:villager_job_site";
const SITE_TYPE_KEY = "rain:villager_job_site_type";
const LOCKED_KEY = "rain:villager_job_locked";
const RESET_EVENT = "rain:become_unskilled";

const WORKSTATIONS = {
    "minecraft:blast_furnace": { event: "minecraft:become_armorer", family: "armorer" },
    "minecraft:smoker": { event: "minecraft:become_butcher", family: "butcher" },
    "minecraft:cartography_table": { event: "minecraft:become_cartographer", family: "cartographer" },
    "minecraft:brewing_stand": { event: "minecraft:become_cleric", family: "cleric" },
    "minecraft:composter": { event: "minecraft:become_farmer", family: "farmer" },
    "minecraft:barrel": { event: "minecraft:become_fisherman", family: "fisherman" },
    "minecraft:fletching_table": { event: "minecraft:become_fletcher", family: "fletcher" },
    "minecraft:cauldron": { event: "minecraft:become_leatherworker", family: "leatherworker" },
    "minecraft:lectern": { event: "minecraft:become_librarian", family: "librarian" },
    "minecraft:stonecutter": { event: "minecraft:become_mason", family: "mason" },
    "minecraft:loom": { event: "minecraft:become_sheperd", family: "shepherd" },
    "minecraft:smithing_table": { event: "minecraft:become_toolsmith", family: "toolsmith" },
    "minecraft:grindstone": { event: "minecraft:become_weaponsmith", family: "weaponsmith" },
};

const PROFESSION_FAMILIES = new Set(Object.values(WORKSTATIONS).map((entry) => entry.family));
PROFESSION_FAMILIES.add("nitwit");

let dimensionCursor = 0;
let pendingQuickScan = false;
const villagerCursors = new Map();

function buildSearchOffsets() {
    const offsets = [];
    for (let y = -SEARCH_Y_RADIUS; y <= SEARCH_Y_RADIUS; y++) {
        for (let x = -SEARCH_RADIUS; x <= SEARCH_RADIUS; x++) {
            for (let z = -SEARCH_RADIUS; z <= SEARCH_RADIUS; z++) {
                offsets.push({ x, y, z, distance: x * x + y * y + z * z });
            }
        }
    }
    offsets.sort((a, b) => a.distance - b.distance);
    return offsets;
}

const SEARCH_OFFSETS = buildSearchOffsets();

function getFamilies(entity) {
    try {
        return entity.getComponent("type_family")?.getTypeFamilies?.() ?? [];
    } catch {
        return [];
    }
}

function getProfessionFamily(entity) {
    for (const family of getFamilies(entity)) {
        if (PROFESSION_FAMILIES.has(family)) return family;
    }
    return "";
}

function isVillager(entity) {
    return entity?.isValid && entity.typeId === "minecraft:villager_v2";
}

function keyFor(dimension, location) {
    return `${dimension.id}:${Math.floor(location.x)},${Math.floor(location.y)},${Math.floor(location.z)}`;
}

function parseSiteKey(key) {
    const text = String(key || "");
    const parts = text.split(":");
    if (parts.length < 2) return null;
    const coords = parts.pop().split(",").map((value) => Number(value));
    if (coords.length !== 3 || coords.some((value) => !Number.isFinite(value))) return null;
    return { dimensionId: parts.join(":"), location: { x: coords[0], y: coords[1], z: coords[2] } };
}

function getBlock(dimension, location) {
    try {
        return dimension.getBlock(location);
    } catch {
        return null;
    }
}

function getAssignedSite(villager) {
    const parsed = parseSiteKey(villager.getDynamicProperty(SITE_KEY));
    if (!parsed) return null;
    if (parsed.dimensionId !== villager.dimension.id) return null;

    const block = getBlock(villager.dimension, parsed.location);
    const expectedType = villager.getDynamicProperty(SITE_TYPE_KEY);
    if (!block || (expectedType && block.typeId !== expectedType)) return null;
    return { key: keyFor(villager.dimension, block.location), block };
}

function hasRememberedSite(villager) {
    return !!parseSiteKey(villager.getDynamicProperty(SITE_KEY));
}

function rememberSite(villager, block) {
    villager.setDynamicProperty(SITE_KEY, keyFor(villager.dimension, block.location));
    villager.setDynamicProperty(SITE_TYPE_KEY, block.typeId);
}

function clearSite(villager) {
    villager.setDynamicProperty(SITE_KEY, undefined);
    villager.setDynamicProperty(SITE_TYPE_KEY, undefined);
}

function isLocked(villager) {
    try {
        return villager.getDynamicProperty(LOCKED_KEY) === true;
    } catch {
        return false;
    }
}

function lockIfProfessioned(villager) {
    if (!isVillager(villager)) return;
    const profession = getProfessionFamily(villager);
    if (!profession || profession === "nitwit") return;
    try {
        villager.setDynamicProperty(LOCKED_KEY, true);
    } catch {}
}

function collectClaimedSites(villagers) {
    const claimed = new Map();
    for (const villager of villagers) {
        if (!isVillager(villager)) continue;
        const site = getAssignedSite(villager);
        if (site) claimed.set(site.key, villager.id);
    }
    return claimed;
}

function findNearestWorkstation(villager, claimed, professionFamily = "") {
    const base = {
        x: Math.floor(villager.location.x),
        y: Math.floor(villager.location.y),
        z: Math.floor(villager.location.z),
    };

    for (const offset of SEARCH_OFFSETS) {
        const block = getBlock(villager.dimension, { x: base.x + offset.x, y: base.y + offset.y, z: base.z + offset.z });
        const job = WORKSTATIONS[block?.typeId];
        if (!job) continue;
        if (professionFamily && job.family !== professionFamily) continue;

        const key = keyFor(villager.dimension, block.location);
        const claimant = claimed.get(key);
        if (claimant && claimant !== villager.id) continue;

        return { key, block, job };
    }

    return null;
}

function showJobParticles(villager) {
    try {
        for (let i = 0; i < 10; i++) {
            villager.dimension.spawnParticle("minecraft:villager_happy", {
                x: villager.location.x + (Math.random() - 0.5),
                y: villager.location.y + 0.6 + Math.random(),
                z: villager.location.z + (Math.random() - 0.5),
            });
        }
    } catch {}
}

function resetVillagerJob(villager) {
    try {
        villager.triggerEvent(RESET_EVENT);
    } catch {}
    clearSite(villager);
}

function processVillager(villager, claimed) {
    if (!isVillager(villager)) return;

    const profession = getProfessionFamily(villager);
    if (profession === "nitwit") return;

    const assigned = getAssignedSite(villager);
    if (assigned) {
        const job = WORKSTATIONS[assigned.block.typeId];
        if (job && (!profession || profession === job.family)) return;
        if (isLocked(villager)) {
            clearSite(villager);
            return;
        }
        resetVillagerJob(villager);
        claimed.delete(assigned.key);
        return;
    }

    if (hasRememberedSite(villager)) {
        if (isLocked(villager)) {
            clearSite(villager);
            return;
        }
        resetVillagerJob(villager);
        return;
    }

    if (profession) {
        if (isLocked(villager)) return;
        const matching = findNearestWorkstation(villager, claimed, profession);
        if (matching) {
            rememberSite(villager, matching.block);
            claimed.set(matching.key, villager.id);
        }
        return;
    }

    const station = findNearestWorkstation(villager, claimed);
    if (!station) return;

    try {
        villager.triggerEvent(station.job.event);
        rememberSite(villager, station.block);
        claimed.set(station.key, villager.id);
        showJobParticles(villager);
    } catch {}
}

function tickVillagerJobs() {
    pendingQuickScan = false;
    const dimensionId = DIMENSIONS[dimensionCursor % DIMENSIONS.length];
    dimensionCursor = (dimensionCursor + 1) % DIMENSIONS.length;

    let dimension;
    try {
        dimension = world.getDimension(dimensionId);
    } catch {
        return;
    }

    let villagers;
    try {
        villagers = dimension.getEntities({ type: "minecraft:villager_v2" });
    } catch {
        return;
    }

    if (!villagers.length) {
        villagerCursors.set(dimensionId, 0);
        return;
    }

    const claimed = collectClaimedSites(villagers);
    let cursor = villagerCursors.get(dimensionId) || 0;
    let processed = 0;

    for (let attempts = 0; attempts < villagers.length && processed < MAX_VILLAGERS_PER_PASS; attempts++) {
        const villager = villagers[cursor % villagers.length];
        cursor = (cursor + 1) % villagers.length;
        processVillager(villager, claimed);
        processed += 1;
    }

    villagerCursors.set(dimensionId, cursor);
}

function scheduleQuickScan(delay = 1) {
    if (pendingQuickScan) return;
    pendingQuickScan = true;
    system.runTimeout(tickVillagerJobs, delay);
}

function resetVillagersBoundToBrokenSite(event) {
    const block = event.block;
    const dimension = event.player?.dimension || block?.dimension;
    if (!block?.location || !dimension) return;

    const brokenKey = keyFor(dimension, block.location);
    let villagers;
    try {
        villagers = dimension.getEntities({
            type: "minecraft:villager_v2",
            location: block.location,
            maxDistance: SEARCH_RADIUS + 4,
        });
    } catch {
        return;
    }

    for (const villager of villagers) {
        if (!isVillager(villager)) continue;
        if (villager.getDynamicProperty(SITE_KEY) === brokenKey) {
            if (isLocked(villager)) {
                clearSite(villager);
                continue;
            }
            resetVillagerJob(villager);
        }
    }
}

export function startVillagerJobsRuntime() {
    system.runInterval(tickVillagerJobs, SCAN_INTERVAL_TICKS);

    world.afterEvents.playerPlaceBlock?.subscribe((event) => {
        if (WORKSTATIONS[event.block?.typeId]) scheduleQuickScan(1);
    });
    world.afterEvents.playerBreakBlock?.subscribe((event) => {
        resetVillagersBoundToBrokenSite(event);
        scheduleQuickScan(1);
    });
    world.afterEvents.playerInteractWithEntity?.subscribe((event) => {
        lockIfProfessioned(event.target);
    });
    world.afterEvents.entitySpawn?.subscribe((event) => {
        if (event.entity?.typeId === "minecraft:villager_v2") {
            scheduleQuickScan(20);
        }
    });
}
