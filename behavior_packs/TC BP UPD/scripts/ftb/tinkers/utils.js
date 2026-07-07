import { EntityComponentTypes, EquipmentSlot, Direction } from '@minecraft/server';
import { ItemUtils as y, PlayerUtils as R } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

/**
 * Simple helper to test for if an entity is a player
 */
function isEntityPlayer(entity) {
    return entity && entity.typeId === "minecraft:player";
}
/**
 * Wrapper around the player send message to send a translated message using the key
 */
function sendTranslated(player, key, withData = undefined) {
    try {
        player.sendMessage({
            translate: key,
            ...(withData ? { with: withData } : {})
        });
    }
    catch (e) {
        console.warn(`Failed to send message to player: ${e}`, key, JSON.stringify(withData));
    }
}
/**
 * Either gives the item back to the player or drops it on the ground if they have no space
 *
 * @param player target player
 * @param stack item to give
 * @param dropLocation drop location, defaults to player location
 * @returns true if the item was given to the player, false if it failed
 */
function giveItemToPlayer(player, stack, dropLocation = player.location) {
    const equipment = player.getComponent(EntityComponentTypes.Equippable);
    if (equipment) {
        // Try and put in the main hand
        const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
        if (!mainHand) {
            equipment.setEquipment(EquipmentSlot.Mainhand, stack);
            return true;
        }
    }
    // Fine, let's try and put it in their inventory
    const inventory = player.getComponent(EntityComponentTypes.Inventory);
    if (!inventory) {
        return false;
    }
    const result = inventory.container.addItem(stack);
    if (!result) {
        return true;
    }
    // Right, I guess we drop it on the ground
    player.dimension.spawnItem(stack, dropLocation);
    return true;
}
function exchangeMainHandItem(player, newStack, dropLocation = player.location) {
    const equipment = player.getComponent(EntityComponentTypes.Equippable);
    if (equipment) {
        const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
        let handWillBeEmpty = !mainHand;
        if (mainHand) {
            const newAmount = mainHand.amount - 1;
            handWillBeEmpty = newAmount <= 0;
            if (!handWillBeEmpty) {
                mainHand.amount = newAmount;
            }
            // Regardless of the new amount, update the equipment
            equipment.setEquipment(EquipmentSlot.Mainhand, !handWillBeEmpty ? mainHand : undefined);
        }
        if (handWillBeEmpty) {
            // Give the item to the player
            equipment.setEquipment(EquipmentSlot.Mainhand, newStack);
            return true;
        }
    }
    // Otherwise give the item in a normal way
    return giveItemToPlayer(player, newStack, dropLocation);
}
function updateBucket(player, heldItem, newStack) {
    const itemStack = y.shrinkItemStack(heldItem, 1);
    if (!itemStack) {
        R.overrideHeldItem(player, newStack);
    }
    else {
        R.overrideHeldItem(player, itemStack);
        giveItemToPlayer(player, newStack);
    }
}
function areArraysEqualStrict(recipeState, currentState) {
    if (recipeState.length !== currentState.length) {
        return false;
    }
    for (let i = 0; i < recipeState.length; i++) {
        if (recipeState[i] !== currentState[i]) {
            return false;
        }
    }
    return true;
}
function getOppositeDirection(direction) {
    switch (direction) {
        case Direction.North:
            return Direction.South;
        case Direction.South:
            return Direction.North;
        case Direction.East:
            return Direction.West;
        case Direction.West:
            return Direction.East;
        case Direction.Up:
            return Direction.Down;
        case Direction.Down:
            return Direction.Up;
    }
}
function getDirectionFromFacing(facing) {
    switch (facing) {
        case 0:
            return Direction.Down;
        // 1 is not a possible block state (aka no facing somehow)
        case 2:
            return Direction.North;
        case 3:
            return Direction.South;
        case 4:
            return Direction.West;
        case 5:
            return Direction.East;
        default:
            throw new Error(`Invalid facing direction: ${facing}`);
    }
}

export { areArraysEqualStrict, exchangeMainHandItem, getDirectionFromFacing, getOppositeDirection, giveItemToPlayer, isEntityPlayer, sendTranslated, updateBucket };
