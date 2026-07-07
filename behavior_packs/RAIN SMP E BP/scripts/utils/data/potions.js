import { ItemComponentTypes, ItemStack, system, world } from '@minecraft/server';
import { notify, onRealmFrame } from '../realmPerf.js';

/** Infestation potions are disabled server-wide. */
export const INFESTED_POTION_DURATION_TICKS = 1;

export const INFESTED_POTION_30_ID = 'viberater:infested_potion_30';
export const INFESTED_SPLASH_POTION_30_ID = 'viberater:infested_splash_potion_30';
export const INFESTED_LINGERING_POTION_30_ID = 'viberater:infested_lingering_potion_30';
export const INFESTED_ROLE_TAG = 'rank:infested';

const INFESTED_DISPLAY_MARKER = '§r§kINF30';
const INFESTED_READY_KEY = 'rain:inf30_ready';
const INFESTED_CAP_EVERY_LOOPS = 4;
const INFESTED_SYNC_EVERY_LOOPS = 4;
const INFESTED_STRIP_EVERY_LOOPS = 30;
const INFESTED_PROJECTILE_CLEANUP_RADIUS = 5;
const INFESTED_BLOCK_CONTAINER_TYPES = new Set([
    'minecraft:dispenser',
    'minecraft:dropper',
    'minecraft:hopper',
]);

let infestedCapRot = 0;
let infestedSyncRot = 0;

const CUSTOM_INFESTED_POTIONS = {
    [INFESTED_POTION_30_ID]: {
        title: 'Potion of Infestation (0:30)',
        textureKey: 'minecraft:infested_potion',
    },
    [INFESTED_SPLASH_POTION_30_ID]: {
        title: 'Splash Potion of Infestation (0:30)',
        textureKey: 'minecraft:infested_splash_potion',
    },
    [INFESTED_LINGERING_POTION_30_ID]: {
        title: 'Lingering Potion of Infestation (0:30)',
        textureKey: 'minecraft:infested_lingering_potion',
    },
};

const VANILLA_INFESTED_POTION_TO_CUSTOM = {
    'minecraft:potion': INFESTED_POTION_30_ID,
    'minecraft:splash_potion': INFESTED_SPLASH_POTION_30_ID,
    'minecraft:lingering_potion': INFESTED_LINGERING_POTION_30_ID,
};

const POTION_META = {
    mundane: { potionOf: 'Mundane', effectName: 'Mundane' },
    thick: { potionOf: 'Thick', effectName: 'Thick' },
    awkward: { potionOf: 'Awkward', effectName: 'Awkward' },
    nightvision: { potionOf: 'Night Vision', effectName: 'Night Vision' },
    invisibility: { potionOf: 'Invisibility', effectName: 'Invisibility' },
    leaping: { potionOf: 'Leaping', effectName: 'Jump Boost' },
    fire_resistance: { potionOf: 'Fire Resistance', effectName: 'Fire Resistance' },
    swiftness: { potionOf: 'Swiftness', effectName: 'Speed' },
    slowness: { potionOf: 'Slowness', effectName: '§cSlowness' },
    water_breathing: { potionOf: 'Water Breathing', effectName: 'Water Breathing' },
    healing: { potionOf: 'Healing', effectName: 'Instant Health' },
    harming: { potionOf: 'Harming', effectName: '§cInstant Damage' },
    poison: { potionOf: 'Poison', effectName: '§cPoison' },
    regeneration: { potionOf: 'Regeneration', effectName: 'Regeneration' },
    strength: { potionOf: 'Strength', effectName: 'Strength' },
    weakness: { potionOf: 'Weakness', effectName: '§cWeakness' },
    slow_falling: { potionOf: 'Slow Falling', effectName: 'Slow Falling' },
    wither: { potionOf: 'Decay', effectName: '§cWither' },
    turtle_master: { potionOf: 'the Turtle Master', effectName: '§cSlowness' },
    wind_charged: { potionOf: 'Wind Charging', effectName: '§cWind Charged' },
    weaving: { potionOf: 'Weaving', effectName: '§cWeaving' },
    oozing: { potionOf: 'Oozing', effectName: '§cOozing' },
    infested: { potionOf: 'Infestation', effectName: '§cInfested' },
};
const STRONG_LEVEL = {
    slowness: 4,
    turtle_master: 4,
    leaping: 2,
    swiftness: 2,
    strength: 2,
    healing: 2,
    harming: 2,
    regeneration: 2,
    poison: 2,
};
const FALLBACK_EFFECTS = {
    wither: (durationTicks) => [{ name: POTION_META.wither.effectName, amplifier: 2, durationTicks }],
    turtle_master: (durationTicks) => [
        { name: POTION_META.turtle_master.effectName, amplifier: 4, durationTicks },
        { name: 'Resistance', amplifier: 3, durationTicks },
    ],
};
function titleCaseKey(key) {
    return key.replace(/_/g, ' ').replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}
function stripNamespace(id) {
    return id.includes(':') ? id.split(':')[1] : id;
}
function normalizePotionEffectId(rawId) {
    const id = stripNamespace(rawId);
    let isLong = false;
    let isStrong = false;
    let base = id;
    if (base.startsWith('long_')) {
        isLong = true;
        base = base.slice('long_'.length);
    }
    else if (base.startsWith('strong_')) {
        isStrong = true;
        base = base.slice('strong_'.length);
    }
    return { base, isLong, isStrong };
}
function readAmplifier1Based(value) {
    const raw = value?.amplifier ?? value?.amplifierLevel ?? value?.level ?? value?.effectLevel ?? value?.amplifier_level;
    return typeof raw === 'number' ? raw + 1 : undefined;
}
function tryReadEffectList(potionComponent) {
    const candidateMethods = [potionComponent?.getPotionEffects, potionComponent?.getEffects, potionComponent?.getStatusEffects];
    const effectListMethod = candidateMethods.find((method) => typeof method === 'function');
    if (!effectListMethod)
        return null;
    try {
        const list = effectListMethod.call(potionComponent);
        if (!Array.isArray(list) || list.length === 0)
            return null;
        return list.map((entry) => {
            const rawId = stripNamespace(entry?.type?.id ?? entry?.id ?? '');
            const { base } = normalizePotionEffectId(rawId);
            const meta = POTION_META[base] ?? {
                potionOf: titleCaseKey(base),
                effectName: titleCaseKey(base),
            };
            const amplifier = readAmplifier1Based(entry) ?? 1;
            const durationTicks = entry?.durationTicks ?? entry?.duration ?? 0;
            return { name: meta.effectName, amplifier, durationTicks };
        });
    }
    catch {
        return null;
    }
}
export function ticksToMSS(ticks) {
    const totalSeconds = Math.max(0, Math.floor(ticks / 20));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(1, '0')}:${String(seconds).padStart(2, '0')}`;
}
export function toRoman(value) {
    if (value <= 0)
        return '';
    if (value === 1)
        return 'I';
    if (value === 2)
        return 'II';
    if (value === 3)
        return 'III';
    if (value === 4)
        return 'IV';
    if (value === 5)
        return 'V';
    return String(value);
}
export function getPotionKind(itemTypeId) {
    if (itemTypeId === 'minecraft:potion')
        return 'potion';
    if (itemTypeId === 'minecraft:splash_potion')
        return 'splash';
    if (itemTypeId === 'minecraft:lingering_potion')
        return 'lingering';
    return null;
}
export function buildPotionDisplay(item) {
    const customDisplay = CUSTOM_INFESTED_POTIONS[item.typeId];
    if (customDisplay) {
        return {
            textureKey: customDisplay.textureKey,
            displayName: customDisplay.title,
            effectLines: [getInfestedEffectLoreLine()],
            whenAppliedLines: [],
        };
    }

    const kind = getPotionKind(item.typeId);
    if (!kind)
        return null;
    const potionComponent = item.getComponent(ItemComponentTypes.Potion);
    if (!potionComponent)
        return null;
    const potionEffectType = potionComponent.potionEffectType;
    if (!potionEffectType)
        return null;
    const { base, isStrong } = normalizePotionEffectId(potionEffectType.id);
    const meta = POTION_META[base] ?? {
        potionOf: titleCaseKey(base),
        effectName: titleCaseKey(base),
    };
    const kindLabel = kind === 'potion' ? 'Potion' : kind === 'splash' ? 'Splash Potion' : 'Lingering Potion';
    const displayName = `${kindLabel} of ${meta.potionOf}`;
    const suffix = kind === 'potion' ? 'potion' : kind === 'splash' ? 'splash_potion' : 'lingering_potion';
    const textureKey = `minecraft:${base}_${suffix}`;
    const defaultDurationTicks = potionEffectType.durationTicks ?? 0;
    let effects = tryReadEffectList(potionComponent);
    if (!effects) {
        const componentLevel = readAmplifier1Based(potionEffectType);
        const inferredLevel = isStrong ? STRONG_LEVEL[base] ?? 2 : 1;
        const amplifier = componentLevel ?? inferredLevel;
        const fallbackBuilder = FALLBACK_EFFECTS[base];
        effects = fallbackBuilder ? fallbackBuilder(defaultDurationTicks, amplifier) : [{ name: meta.effectName, amplifier, durationTicks: defaultDurationTicks }];
    }

    if (base === 'infested') {
        effects = effects.map((effect) => ({
            ...effect,
            durationTicks: INFESTED_POTION_DURATION_TICKS,
        }));
    }

    const effectLines = effects.map((effect) => {
        const ticks = effect.durationTicks ?? 0;
        const totalSeconds = Math.floor(ticks / 20);
        const amplifierSuffix = effect.amplifier && effect.amplifier > 1 ? ` ${toRoman(effect.amplifier)}` : '';
        if (totalSeconds <= 0)
            return `${effect.name}${amplifierSuffix}`;
        return `${effect.name}${amplifierSuffix} (${ticksToMSS(ticks)})`;
    });
    const primaryAmplifier = effects[0]?.amplifier ?? 1;
    let whenAppliedLines = [];
    switch (base) {
        case 'swiftness': {
            const percent = 20 * primaryAmplifier;
            whenAppliedLines = [`§r\n\n§5When Applied:\n§r§9+${percent}% Speed`];
            break;
        }
        case 'slowness': {
            const percent = 15 * primaryAmplifier;
            whenAppliedLines = [`§r\n\n§5When Applied:\n§r§c-${percent}% Speed`];
            break;
        }
        case 'strength': {
            let amount = 1.3 * primaryAmplifier;
            if (amount === 2.6)
                amount = 2.99;
            whenAppliedLines = [`§r\n\n§5When Applied:\n§r§9+${amount} Attack Damage`];
            break;
        }
        case 'weakness': {
            const amount = 0.7 * primaryAmplifier;
            whenAppliedLines = [`§r\n\n§5When Applied:\n§r§c-${amount} Attack Damage`];
            break;
        }
        case 'turtle_master': {
            whenAppliedLines = [`§r\n\n§5When Applied:\n§r§c-60% Speed`];
            break;
        }
        default: {
            whenAppliedLines = [];
            break;
        }
    }
    return { textureKey, displayName, effectLines, whenAppliedLines };
}

export function isInfestedPotionStack(item) {
    if (!item) return false;
    if (CUSTOM_INFESTED_POTIONS[item.typeId]) return true;

    const potionComponent = item.getComponent(ItemComponentTypes.Potion);
    if (!potionComponent) return false;

    const pet = potionComponent.potionEffectType;
    const rawIds = [pet?.id, pet?.type?.id, pet?.typeId].filter(Boolean).map(String);
    for (const raw of rawIds) {
        if (normalizePotionEffectId(raw).base === 'infested') return true;
    }

    const effects = tryReadEffectList(potionComponent);
    if (effects?.some((effect) => String(effect.name || '').toLowerCase().includes('infested'))) {
        return true;
    }

    return false;
}

export function isInfestedEffectType(typeId) {
    const id = String(typeId || '').toLowerCase();
    return id === 'minecraft:infested' || id === 'infested' || id.endsWith(':infested');
}

function getEffectAddTypeId(event) {
    try {
        if (event.effectType != null) {
            const effectType = event.effectType;
            if (typeof effectType === 'string') return effectType;
            if (typeof effectType === 'object') {
                return String(effectType.id ?? effectType.typeId ?? '');
            }
        }
    } catch (e) {}

    try {
        return String(event.effect?.typeId ?? '');
    } catch (e) {
        return '';
    }
}

function getEffectAddDuration(event) {
    try {
        if (typeof event.duration === 'number') return event.duration;
        return Number(event.effect?.duration ?? 0);
    } catch (e) {
        return 0;
    }
}

export function hasInfestedRole(player) {
    if (!player) return false;

    return (
        player.hasTag(INFESTED_ROLE_TAG)
        || player.hasTag('Infested')
        || player.hasTag('infested')
    );
}

function blockInfestedPotionUse(player) {
    notify(
        player,
        'infested_potion_blocked',
        '§c[RESTRICTED]',
        '§7Infestation potions are disabled.',
        'note.bass'
    );
}

function removeInfestedEffectFromEntity(entity) {
    if (!entity) return;

    try {
        entity.removeEffect('minecraft:infested');
    } catch (e) {}

    try {
        entity.removeEffect('infested');
    } catch (e) {}
}

function stripInfestedPotionsFromContainer(container) {
    if (!container) return false;
    let removed = false;

    for (let i = 0; i < container.size; i++) {
        try {
            const stack = container.getItem(i);
            if (!stack || !isInfestedPotionStack(stack)) continue;
            container.setItem(i, undefined);
            removed = true;
        } catch (e) {}
    }

    return removed;
}

function stripInfestedPotionsFromPlayer(player, notifyPlayer = false) {
    if (!player) return false;

    let removed = false;

    try {
        const inv = player.getComponent('minecraft:inventory')?.container
            ?? player.getComponent('inventory')?.container;
        if (stripInfestedPotionsFromContainer(inv)) {
            removed = true;
        }
    } catch (e) {}

    try {
        const equippable = player.getComponent('minecraft:equippable');
        const offhand = equippable?.getEquipment('Offhand');
        if (offhand && isInfestedPotionStack(offhand)) {
            equippable.setEquipment('Offhand', undefined);
            removed = true;
        }
    } catch (e) {}

    if (removed && notifyPlayer) {
        blockInfestedPotionUse(player);
    }

    return removed;
}

function stripInfestedPotionsFromBlock(block) {
    if (!block) return false;
    const typeId = String(block.typeId || '').toLowerCase();
    if (!INFESTED_BLOCK_CONTAINER_TYPES.has(typeId)) return false;

    try {
        const inv = block.getComponent('minecraft:inventory')?.container
            ?? block.getComponent('inventory')?.container;
        return stripInfestedPotionsFromContainer(inv);
    } catch (e) {
        return false;
    }
}

function getInfestedEffectLoreLine() {
    return `${POTION_META.infested.effectName} (${ticksToMSS(INFESTED_POTION_DURATION_TICKS)})`;
}

function getInfestedPotionTitle(stack) {
    if (CUSTOM_INFESTED_POTIONS[stack.typeId]) {
        return CUSTOM_INFESTED_POTIONS[stack.typeId].title;
    }

    const kind = getPotionKind(stack.typeId);
    if (kind === 'splash') return 'Splash Potion of Infestation (0:30)';
    if (kind === 'lingering') return 'Lingering Potion of Infestation (0:30)';
    return 'Potion of Infestation (0:30)';
}

function hasInfestedDisplayMarker(lore) {
    return Array.isArray(lore) && lore.some((line) => String(line).includes('INF30'));
}

function isInfestedDisplaySynced(stack) {
    if (!stack) return false;

    const lore = stack.getLore?.() ?? [];
    return stack.nameTag === getInfestedPotionTitle(stack)
        && lore.length === 2
        && lore[0] === getInfestedEffectLoreLine()
        && hasInfestedDisplayMarker(lore);
}

function createCustomInfestedStack(typeId, amount) {
    const stack = new ItemStack(typeId, amount);
    stack.nameTag = CUSTOM_INFESTED_POTIONS[typeId].title;
    stack.setLore([getInfestedEffectLoreLine(), INFESTED_DISPLAY_MARKER]);
    return stack;
}

function syncInfestedPotionStack(stack) {
    if (!stack || !isInfestedPotionStack(stack)) return stack;

    const customTypeId = VANILLA_INFESTED_POTION_TO_CUSTOM[stack.typeId];
    if (customTypeId) {
        return createCustomInfestedStack(customTypeId, stack.amount);
    }

    if (isInfestedDisplaySynced(stack)) return stack;

    const updated = stack.clone();
    updated.nameTag = getInfestedPotionTitle(updated);
    updated.setLore([getInfestedEffectLoreLine(), INFESTED_DISPLAY_MARKER]);
    return updated;
}

function syncInfestedPotionStacksInContainer(container) {
    if (!container) return false;

    let changed = false;

    for (let i = 0; i < container.size; i++) {
        const stack = container.getItem(i);
        if (!stack || !isInfestedPotionStack(stack)) continue;

        try {
            const synced = syncInfestedPotionStack(stack);
            if (synced !== stack) {
                container.setItem(i, synced);
                changed = true;
            }
        } catch (e) {}
    }

    return changed;
}

function containerHasUnsyncedInfestedPotions(container) {
    if (!container) return false;

    for (let i = 0; i < container.size; i++) {
        const stack = container.getItem(i);
        if (!stack || !isInfestedPotionStack(stack)) continue;
        if (VANILLA_INFESTED_POTION_TO_CUSTOM[stack.typeId]) return true;
        if (!isInfestedDisplaySynced(stack)) return true;
    }

    return false;
}

function playerHasUnsyncedInfestedPotions(player) {
    try {
        if (containerHasUnsyncedInfestedPotions(player.getComponent('minecraft:inventory')?.container)) {
            return true;
        }
    } catch (e) {}

    try {
        const offhand = player.getComponent('minecraft:equippable')?.getEquipment('Offhand');
        if (!offhand || !isInfestedPotionStack(offhand)) return false;
        if (VANILLA_INFESTED_POTION_TO_CUSTOM[offhand.typeId]) return true;
        return !isInfestedDisplaySynced(offhand);
    } catch (e) {}

    return false;
}

function isPlayerInfestedPotionsReady(player) {
    try {
        return player.getDynamicProperty(INFESTED_READY_KEY) === 1;
    } catch (e) {
        return false;
    }
}

function markPlayerInfestedPotionsReady(player) {
    try {
        player.setDynamicProperty(INFESTED_READY_KEY, 1);
    } catch (e) {}
}

function clearPlayerInfestedPotionsReady(player) {
    try {
        player.setDynamicProperty(INFESTED_READY_KEY, undefined);
    } catch (e) {}
}

function refreshPlayerInfestedPotionReadyFlag(player) {
    if (playerHasUnsyncedInfestedPotions(player)) {
        clearPlayerInfestedPotionsReady(player);
    } else {
        markPlayerInfestedPotionsReady(player);
    }
}

function syncPlayerInfestedPotions(player) {
    let changed = false;

    try {
        if (syncInfestedPotionStacksInContainer(player.getComponent('minecraft:inventory')?.container)) {
            changed = true;
        }
    } catch (e) {}

    try {
        const equippable = player.getComponent('minecraft:equippable');
        const offhand = equippable?.getEquipment('Offhand');
        if (!offhand || !isInfestedPotionStack(offhand)) {
            refreshPlayerInfestedPotionReadyFlag(player);
            return changed;
        }

        const synced = syncInfestedPotionStack(offhand);
        if (synced !== offhand) {
            equippable.setEquipment('Offhand', synced);
            changed = true;
        }
    } catch (e) {}

    refreshPlayerInfestedPotionReadyFlag(player);
    return changed;
}

/** Staggered realm tick — keep infestation disabled and clean up old stacks. */
export function tickInfestedPotionRealm(frame, players) {
    if (!players?.length) return;

    if (onRealmFrame(INFESTED_CAP_EVERY_LOOPS, frame)) {
        infestedCapRot = (infestedCapRot + 1) % players.length;
        const player = players[infestedCapRot];
        removeInfestedEffectFromEntity(player);
        if (onRealmFrame(INFESTED_STRIP_EVERY_LOOPS, frame)) {
            stripInfestedPotionsFromPlayer(player, false);
        }
    }

    if (!onRealmFrame(INFESTED_SYNC_EVERY_LOOPS, frame)) return;

    for (let attempt = 0; attempt < players.length; attempt++) {
        infestedSyncRot = (infestedSyncRot + 1) % players.length;
        const player = players[infestedSyncRot];

        if (!hasInfestedRole(player)) continue;
        if (isPlayerInfestedPotionsReady(player)) continue;

        syncPlayerInfestedPotions(player);
        return;
    }
}

function maybeClearInfestedReadyOnPotionChange(player, item, beforeItem) {
    if (!player) return;
    if (
        isInfestedPotionStack(item)
        || isInfestedPotionStack(beforeItem)
        || getPotionKind(item?.typeId)
        || getPotionKind(beforeItem?.typeId)
    ) {
        clearPlayerInfestedPotionsReady(player);
    }
}

function sanitizeInfestedEffectNearby(source, radius = INFESTED_PROJECTILE_CLEANUP_RADIUS) {
    if (!source?.dimension || !source.location) return;

    try {
        for (const entity of source.dimension.getEntities({ location: source.location, maxDistance: radius })) {
            removeInfestedEffectFromEntity(entity);
        }
    } catch (e) {}
}

export function capInfestedEffectOnEntity(entity) {
    if (!entity) return;
    removeInfestedEffectFromEntity(entity);
}

function consumeHeldStack(player, itemStack) {
    const inv = player.getComponent('minecraft:inventory')?.container;
    if (!inv) return;

    const slot = player.selectedSlotIndex;
    const held = inv.getItem(slot);
    if (!held || held.typeId !== itemStack.typeId) return;

    if (held.amount > 1) {
        held.amount -= 1;
        inv.setItem(slot, held);
    } else {
        inv.setItem(slot, undefined);
    }
}

export function startInfestedPotionRuntime() {
    if (world.beforeEvents?.effectAdd) {
        world.beforeEvents.effectAdd.subscribe((event) => {
            const typeId = getEffectAddTypeId(event);
            if (!typeId) return;
            if (!isInfestedEffectType(typeId) && !typeId.toLowerCase().includes('infested')) return;

            event.cancel = true;
            system.run(() => removeInfestedEffectFromEntity(event.entity));
        });
    }

    if (world.afterEvents?.effectAdd) {
        world.afterEvents.effectAdd.subscribe((event) => {
            if (!event.entity?.isValid) return;

            const typeId = getEffectAddTypeId(event);
            if (!typeId || (!isInfestedEffectType(typeId) && !typeId.toLowerCase().includes('infested'))) return;

            system.run(() => removeInfestedEffectFromEntity(event.entity));
        });
    }

    if (world.afterEvents?.itemCompleteUse) {
        world.afterEvents.itemCompleteUse.subscribe((event) => {
            const player = event.source;
            const item = event.itemStack;
            if (!player || player.typeId !== 'minecraft:player' || !isInfestedPotionStack(item)) return;

            system.run(() => {
                removeInfestedEffectFromEntity(player);
                stripInfestedPotionsFromPlayer(player, true);
            });
        });
    }

    if (world.beforeEvents?.itemUse) {
        world.beforeEvents.itemUse.subscribe((event) => {
            const player = event.source;
            const item = event.itemStack;
            if (!player || player.typeId !== 'minecraft:player' || !item) return;

            if (isInfestedPotionStack(item)) {
                event.cancel = true;
                system.run(() => {
                    stripInfestedPotionsFromPlayer(player, true);
                    removeInfestedEffectFromEntity(player);
                });
                return;
            }
        });
    }

    if (world.afterEvents?.playerInventoryItemChange) {
        world.afterEvents.playerInventoryItemChange.subscribe((event) => {
            const player = event.player;
            const item = event.itemStack;
            const beforeItem = event.beforeItemStack;

            if (isInfestedPotionStack(item) || isInfestedPotionStack(beforeItem)) {
                system.run(() => stripInfestedPotionsFromPlayer(player, false));
                return;
            }

            maybeClearInfestedReadyOnPotionChange(player, item, beforeItem);
        });
    }

    if (world.beforeEvents?.playerInteractWithBlock) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
            const player = event.player;
            const block = event.block;
            if (!player || !block) return;

            system.run(() => {
                if (stripInfestedPotionsFromBlock(block)) {
                    blockInfestedPotionUse(player);
                }
            });
        });
    }

    if (world.afterEvents?.playerPlaceBlock) {
        world.afterEvents.playerPlaceBlock.subscribe((event) => {
            const block = event.block;
            if (!block) return;
            system.run(() => stripInfestedPotionsFromBlock(block));
        });
    }

    if (world.afterEvents?.entitySpawn) {
        world.afterEvents.entitySpawn.subscribe((event) => {
            const entity = event.entity;
            if (!entity?.isValid) return;

            const typeId = String(entity.typeId || '').toLowerCase();
            if (!typeId.includes('potion') && typeId !== 'minecraft:area_effect_cloud') return;

            system.run(() => sanitizeInfestedEffectNearby(entity));
            system.runTimeout(() => sanitizeInfestedEffectNearby(entity), 2);
            system.runTimeout(() => sanitizeInfestedEffectNearby(entity), 10);
        });
    }

    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((event) => {
            if (!event.player) return;
            system.run(() => {
                stripInfestedPotionsFromPlayer(event.player);
                removeInfestedEffectFromEntity(event.player);
            });
        });
    }
}
