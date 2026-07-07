import { system, world, GameMode, EquipmentSlot } from '@minecraft/server';
import { REALM_STAGGER, notify, registerRealmHook, getCachedPlayersWithTag, getRealmPlayers, refreshRealmPlayers } from './realmPerf.js';
import { hasPermission } from '../systems/ranks.js';
import { isLivePlayer } from './livePlayer.js';
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

const SPECTATOR_COMMAND = /^\s*(\/(gamemode|gm)\s+(spectator|sp|3|spec)\b|\/spectate\b)/i;

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

/** Ignore gamemode events we trigger ourselves when entering vanish. */
const internalSpectatorSwitch = new Set();

export function isVanished(player) {
    if (!isLivePlayer(player)) return false;

    try {
        const stored = player.getDynamicProperty(VANISH_DP_KEY);
        return stored === true || stored === 1 || player.hasTag(VANISH_TAG);
    } catch (e) {
        return false;
    }
}

export function canUseVanish(player) {
    if (!player) return false;

    return (
        player.hasTag('admin')
        || player.hasTag('staff')
        || player.hasTag('rank:owner')
        || player.hasTag('rank:coowner')
        || player.hasTag('rank:admin')
        || hasPermission(player, 'can_vanish')
    );
}

function getEquippable(player) {
    return player.getComponent('minecraft:equippable') || player.getComponent('equippable');
}

function getInventoryContainer(player) {
    return player.getComponent('minecraft:inventory')?.container
        || player.getComponent('inventory')?.container;
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

            storage.inventory[findNextStorageInventoryKey(storage.inventory)] =
                buildItemDataFromItemStack(item);
            changed = true;
        }
    }

    if (eq) {
        for (const slot of VANISH_EQUIP_SLOTS) {
            const item = eq.getEquipment(slot);
            if (!item) continue;

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

    try {
        player.runCommandAsync('effect @s clear');
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
    if (mode === GameMode.creative || mode === GameMode.adventure || mode === GameMode.survival) {
        return mode;
    }

    const name = String(mode ?? '').toLowerCase();
    if (name.includes('creative')) return GameMode.creative;
    if (name.includes('adventure')) return GameMode.adventure;
    if (name.includes('spectator')) return GameMode.spectator;
    return GameMode.survival;
}

function gameModeToCommand(mode) {
    const normalized = normalizeGameMode(mode);
    if (normalized === GameMode.creative) return 'creative';
    if (normalized === GameMode.adventure) return 'adventure';
    if (normalized === GameMode.spectator) return 'spectator';
    return 'survival';
}

function saveVanishGameMode(player) {
    if (player.getDynamicProperty(VANISH_PREV_GM_KEY) !== undefined) return;

    const mode = normalizeGameMode(player.getGameMode?.());
    player.setDynamicProperty(
        VANISH_PREV_GM_KEY,
        mode === GameMode.spectator ? GameMode.survival : mode
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

function switchToSpectator(player) {
    internalSpectatorSwitch.add(player.id);

    try {
        player.setGameMode(GameMode.spectator);
    } catch (e) {
        try {
            player.runCommandAsync('gamemode spectator @s');
        } catch (err) {}
    }

    system.runTimeout(() => internalSpectatorSwitch.delete(player.id), 5);
}

function ensureSpectatorVanish(player) {
    if (player.getGameMode?.() === GameMode.spectator) return;

    switchToSpectator(player);

    system.runTimeout(() => {
        if (!isVanished(player)) return;
        if (player.getGameMode?.() !== GameMode.spectator) {
            switchToSpectator(player);
        }
    }, 5);
}

/** Exit vanish, restore loot/effects, stay in spectator. */
export function exitVanishToSpectator(player, showToast = true) {
    if (!player || !isVanished(player)) return false;

    clearVanishFlags(player);
    clearVanishEffects(player);
    restoreVanishStorage(player);
    restoreVanishStatusEffects(player);
    player.setDynamicProperty(VANISH_PREV_GM_KEY, undefined);
    switchToSpectator(player);
    applyVanishHiddenName(player);

    if (showToast) {
        notify(
            player,
            'admin_vanish_spectator_exit',
            '?5?l[VANISH]?r',
            '?7Vanish ended. Inventory restored in spectator.',
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

    ensureSpectatorVanish(player);
    stripAllStatusEffects(player);
    applyVanishHiddenName(player);
}

function applyVanishLightSync(player) {
    if (!player || !isVanished(player)) return;

    ensureSpectatorVanish(player);
    stripAllStatusEffects(player);
    applyVanishHiddenName(player);
}

function playerCarriesItems(player) {
    const inv = getInventoryContainer(player);
    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            if (inv.getItem(i)) return true;
        }
    }

    const eq = getEquippable(player);
    if (eq) {
        for (const slot of VANISH_EQUIP_SLOTS) {
            if (eq.getEquipment(slot)) return true;
        }
    }

    return false;
}

export function syncVanishPlayer(player, notifyOnRestore = false) {
    if (!isLivePlayer(player)) return false;
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

function isSpectatorCommand(message) {
    return SPECTATOR_COMMAND.test(String(message ?? '').trim());
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
            const player = event.player;
            system.runTimeout(() => {
                if (!isLivePlayer(player)) return;
                syncVanishPlayer(player, true);
            }, 1);
            system.runTimeout(() => {
                if (!isLivePlayer(player)) return;
                syncVanishPlayer(player, false);
            }, 20);
        });
    }

    if (world.beforeEvents?.itemUse) {
        world.beforeEvents.itemUse.subscribe((event) => {
            cancelVanishedItemInteraction(event);
        });
    }

    if (world.beforeEvents?.itemUseOn) {
        world.beforeEvents.itemUseOn.subscribe((event) => {
            cancelVanishedItemInteraction(event);
        });
    }

    if (world.beforeEvents?.itemStartUse) {
        world.beforeEvents.itemStartUse.subscribe((event) => {
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

    if (world.beforeEvents?.effectAdd) {
        world.beforeEvents.effectAdd.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== 'minecraft:player') return;
            if (!isVanished(entity)) return;
            event.cancel = true;
        });
    }

    if (world.afterEvents?.effectAdd) {
        world.afterEvents.effectAdd.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== 'minecraft:player') return;
            if (!isVanished(entity)) return;
            system.run(() => {
                if (!isVanished(entity)) return;
                stripAllStatusEffects(entity);
            });
        });
    }

    if (world.beforeEvents?.chatSend) {
        world.beforeEvents.chatSend.subscribe((event) => {
            const player = event.sender;
            if (!player || !isVanished(player)) return;
            if (!isSpectatorCommand(event.message)) return;

            system.run(() => exitVanishToSpectator(player));
        });
    }

    if (world.afterEvents?.playerGameModeChange) {
        world.afterEvents.playerGameModeChange.subscribe((event) => {
            const player = event.player;
            if (!player || !isVanished(player)) return;
            if (internalSpectatorSwitch.has(player.id)) return;
            if (event.toGameMode !== GameMode.spectator) return;

            system.run(() => exitVanishToSpectator(player, false));
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
            if (!isLivePlayer(player)) continue;
            if (isVanished(player)) applyVanishLightSync(player);
        }
    }

    registerRealmHook(REALM_STAGGER.MEDIUM, tickVanishLightSync);
}
