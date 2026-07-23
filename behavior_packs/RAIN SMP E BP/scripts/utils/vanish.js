import { system, world, GameMode, EquipmentSlot, ItemLockMode, ItemStack } from '@minecraft/server';
import { REALM_STAGGER, notify, registerRealmHook, getCachedPlayersWithTag, getRealmPlayers, refreshRealmPlayers } from './realmPerf.js';
import { hasPermission, isStaffPlayer } from '../systems/ranks.js';
import {
    buildItemDataFromItemStack,
    buildItemStackFromItemData,
} from '../systems/auction/utils/itemDisplay.js';
import { giveItemToPlayer } from '../systems/auction/utils/inventory.js';

export const VANISH_TAG = 'bd_vanish';
export const VANISH_DP_KEY = 'bd_vanish';
export const VANISH_STORAGE_DP = 'bd_vanish_storage';
export const VANISH_PREV_GM_KEY = 'bd_vanish_prev_gm';
export const VANISH_SAVED_EFFECTS_DP = 'bd_vanish_saved_effects';
/** Empty string lets Bedrock show the default gamertag ? use a blank tag instead. */
export const VANISH_HIDDEN_NAMETAG = ' ';

const VANISH_EQUIP_SLOTS = [
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Offhand,
    EquipmentSlot.Mainhand,
];

const VANISH_INVISIBILITY_EFFECT = 'invisibility';
const VANISH_INVISIBILITY_DURATION = 1200;
const VANISH_INVISIBILITY_REFRESH_AT = 300;
const VANISH_GM_CREATIVE = GameMode.Creative ?? GameMode.creative;
const VANISH_GM_SURVIVAL = GameMode.Survival ?? GameMode.survival;
const VANISH_GM_ADVENTURE = GameMode.Adventure ?? GameMode.adventure;
const VANISH_GM_SPECTATOR = GameMode.Spectator ?? GameMode.spectator;
const VANISH_EXIT_ITEM_ID = 'minecraft:echo_shard';
const VANISH_EXIT_ITEM_NAME = '§r§c§lDISABLE VANISH';
const VANISH_EXIT_SLOT = 8;

const VANISH_PROJECTILE_TYPES = new Set([
    'minecraft:snowball',
    'minecraft:egg',
    'minecraft:ender_pearl',
    'minecraft:experience_bottle',
    'minecraft:wind_charge_projectile',
    'minecraft:thrown_trident',
    'minecraft:fishing_hook',
    'minecraft:splash_potion',
    'minecraft:lingering_potion',
    'minecraft:potion',
]);

/** Ignore gamemode events triggered by vanish enforcement. */
const internalVanishGameModeSwitch = new Set();

export function isVanished(player) {
    if (!player?.isValid) return false;

    try {
        const stored = player.getDynamicProperty(VANISH_DP_KEY);
        return stored === true || stored === 1 || player.hasTag(VANISH_TAG);
    } catch (e) {
        return false;
    }
}

export function canUseVanish(player) {
    if (!player) return false;

    return isStaffPlayer(player) || hasPermission(player, 'can_vanish');
}

function getEquippable(player) {
    return player.getComponent('minecraft:equippable') || player.getComponent('equippable');
}

function getInventoryContainer(player) {
    return player.getComponent('minecraft:inventory')?.container
        || player.getComponent('inventory')?.container;
}

function isVanishExitItem(item) {
    return item?.typeId === VANISH_EXIT_ITEM_ID && item.nameTag === VANISH_EXIT_ITEM_NAME;
}

function createVanishExitItem() {
    const item = new ItemStack(VANISH_EXIT_ITEM_ID, 1);
    item.nameTag = VANISH_EXIT_ITEM_NAME;
    item.keepOnDeath = true;
    item.lockMode = ItemLockMode.slot;
    try {
        item.setLore([
            '§7Use this item to leave vanish mode.',
            '§8Your inventory and gamemode will be restored.',
        ]);
    } catch (e) {}
    return item;
}

function ensureVanishExitItem(player) {
    const inventory = getInventoryContainer(player);
    if (!inventory || VANISH_EXIT_SLOT >= inventory.size) return false;

    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!isVanishExitItem(item)) continue;
        if (slot === VANISH_EXIT_SLOT) return true;
        try {
            inventory.setItem(slot, undefined);
        } catch (e) {}
    }

    try {
        inventory.setItem(VANISH_EXIT_SLOT, createVanishExitItem());
        if (player.selectedSlotIndex === VANISH_EXIT_SLOT) player.selectedSlotIndex = 0;
        return true;
    } catch (e) {
        return false;
    }
}

function hasVanishStorage(player) {
    const raw = player?.getDynamicProperty(VANISH_STORAGE_DP);
    return typeof raw === 'string' && raw.length > 2;
}

function readVanishStorage(player) {
    const raw = player?.getDynamicProperty(VANISH_STORAGE_DP);
    if (typeof raw !== 'string' || !raw.length) return null;

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

function writeVanishStorage(player, storage) {
    player.setDynamicProperty(VANISH_STORAGE_DP, JSON.stringify(storage));
}

function clearVanishStorage(player) {
    player.setDynamicProperty(VANISH_STORAGE_DP, undefined);
}

function clearPlayerCarry(player) {
    const inv = getInventoryContainer(player);
    const eq = getEquippable(player);

    try {
        inv?.clearAll();
    } catch (e) {}

    if (!eq) return;

    for (const slot of VANISH_EQUIP_SLOTS) {
        try {
            eq.setEquipment(slot, undefined);
        } catch (e) {}
    }
}

function findNextStorageInventoryKey(storageInventory) {
    for (let i = 0; i < 36; i++) {
        if (!storageInventory[String(i)]) return String(i);
    }

    let extra = 36;
    while (storageInventory[`extra_${extra}`]) extra++;
    return `extra_${extra}`;
}

function mergeCarryIntoVanishStorage(player) {
    const storage = readVanishStorage(player);
    if (!storage) return false;

    const inv = getInventoryContainer(player);
    const eq = getEquippable(player);
    if (!inv && !eq) return false;

    storage.inventory = storage.inventory || {};
    storage.equipment = storage.equipment || {};
    let changed = false;

    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (!item) continue;
            if (isVanishExitItem(item)) continue;

            storage.inventory[findNextStorageInventoryKey(storage.inventory)] =
                buildItemDataFromItemStack(item);
            changed = true;
        }
    }

    if (eq) {
        for (const slot of VANISH_EQUIP_SLOTS) {
            const item = eq.getEquipment(slot);
            if (!item) continue;
            if (isVanishExitItem(item)) continue;

            storage.equipment[String(slot)] = buildItemDataFromItemStack(item);
            changed = true;
        }
    }

    if (changed) {
        writeVanishStorage(player, storage);
    }

    clearPlayerCarry(player);
    return changed;
}

export function saveVanishStorage(player) {
    if (!player) return false;
    if (hasVanishStorage(player)) {
        clearPlayerCarry(player);
        return true;
    }

    const inv = getInventoryContainer(player);
    const eq = getEquippable(player);
    if (!inv || !eq) return false;

    const storage = { inventory: {}, equipment: {} };

    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (!item) continue;
        storage.inventory[String(i)] = buildItemDataFromItemStack(item);
    }

    for (const slot of VANISH_EQUIP_SLOTS) {
        const item = eq.getEquipment(slot);
        if (!item) continue;
        storage.equipment[String(slot)] = buildItemDataFromItemStack(item);
    }

    writeVanishStorage(player, storage);
    clearPlayerCarry(player);
    return true;
}

export function restoreVanishStorage(player) {
    if (!player) return false;

    const storage = readVanishStorage(player);
    if (!storage) return false;

    const inv = getInventoryContainer(player);
    const eq = getEquippable(player);

    clearPlayerCarry(player);

    if (inv) {
        for (const [index, data] of Object.entries(storage.inventory || {})) {
            if (!data) continue;

            const slot = Number(index);
            const stack = buildItemStackFromItemData(data);

            if (Number.isInteger(slot) && slot >= 0 && slot < inv.size) {
                try {
                    const existing = inv.getItem(slot);
                    if (!existing) {
                        inv.setItem(slot, stack);
                        continue;
                    }
                } catch (e) {}
            }

            try {
                giveItemToPlayer(player, stack);
            } catch (e) {}
        }
    }

    if (eq) {
        for (const slot of VANISH_EQUIP_SLOTS) {
            const data = storage.equipment?.[String(slot)];
            if (!data) continue;

            try {
                eq.setEquipment(slot, buildItemStackFromItemData(data));
            } catch (e) {
                try {
                    giveItemToPlayer(player, buildItemStackFromItemData(data));
                } catch (err) {}
            }
        }
    }

    clearVanishStorage(player);
    return true;
}

function saveVanishStatusEffects(player) {
    if (player.getDynamicProperty(VANISH_SAVED_EFFECTS_DP) !== undefined) return;

    const saved = [];
    try {
        for (const effect of player.getEffects() ?? []) {
            if (!effect?.typeId) continue;
            saved.push({
                typeId: effect.typeId,
                duration: effect.duration,
                amplifier: effect.amplifier ?? 0,
            });
        }
    } catch (e) {}

    player.setDynamicProperty(VANISH_SAVED_EFFECTS_DP, JSON.stringify(saved));
}

function restoreVanishStatusEffects(player) {
    const raw = player.getDynamicProperty(VANISH_SAVED_EFFECTS_DP);
    player.setDynamicProperty(VANISH_SAVED_EFFECTS_DP, undefined);
    if (typeof raw !== 'string' || !raw.length) return;

    let saved = [];
    try {
        saved = JSON.parse(raw);
    } catch (e) {
        return;
    }

    if (!Array.isArray(saved)) return;

    for (const entry of saved) {
        if (!entry?.typeId || entry.duration <= 0) continue;
        try {
            player.addEffect(entry.typeId, entry.duration, {
                amplifier: entry.amplifier ?? 0,
                showParticles: true,
                showIcon: true,
            });
        } catch (e) {}
    }
}

function stripAllStatusEffects(player) {
    try {
        for (const effect of [...(player.getEffects() ?? [])]) {
            if (!effect?.typeId) continue;
            try {
                player.removeEffect(effect.typeId);
            } catch (e) {}
        }
    } catch (e) {}

}

function isVanishInvisibilityType(effectType) {
    const typeId = String(effectType?.typeId ?? effectType ?? '').trim().toLowerCase();
    return typeId === VANISH_INVISIBILITY_EFFECT || typeId.endsWith(`:${VANISH_INVISIBILITY_EFFECT}`);
}

function stripNonVanishStatusEffects(player) {
    try {
        for (const effect of player.getEffects() ?? []) {
            if (!effect?.typeId || isVanishInvisibilityType(effect.typeId)) continue;
            try {
                player.removeEffect(effect.typeId);
            } catch (e) {}
        }
    } catch (e) {}
}

function applyVanishInvisibility(player) {
    try {
        const current = player.getEffect(VANISH_INVISIBILITY_EFFECT);
        if (current?.duration > VANISH_INVISIBILITY_REFRESH_AT) return;
    } catch (e) {}

    try {
        player.addEffect(VANISH_INVISIBILITY_EFFECT, VANISH_INVISIBILITY_DURATION, {
            amplifier: 0,
            showParticles: false,
        });
    } catch (e) {}
}

function applyVanishHiddenName(player) {
    try {
        if (player.nameTag !== VANISH_HIDDEN_NAMETAG) {
            player.nameTag = VANISH_HIDDEN_NAMETAG;
        }
    } catch (e) {}
}

function clearVanishEffects(player) {
    stripAllStatusEffects(player);
}

function clearVanishFlags(player) {
    player.setDynamicProperty(VANISH_DP_KEY, undefined);
    if (player.hasTag(VANISH_TAG)) player.removeTag(VANISH_TAG);
}

function normalizeGameMode(mode) {
    if (mode === VANISH_GM_CREATIVE || mode === VANISH_GM_ADVENTURE || mode === VANISH_GM_SURVIVAL) {
        return mode;
    }

    const name = String(mode ?? '').toLowerCase();
    if (name.includes('creative')) return VANISH_GM_CREATIVE;
    if (name.includes('adventure')) return VANISH_GM_ADVENTURE;
    if (name.includes('spectator')) return VANISH_GM_SPECTATOR;
    return VANISH_GM_SURVIVAL;
}

function gameModeToCommand(mode) {
    const normalized = normalizeGameMode(mode);
    if (normalized === VANISH_GM_CREATIVE) return 'creative';
    if (normalized === VANISH_GM_ADVENTURE) return 'adventure';
    if (normalized === VANISH_GM_SPECTATOR) return 'spectator';
    return 'survival';
}

function saveVanishGameMode(player) {
    if (player.getDynamicProperty(VANISH_PREV_GM_KEY) !== undefined) return;

    const mode = normalizeGameMode(player.getGameMode?.());
    player.setDynamicProperty(
        VANISH_PREV_GM_KEY,
        mode === VANISH_GM_SPECTATOR ? VANISH_GM_SURVIVAL : mode
    );
}

function restoreVanishGameMode(player) {
    const saved = player.getDynamicProperty(VANISH_PREV_GM_KEY);

    if (saved !== undefined && saved !== null) {
        const mode = normalizeGameMode(saved);
        try {
            player.setGameMode(mode);
        } catch (e) {
            try {
                player.runCommandAsync(`gamemode ${gameModeToCommand(mode)} @s`);
            } catch (err) {}
        }
    }

    player.setDynamicProperty(VANISH_PREV_GM_KEY, undefined);
}

function switchToVanishCreative(player) {
    internalVanishGameModeSwitch.add(player.id);

    try {
        player.setGameMode(VANISH_GM_CREATIVE);
    } catch (e) {
        try {
            player.runCommandAsync('gamemode creative @s');
        } catch (err) {}
    }

    system.runTimeout(() => internalVanishGameModeSwitch.delete(player.id), 5);
}

function ensureCreativeVanish(player) {
    if (player.getGameMode?.() === VANISH_GM_CREATIVE) return;

    switchToVanishCreative(player);

    system.runTimeout(() => {
        if (!isVanished(player)) return;
        if (player.getGameMode?.() !== VANISH_GM_CREATIVE) {
            switchToVanishCreative(player);
        }
    }, 5);
}

/** Legacy command exit: disable vanish normally, then switch to spectator. */
export function exitVanishToSpectator(player, showToast = true) {
    if (!player || !isVanished(player)) return false;

    clearVanishFlags(player);
    clearVanishEffects(player);
    restoreVanishStorage(player);
    restoreVanishStatusEffects(player);
    player.setDynamicProperty(VANISH_PREV_GM_KEY, undefined);
    try {
        player.setGameMode(VANISH_GM_SPECTATOR);
    } catch (e) {}
    applyVanishHiddenName(player);

    if (showToast) {
        notify(
            player,
            'admin_vanish_spectator_exit',
            '?5?l[VANISH]?r',
            '?7Vanish ended. Inventory restored.',
            'random.levelup'
        );
    }

    return true;
}

export function setVanished(player, vanished) {
    if (!player) return false;

    if (vanished) {
        if (!saveVanishStorage(player)) {
            notify(
                player,
                'admin_vanish_storage_fail',
                '?c?l[VANISH]?r',
                '?cCould not store your inventory for vanish.',
                'note.bass'
            );
            return false;
        }

        saveVanishGameMode(player);
        saveVanishStatusEffects(player);
        player.setDynamicProperty(VANISH_DP_KEY, true);
        if (!player.hasTag(VANISH_TAG)) player.addTag(VANISH_TAG);

        applyVanishEffects(player);
        system.run(() => applyVanishEffects(player));
        system.runTimeout(() => applyVanishEffects(player), 10);
    } else {
        clearVanishFlags(player);
        clearVanishEffects(player);
        restoreVanishStorage(player);
        restoreVanishGameMode(player);
        restoreVanishStatusEffects(player);
    }

    return true;
}

export function applyVanishEffects(player) {
    if (!player || !isVanished(player)) return;

    if (hasVanishStorage(player)) {
        mergeCarryIntoVanishStorage(player);
    } else {
        clearPlayerCarry(player);
    }

    ensureCreativeVanish(player);
    stripNonVanishStatusEffects(player);
    applyVanishInvisibility(player);
    applyVanishHiddenName(player);
    ensureVanishExitItem(player);
}

function applyVanishLightSync(player) {
    if (!player || !isVanished(player)) return;

    ensureCreativeVanish(player);
    stripNonVanishStatusEffects(player);
    applyVanishInvisibility(player);
    applyVanishHiddenName(player);
    ensureVanishExitItem(player);
}

function playerCarriesItems(player) {
    const inv = getInventoryContainer(player);
    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            const item = inv.getItem(i);
            if (item && !isVanishExitItem(item)) return true;
        }
    }

    const eq = getEquippable(player);
    if (eq) {
        for (const slot of VANISH_EQUIP_SLOTS) {
            const item = eq.getEquipment(slot);
            if (item && !isVanishExitItem(item)) return true;
        }
    }

    return false;
}

export function syncVanishPlayer(player, notifyOnRestore = false) {
    if (!isVanished(player)) return false;

    if (!player.hasTag(VANISH_TAG)) player.addTag(VANISH_TAG);

    if (!hasVanishStorage(player)) {
        saveVanishGameMode(player);
        saveVanishStorage(player);
    }

    applyVanishEffects(player);

    if (notifyOnRestore) {
        notify(player, 'admin_vanish_restore', '?5?l[VANISH]?r', '?7Vanish mode is still enabled.', 'random.orb');
    }

    return true;
}

export function listPlayersForAdminPicker(viewer) {
    const players = getRealmPlayers().length ? getRealmPlayers() : refreshRealmPlayers();
    if (!viewer) return players;

    return players.filter((player) => !isVanished(player) || player.id === viewer.id);
}

function cancelVanishedItemInteraction(event) {
    const player = event?.source;
    if (!player || player.typeId !== 'minecraft:player') return false;
    if (!isVanished(player)) return false;

    event.cancel = true;

    system.run(() => {
        if (!isVanished(player)) return;
        if (hasVanishStorage(player)) {
            mergeCarryIntoVanishStorage(player);
        } else {
            applyVanishEffects(player);
        }
    });

    return true;
}

function tryUseVanishExitItem(event) {
    const player = event?.source;
    if (!player || player.typeId !== 'minecraft:player') return false;
    if (!isVanished(player) || !isVanishExitItem(event.itemStack)) return false;

    event.cancel = true;
    system.run(() => {
        if (!isVanished(player)) return;
        if (!setVanished(player, false)) return;
        notify(
            player,
            'admin_vanish_item_exit',
            '§a§l[VANISH]§r',
            '§7Vanish disabled. Inventory and gamemode restored.',
            'random.levelup'
        );
    });
    return true;
}

function stripProjectileFromVanishedOwner(entity) {
    if (!entity?.isValid) return false;

    const typeId = String(entity.typeId || '').toLowerCase();
    if (!VANISH_PROJECTILE_TYPES.has(typeId) && !typeId.includes('projectile') && !typeId.includes('potion')) {
        return false;
    }

    try {
        const proj = entity.getComponent('minecraft:projectile');
        const owner = proj?.owner;
        if (owner?.typeId === 'minecraft:player' && isVanished(owner)) {
            entity.remove();
            return true;
        }
    } catch (e) {}

    return false;
}

export function startVanishRuntime() {
    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            system.runTimeout(() => syncVanishPlayer(event.player, true), 1);
            system.runTimeout(() => syncVanishPlayer(event.player, false), 20);
        });
    }

    if (world.beforeEvents?.itemUse) {
        world.beforeEvents.itemUse.subscribe((event) => {
            if (tryUseVanishExitItem(event)) return;
            cancelVanishedItemInteraction(event);
        });
    }

    if (world.beforeEvents?.itemUseOn) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            if (tryUseVanishExitItem(event)) return;
            cancelVanishedItemInteraction(event);
        });
    }

    if (world.beforeEvents?.itemStartUse) {
        world.beforeEvents.itemStartUse.subscribe((event) => {
            if (tryUseVanishExitItem(event)) return;
            cancelVanishedItemInteraction(event);
        });
    }

    if (world.afterEvents?.entitySpawn) {
        world.afterEvents.entitySpawn.subscribe((event) => {
            try {
                stripProjectileFromVanishedOwner(event.entity);
            } catch (e) {}
        });
    }

    if (world.afterEvents?.effectAdd) {
        world.afterEvents.effectAdd.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== 'minecraft:player') return;
            if (!isVanished(entity)) return;
            if (isVanishInvisibilityType(event.effect)) return;
            system.run(() => {
                if (!isVanished(entity)) return;
                stripNonVanishStatusEffects(entity);
                applyVanishInvisibility(entity);
            });
        });
    }

    if (world.afterEvents?.playerGameModeChange) {
        world.afterEvents.playerGameModeChange.subscribe((event) => {
            const player = event.player;
            if (!player || !isVanished(player)) return;
            if (internalVanishGameModeSwitch.has(player.id)) return;
            if (event.toGameMode === VANISH_GM_CREATIVE) return;

            system.run(() => ensureCreativeVanish(player));
        });
    }

    if (world.afterEvents?.playerInventoryItemChange) {
        world.afterEvents.playerInventoryItemChange.subscribe((event) => {
            const player = event.player;
            if (!player || !isVanished(player)) return;
            if (!playerCarriesItems(player)) return;

            system.run(() => {
                if (!isVanished(player)) return;
                if (hasVanishStorage(player)) {
                    mergeCarryIntoVanishStorage(player);
                } else {
                    applyVanishEffects(player);
                }
            });
        });
    }

    function tickVanishLightSync() {
        const vanished = getCachedPlayersWithTag(VANISH_TAG);
        if (!vanished.length) return;

        for (const player of vanished) {
            if (isVanished(player)) applyVanishLightSync(player);
        }
    }

    registerRealmHook(REALM_STAGGER.MEDIUM, tickVanishLightSync);
}
