import { world, GameMode, EntityComponentTypes, EquipmentSlot, ItemComponentTypes, ItemStack } from '@minecraft/server';
import { getRepairMaterialFromTypeId } from './item_properties.js';
import { OtherConstants } from './constants.js';

/**
 * Durability system
 */
world.afterEvents.entityHitEntity.subscribe((eventData) => {
    const { damagingEntity, hitEntity } = eventData;
    if (damagingEntity === undefined || hitEntity === undefined) {
        return;
    }
    if (damagingEntity.typeId !== "minecraft:player") {
        return;
    }
    const player = damagingEntity;
    if (player.getGameMode() !== GameMode.Survival) {
        return;
    }
    const equipment = player?.getComponent(EntityComponentTypes.Equippable);
    if (!equipment) {
        return;
    }
    const item = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!item || !isTinkersTool(item)) {
        return;
    }
    if (!shouldTakeDurabilityDamage(item)) {
        return;
    }
    updateDurability(item, player);
});
world.afterEvents.playerBreakBlock.subscribe((eventData) => {
    const player = eventData.player;
    const item = eventData.itemStackBeforeBreak;
    if (!item || !isTinkersTool(item)) {
        return;
    }
    if (!shouldTakeDurabilityDamage(item)) {
        return;
    }
    if (player.getGameMode() !== GameMode.Survival) {
        return;
    }
    // Check if the player is holding it
    const equipment = player.getComponent(EntityComponentTypes.Equippable);
    if (!equipment) {
        return;
    }
    const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
    if (!mainHand) {
        return;
    }
    updateDurability(item, player);
});
function updateDurability(item, player, reset = false, amount = 1) {
    if (player.getGameMode() !== GameMode.Survival) {
        return;
    }
    const equipment = player.getComponent(EntityComponentTypes.Equippable);
    if (!equipment) {
        return;
    }
    const lore = item.getLore();
    const hadDurability = lore.length > 0 && lore.find((line) => line.startsWith("§r§6Durability:")) !== undefined;
    if (reset) {
        // Load the durability from the item properties
        const durabilityComponent = item.getComponent(ItemComponentTypes.Durability);
        if (durabilityComponent) {
            setDurability(equipment, item, durabilityComponent, 0);
        }
        return;
    }
    if (hadDurability) {
        const currentDurability = lore.find((line) => line.includes("Durability:"));
        if (currentDurability) {
            const durability = parseInt(currentDurability.split("/")[0].split(":")[1].trim().replace(/\D/g, '')) - 1;
            // Set the old lore durability to the new one
            const durabilityComponent = item.getComponent(ItemComponentTypes.Durability);
            if (durabilityComponent) {
                const maxDurability = durabilityComponent.maxDurability;
                durabilityComponent.damage = maxDurability - durability;
                item.setLore(undefined);
                equipment.setEquipment(EquipmentSlot.Mainhand, item);
            }
        }
    }
    const durabilityComponent = item.getComponent(ItemComponentTypes.Durability);
    if (durabilityComponent === undefined) {
        return;
    }
    const currentDurability = durabilityComponent.damage;
    const maxDurability = durabilityComponent.maxDurability;
    if (currentDurability >= maxDurability) {
        player.playSound("random.break");
        equipment.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:air"));
        return;
    }
    if (currentDurability == maxDurability - 25) {
        player.playSound("random.orb", {
            pitch: 0.5,
        });
        player.sendMessage("Tool alert! Only 25 durability left - repair or switch tools");
    }
    if (currentDurability == maxDurability - 10) {
        player.playSound("random.orb", {
            pitch: 0.5,
        });
        player.sendMessage("Tool alert! Only 10 durability left - repair or switch tools");
    }
    if (currentDurability >= maxDurability - 1) {
        player.playSound("random.orb", {
            pitch: 0.5,
        });
        player.sendMessage("Tool alert! 1 durability left - use with caution or switch now!");
    }
    let unbreaking = 0;
    if (item.hasComponent(ItemComponentTypes.Enchantable)) {
        const unbreakingEnchant = item.getComponent(ItemComponentTypes.Enchantable)?.getEnchantment("unbreaking");
        if (!unbreakingEnchant) {
            unbreaking = 0;
        }
        else {
            unbreaking = unbreakingEnchant.level;
        }
    }
    // TODO: Test me plz
    let newAmount = amount;
    if (unbreaking > 0) {
        for (let i = 0; i < amount; i++) {
            const randomRole = Math.round(Math.random() * 100);
            const chance = durabilityComponent.getDamageChance(unbreaking);
            if (randomRole < chance) {
                newAmount--;
            }
        }
    }
    if (newAmount === 0) {
        return;
    }
    setDurability(equipment, item, durabilityComponent, Math.min(durabilityComponent.maxDurability, durabilityComponent.damage + amount));
}
function setDurability(equipment, item, durabilityComponent, damageValue) {
    durabilityComponent.damage = damageValue;
    const durabilityString = `§7Damage: §6${durabilityComponent.maxDurability - durabilityComponent.damage}§7 / §6${durabilityComponent.maxDurability}§r`;
    const lore = item.getLore();
    const durabilityLoreEntry = lore.findIndex((line) => line.includes("Damage:"));
    if (durabilityLoreEntry === -1) {
        lore.push(durabilityString);
    }
    else {
        lore[durabilityLoreEntry] = durabilityString;
    }
    item.setLore(lore);
    equipment.setEquipment(EquipmentSlot.Mainhand, item);
}
function getDurability(itemStack) {
    const durabilityComponent = itemStack.getComponent(ItemComponentTypes.Durability);
    if (!durabilityComponent) {
        return null;
    }
    return durabilityComponent;
}
/**
 * Repair system
 */
world.afterEvents.itemUse.subscribe((eventData) => {
    const player = eventData.source;
    const item = eventData.itemStack;
    const equipment = player.getComponent(EntityComponentTypes.Equippable);
    if (equipment === undefined) {
        return;
    }
    if (!item.typeId.startsWith("ftb_tc:")) {
        return;
    }
    const offhandItem = equipment.getEquipment(EquipmentSlot.Offhand);
    if (isRepairItem(item) && !offhandItem) {
        player.runCommand(`/replaceitem entity @s slot.weapon.offhand 0 ${item.typeId}`);
        equipment.setEquipment(EquipmentSlot.Mainhand, new ItemStack("minecraft:air"));
        return;
    }
    if (offhandItem && isRepairItem(offhandItem) && isTinkersTool(item)) {
        const repairMaterial = getRepairItemMaterial(offhandItem);
        const [repairKey, repairItemMaterial] = getRepairItem(item);
        const durabilityComponent = item.getComponent(ItemComponentTypes.Durability);
        if (durabilityComponent) {
            const durability = durabilityComponent.damage;
            if (durability === 0) {
                player.sendMessage("Item is already at full durability");
                return;
            }
            if (repairMaterial !== repairItemMaterial) {
                player.sendMessage("Repair materials do not match");
                return;
            }
            player.runCommand(`replaceitem entity @s slot.weapon.offhand 0 minecraft:air`);
            updateDurability(item, player, true);
            player.playSound("ui.stonecutter.take_result", {
                pitch: 1.4,
                volume: 0.4
            });
            // Random int for the message between 1 and 3
            const randomId = Math.floor(Math.random() * 3) + 1;
            player.sendMessage({
                translate: `ftb_tc.messages.repair_item.success_${randomId}`,
            });
            return;
        }
    }
});
function isTinkersTool(item) {
    return item.typeId.startsWith("ftb_tc:") && (item.typeId.startsWith("ftb_tc:pickaxe") ||
        item.typeId.startsWith("ftb_tc:shoel") ||
        item.typeId.startsWith("ftb_tc:hand_axe") ||
        item.typeId.startsWith("ftb_tc:sword") ||
        item.typeId.startsWith("ftb_tc:cleaver") ||
        item.typeId.startsWith("ftb_tc:dagger") ||
        item.typeId.startsWith("ftb_tc:bow"));
}
function isRepairItem(item) {
    return item?.typeId.startsWith("ftb_tc:repair_item_");
}
function getRepairItemMaterial(item) {
    return item?.typeId.replace("ftb_tc:repair_item_", "");
}
function getRepairItem(item) {
    if (!item) {
        return null;
    }
    const { typeId } = item;
    if (!isTinkersTool(item)) {
        return null;
    }
    const repairMaterial = getRepairMaterialFromTypeId(typeId);
    if (!repairMaterial) {
        return null;
    }
    return [`ftb_tc:repair_item_${repairMaterial}`, repairMaterial];
}
function shouldTakeDurabilityDamage(item) {
    if (item?.typeId.includes("bronze")) {
        return OtherConstants.BRONZE_NO_BREAK_CHANCE <= Math.random();
    }
    return true;
}

export { getDurability, isTinkersTool, updateDurability };
