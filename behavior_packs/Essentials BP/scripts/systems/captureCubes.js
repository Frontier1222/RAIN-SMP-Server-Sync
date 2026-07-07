import { world, system, ItemStack, StructureSaveMode, EquipmentSlot } from "@minecraft/server";

/**
 * Capture Cube system.
 *
 * Extracted out of the big minified `unlinked/compiled.js` bundle into its own
 * readable file so it's actually maintainable. This is the ONLY place capture
 * cube logic should live in Essentials BP.
 *
 * Claim protection — Essentials BP and RAIN SMP E BP are two SEPARATE behavior
 * packs, each with its own script engine instance AND its own isolated dynamic
 * property storage. Bedrock cryptographically ties every dynamic property (even
 * ones set on `world`) to the header UUID of the pack that wrote it — one pack
 * can NEVER read another pack's dynamic properties, no matter the key name or
 * timing. (Confirmed against Microsoft's own scripting docs.) An earlier version
 * of this file tried to read RAIN SMP's raw claim storage directly from
 * `world.getDynamicProperty(...)` — that could never have worked, which is why
 * claim blocking kept silently failing (`totalPlotsRead=0` every time).
 *
 * The correct cross-pack channel is `system.sendScriptEvent` /
 * `system.afterEvents.scriptEventReceive`, which is NOT pack-isolated. Every
 * capture/release checks with RAIN SMP in real time over this channel:
 *   1. Essentials sends "rain:cc_check" with {reqId, playerId, x, y, z, dim}.
 *   2. RAIN SMP (single source of truth for claim permissions) evaluates the
 *      exact same logic it uses for its own on-block checks and replies with
 *      "essentials:cc_check_result" -> {reqId, blocked, claimName}.
 * This avoids re-implementing (and re-breaking) RAIN SMP's claim/trust logic
 * a second time here, and works regardless of pack load order.
 */

const STRUCTURE_PREFIX = "unlinked_essentials:";
const LORE_ID_PREFIX = "\u00A7r\u00A7bCapture Cube ID: ";
const EMPTY_CUBE_ID = "ulkd_ess:empty_capture_cube";
const FILLED_CUBE_ID = "ulkd_ess:capture_cube";
const PROJECTILE_COMPONENT = "minecraft:projectile";
const EQUIPPABLE_COMPONENT = "minecraft:equippable";

const CC_CHECK_REQUEST_EVENT = "rain:cc_check";
const CC_CHECK_RESULT_EVENT = "essentials:cc_check_result";
const CC_CHECK_TIMEOUT_TICKS = 20; // ~1 second; RAIN SMP normally replies within 1-2 ticks

const SETTINGS = {
    captureEnabled: "ess:capture",
    changeMobSpawner: "ess:change_mob_spawner",
    reusableCubes: "ess:reusable_capture_cubes",
};

/** Junk/vehicle/projectile entities — capturing these makes no sense, always skip. */
const NEVER_CAPTURABLE = [
    "minecraft:item", "ulkd_ess:waypoint", "ulkd_ess:waypoint_public",
    "minecraft:agent", "minecraft:area_effect_cloud", "minecraft:armor_stand", "minecraft:arrow",
    "minecraft:boat", "minecraft:breeze_wind_charge_projectile", "minecraft:chest_boat",
    "minecraft:chest_minecart", "minecraft:command_block_minecart", "minecraft:dragon_fireball",
    "minecraft:egg", "minecraft:ender_crystal", "minecraft:ender_pearl", "minecraft:eye_of_ender_signal",
    "minecraft:fireball", "minecraft:fireworks_rocket", "minecraft:fishing_hook", "minecraft:hopper_minecart",
    "minecraft:lightning_bolt", "minecraft:lingering_potion", "minecraft:llama_spit", "minecraft:minecart",
    "minecraft:ominous_item_spawner", "minecraft:player", "minecraft:shulker_bullet", "minecraft:small_fireball",
    "minecraft:snowball", "minecraft:splash_potion", "minecraft:thrown_trident", "minecraft:tnt",
    "minecraft:tnt_minecart", "minecraft:wind_charge_projectile", "minecraft:wither_skull",
    "minecraft:wither_skull_dangerous", "minecraft:xp_bottle", "minecraft:xp_orb",
];

/** Bosses / high-value mobs — always banned from being captured OR released, no toggle. */
const BANNED_BOSS_MOBS = [
    "minecraft:warden",
    "minecraft:wither",
    "minecraft:wither_skeleton",
    "minecraft:elder_guardian",
    "minecraft:ender_dragon",
    "minecraft:ravager",
    "minecraft:iron_golem",
];

const ALL_BANNED_FROM_CAPTURE = [...NEVER_CAPTURABLE, ...BANNED_BOSS_MOBS];

/** Staff can bypass the banned-mob capture/release list for testing purposes. */
function isStaffPlayer(player) {
    if (!player) return false;
    try {
        if (player.hasTag("tester")) return false;
        return player.hasTag("staff");
    } catch (e) {
        return false;
    }
}

function isBannedFromCapture(typeId, player) {
    if (isStaffPlayer(player)) return false;
    return ALL_BANNED_FROM_CAPTURE.includes(typeId);
}

function isBannedFromRelease(typeId, player) {
    if (isStaffPlayer(player)) return false;
    return BANNED_BOSS_MOBS.includes(typeId);
}

function settingEnabled(propertyId, defaultValue = true) {
    try {
        const value = world.getDynamicProperty(propertyId);
        return value === undefined ? defaultValue : !!value;
    } catch (e) {
        return defaultValue;
    }
}

// --- "Toast" notifications ---
// RAIN SMP E RP's chat_screen UI hides any chat message starting with "_r4ui:" and renders
// it as an actual on-screen toast instead (see resource_packs/RAIN SMP E RP/ui/adv/_toast.r4ui).
// That resource pack is a shared dependency of this world, so any behavior pack's
// player.sendMessage() can trigger it — it's a client-side text format, not pack-isolated.
// Mirrors RAIN SMP's own toastDeny()/notify() cooldown behavior so repeat attempts don't spam.
const MC = "\u00A7";
const TOAST_COOLDOWN_MS = 5000;
const toastCooldowns = new Map();

function toastDeny(player, message, key, sound = "note.bass") {
    if (!player) return;
    const now = Date.now();
    const cacheKey = `${player.id}:${key}`;
    const last = toastCooldowns.get(cacheKey) || 0;
    if (now - last < TOAST_COOLDOWN_MS) return;
    toastCooldowns.set(cacheKey, now);

    const text = String(message ?? "");
    const colored = text.startsWith(MC) ? text : `${MC}c${text}`;
    try {
        player.sendMessage(`_r4ui:toast_1.tip.${colored}`);
    } catch (e) {}
    try {
        if (sound) player.playSound(sound);
    } catch (e) {}
}

// --- Cross-pack claim check (see file header) ---

let ccRequestSeq = 0;
const pendingCcChecks = new Map();

if (system.afterEvents && system.afterEvents.scriptEventReceive) {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
        if (event.id !== CC_CHECK_RESULT_EVENT) return;
        let data;
        try {
            data = JSON.parse(event.message);
        } catch (e) {
            return;
        }
        const pending = pendingCcChecks.get(data?.reqId);
        if (!pending) return;
        pendingCcChecks.delete(data.reqId);
        pending.resolve({ blocked: !!data.blocked, claimName: data.claimName || "" });
    });
}

/** Asks RAIN SMP whether this player's capture cube use is blocked at this location. */
function requestClaimCaptureCheck(player, location, dimensionId) {
    return new Promise((resolve) => {
        const reqId = `${player.id}_${system.currentTick}_${ccRequestSeq++}`;
        pendingCcChecks.set(reqId, { resolve });

        try {
            system.sendScriptEvent(
                CC_CHECK_REQUEST_EVENT,
                JSON.stringify({
                    reqId,
                    playerId: player.id,
                    x: Math.floor(location.x),
                    y: Math.floor(location.y),
                    z: Math.floor(location.z),
                    dim: dimensionId,
                })
            );
        } catch (e) {
            pendingCcChecks.delete(reqId);
            resolve({ blocked: false, claimName: "" });
            return;
        }

        system.runTimeout(() => {
            if (!pendingCcChecks.has(reqId)) return;
            pendingCcChecks.delete(reqId);
            // RAIN SMP didn't answer in time (pack missing/reloading) — fail open rather
            // than permanently locking capture cubes if the cross-pack link ever hiccups.
            resolve({ blocked: false, claimName: "" });
        }, CC_CHECK_TIMEOUT_TICKS);
    });
}

/** Combined check against RAIN SMP's claim data — primary location, then a fallback location. */
async function checkCaptureBlocked(player, primaryLocation, dimensionId, secondaryLocation) {
    const primary = await requestClaimCaptureCheck(player, primaryLocation, dimensionId);
    if (primary.blocked) return primary;
    if (secondaryLocation) {
        const secondary = await requestClaimCaptureCheck(player, secondaryLocation, dimensionId);
        if (secondary.blocked) return secondary;
    }
    return { blocked: false, claimName: "" };
}

function capturedStructureName(captureId) {
    return `${STRUCTURE_PREFIX}${captureId}`;
}

// Simple per-key-per-player cooldown (mirrors the previous 5-tick debounce window).
const lastActionTick = new Map();
function isOnCooldown(key, playerId) {
    const now = system.currentTick;
    const mapKey = `${key}:${playerId}`;
    const last = lastActionTick.get(mapKey);
    if (last === undefined) {
        lastActionTick.set(mapKey, now);
        return false;
    }
    if (now - last <= 5) return true;
    lastActionTick.set(mapKey, now);
    return false;
}

/** 1) Empty cube used on an entity — capture it, or deny with the right message. */
world.beforeEvents.playerInteractWithEntity.subscribe(async (event) => {
    const item = event.itemStack;
    const player = event.player;
    const target = event.target;
    if (!item || item.typeId !== EMPTY_CUBE_ID || target.hasComponent(PROJECTILE_COMPONENT)) return;
    if (isBannedFromCapture(target.typeId, player)) return; // RAIN SMP's own handler blocks + messages this

    // Cancel now (before awaiting the cross-pack check) so vanilla doesn't also react to this
    // interaction; if the check comes back clear, we manually replicate the capture below.
    event.cancel = true;

    const targetLocation = target.location;
    const targetDimensionId = target.dimension.id;

    const check = await checkCaptureBlocked(player, targetLocation, targetDimensionId);
    if (check.blocked) {
        // No message here — RAIN SMP's own synchronous handler on this same interaction
        // (tryBlockCaptureCubeUse) already showed the deny toast. Showing another one here
        // would double it up in chat.
        return;
    }

    if (!settingEnabled(SETTINGS.captureEnabled)) {
        player.sendMessage({ translate: "ulkd.ess.capture_cube.disabled" });
        return;
    }

    if (!target.isValid) return;

    const captureId = Math.round(Math.random() * 99999);
    const filledCube = new ItemStack(FILLED_CUBE_ID, 1);
    const shortName = target.typeId.substring(target.typeId.indexOf(":") + 1);
    const prettyName = shortName.charAt(0).toUpperCase() + shortName.slice(1);
    filledCube.setLore([`\u00A7r\u00A7b${prettyName}`, `${LORE_ID_PREFIX}${captureId}`]);

    const { x, y, z } = target.location;
    const dimension = target.dimension;
    const groundY = dimension.heightRange.min;

    target.teleport({ x, y: groundY + 1, z });
    world.structureManager.createFromWorld(
        capturedStructureName(captureId),
        dimension,
        { x, y: groundY + 1, z },
        { x, y: groundY + 1, z },
        { includeEntities: true, includeBlocks: false, saveMode: StructureSaveMode.World }
    );
    target.remove();
    dimension.spawnParticle("ulkd_ess:essentials22", { x, y, z });
    dimension.playSound("unlinked.essentials.capture", { x, y, z });
    player.runCommand("clear @s ulkd_ess:empty_capture_cube 0 1");
    dimension.spawnItem(filledCube, { x, y, z });
});

/** 2) Filled cube used — release the captured entity at the block the player is looking at. */
world.afterEvents.itemUse.subscribe(async (event) => {
    const player = event.source;
    const item = event.itemStack;
    if (item.typeId !== FILLED_CUBE_ID || player.typeId !== "minecraft:player") return;
    if (isOnCooldown("Essentials.captureCube", player.id)) return;

    const lore = item.getLore();
    if (lore.length === 0 || !lore.some((line) => line.includes(LORE_ID_PREFIX))) return;

    const capturedName = String(lore[0] || "").replace(/\u00A7./g, "").trim().toLowerCase().replace(/\s+/g, "_");
    if (isBannedFromRelease(`minecraft:${capturedName}`, player)) {
        toastDeny(player, "This mob cannot be released from capture cubes.", "capture_release_banned");
        return;
    }

    const captureId = lore.find((line) => line.includes(LORE_ID_PREFIX)).replace(LORE_ID_PREFIX, "");
    const targetBlock = player.getBlockFromViewDirection({ maxDistance: 10 });
    if (!targetBlock || !targetBlock.block) {
        player.sendMessage({ translate: "ulkd.ess.capture_cube.invalid_location" });
        return;
    }

    const blockLoc = targetBlock.block.location;
    const releaseAt = { x: blockLoc.x, y: blockLoc.y + 2, z: blockLoc.z };
    const dimension = player.dimension;

    const check = await checkCaptureBlocked(player, releaseAt, dimension.id);
    if (check.blocked) {
        // No message here — RAIN SMP's own synchronous handler (tryReleaseCaptureCube) on
        // this same beforeEvents.itemUse interaction already showed the deny toast.
        return;
    }

    const structureName = capturedStructureName(captureId);
    world.structureManager.place(structureName, dimension, releaseAt, { includeBlocks: false, includeEntities: true });
    world.structureManager.delete(structureName);

    const equippable = player.getComponent(EQUIPPABLE_COMPONENT);
    if (!equippable || !equippable.getEquipment(EquipmentSlot.Mainhand)) return;

    if (settingEnabled(SETTINGS.reusableCubes, false)) {
        equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack(EMPTY_CUBE_ID, 1));
    } else {
        equippable.setEquipment(EquipmentSlot.Mainhand);
    }
    dimension.spawnParticle("ulkd_ess:essentials24", releaseAt);
    dimension.playSound("unlinked.essentials.release", releaseAt);
});

/**
 * NOTE: There used to be a "3) Early aim-check" handler here on `itemUse` that guessed the
 * aimed entity via a view-direction raycast and showed a deny message ahead of time. It was
 * removed: `itemUse` and `playerInteractWithEntity` both fire on the same right-click, but
 * `itemUse`'s raycast guess can resolve to a DIFFERENT entity than the one
 * `playerInteractWithEntity` actually resolves as the real interaction target (e.g. near a
 * claim border, or with mobs clustered together). That caused the deny message to show for
 * one mob while the real target (handled correctly by handler #1 above) still got captured.
 * Handler #1 is authoritative and already shows the identical deny message on the real
 * target, so this duplicate/unreliable pre-check was just actively misleading.
 */

/** 4) Filled cube used on a mob spawner — swap the spawner's egg for the captured mob's egg. */
world.beforeEvents.playerInteractWithBlock.subscribe(async (event) => {
    const item = event.itemStack;
    const player = event.player;
    const block = event.block;
    if (!item || item.typeId !== FILLED_CUBE_ID || block.typeId !== "minecraft:mob_spawner") return;
    if (isOnCooldown("Essentials.captureCube", player.id)) return;

    if (!settingEnabled(SETTINGS.changeMobSpawner)) {
        player.sendMessage({ translate: "ulkd.ess.capture_cube.disabled" });
        return;
    }

    const lore = item.getLore();
    if (lore.length === 0 || !lore.some((line) => line.includes(LORE_ID_PREFIX))) return;
    const captureId = lore.find((line) => line.includes(LORE_ID_PREFIX)).replace(LORE_ID_PREFIX, "");

    await null;
    const dimension = player.dimension;
    const structureName = capturedStructureName(captureId);
    if (!world.structureManager.get(structureName)) return;

    const spawnAt = { x: block.location.x, y: 300, z: block.location.z };
    world.structureManager.place(structureName, dimension, spawnAt, { includeBlocks: false, includeEntities: true });

    const [spawnedEntity] = dimension.getEntities({ location: spawnAt, closest: 1 });
    if (!spawnedEntity) return;

    const typeId = spawnedEntity.typeId;
    if (!typeId.startsWith("minecraft:")) {
        spawnedEntity.remove();
        return;
    }

    const eggId = `minecraft:${typeId.substring(10)}_spawn_egg`;
    spawnedEntity.remove();

    try {
        const equippable = player.getComponent(EQUIPPABLE_COMPONENT);
        if (!equippable || !equippable.getEquipment(EquipmentSlot.Mainhand)) return;
        equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack(eggId, 1));
        world.structureManager.delete(structureName);
    } catch (e) {}
});
