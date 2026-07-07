import { EntityComponentTypes, EquipmentSlot, ItemComponentTypes, EnchantmentTypes, ItemStack } from '@minecraft/server';
import { sendTranslated, giveItemToPlayer } from '../utils.js';
import { isModifierApplicable, modifierRegistry } from './modifier_registry.js';
import { numberToRomanNumaral } from '../utils/roman.js';
import { ItemUtils as y, tc as Ot } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const toolTableEntity = Ot("modifier_worktable");
const errors = {
    NO_TOOL: "ftb_tc.messages.modifiers.no_tool",
    NO_MODIFIER_ITEM: "ftb_tc.messages.modifiers.no_modifier_item",
    WRONG_ITEM_IN_TABLE: "ftb_tc.messages.modifiers.wrong_item_in_table",
    NO_AVAILABLE_SLOTS: "ftb_tc.messages.modifiers.no_available_slots",
    INVALID_TOOL: "ftb_tc.messages.modifiers.invalid_tool",
    NO_MODIFIERS_TO_REMOVE: "ftb_tc.messages.modifiers.none_to_remove",
    MODIFIER_REMOVED: "ftb_tc.messages.modifiers.removed",
    EMPTY_MODIFIER_USED: "ftb_tc.messages.modifiers.empty",
    NOT_COMPATIBLE: "ftb_tc.messages.modifiers.not_compatible",
    NO_CHANGES: "ftb_tc.messages.modifiers.no_changes",
};
const modifierRemoverItem = Ot("remove_modifier");
class ModifierComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            const player = event.player;
            if (!player) {
                return;
            }
            // Get the entity that is sitting in the space of the block
            const entities = player.dimension.getEntitiesAtBlockLocation(event.block.location);
            if (entities.length === 0) {
                return;
            }
            const tableEntity = entities.find(e => e.typeId === toolTableEntity);
            if (!tableEntity) {
                return;
            }
            const tableInventory = tableEntity.getComponent(EntityComponentTypes.Inventory);
            if (!tableInventory) {
                sendTranslated(player, errors.NO_TOOL);
                return;
            }
            const playerEquipment = player.getComponent(EntityComponentTypes.Equippable);
            if (!playerEquipment) {
                return;
            }
            // Get the players main hand
            const mainHandItem = playerEquipment.getEquipment(EquipmentSlot.Mainhand);
            const tool = tableInventory.container.getItem(0);
            // If the player interacts with an empty hand and the table has a tool, give the player the tool
            if (!mainHandItem && tool) {
                // Give the player the tool
                const result = giveItemToPlayer(player, tool, tableEntity.location);
                if (result) {
                    tableInventory.container.setItem(0, undefined);
                    // Run the command to simulate the item being set to the tabel
                    tableEntity.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 air`);
                }
                return;
            }
            // If the player interacts with a tool and the table is empty, put the tool in the table
            if (mainHandItem && !tool) {
                if (!isModifierApplicable(mainHandItem)) {
                    sendTranslated(player, errors.INVALID_TOOL);
                    return;
                }
                // Put the players tool in the table
                tableInventory.container.setItem(0, mainHandItem);
                playerEquipment.setEquipment(EquipmentSlot.Mainhand, undefined);
                // Run the command to simulate the item being set to the tabel
                tableEntity.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${mainHandItem.typeId}`);
                return;
            }
            // If the player interacts with "something" and the table has a tool, check if the player is holding a modifier item
            if (mainHandItem && tool) {
                if (mainHandItem.typeId === modifierRemoverItem) {
                    const removeResult = this.removeModifiers(tool);
                    if (!removeResult) {
                        sendTranslated(player, errors.NO_MODIFIERS_TO_REMOVE);
                        return;
                    }
                    const { mutatedStack, returnItems } = removeResult;
                    tableInventory.container.setItem(0, mutatedStack);
                    playerEquipment.setEquipment(EquipmentSlot.Mainhand, y.shrinkItemStack(mainHandItem));
                    // Drop the returned items
                    for (const item of returnItems) {
                        player.dimension.spawnItem(item, tableEntity.location);
                    }
                    sendTranslated(player, errors.MODIFIER_REMOVED);
                    return;
                }
                if (!this.itemIsModifierHolder(mainHandItem)) {
                    sendTranslated(player, errors.NO_MODIFIER_ITEM);
                    return;
                }
                // Check if the modifier is compatible with the tool
                // Check if the modifier is compatible with the other modifiers on the tool
                // Update the tool with the modifier
                const applyResult = this.applyModifierToTool(tableInventory, player, mainHandItem, tool);
                if (!applyResult) {
                    return;
                }
                // Give player feedback
                // Remove the modifier item from the player
                playerEquipment.setEquipment(EquipmentSlot.Mainhand, y.shrinkItemStack(mainHandItem));
            }
        };
    }
    applyModifierToTool(entityInventory, player, modifierItem, tool) {
        const modifier = modifierRegistry[modifierItem.typeId];
        if (!modifier) {
            return;
        }
        const toolModifiers = this.getModifiers(tool);
        const slots = this.getAvailableSlots(tool);
        const modifierIsOnTool = toolModifiers.find((mod) => mod.regName === modifierItem.typeId);
        if (slots.available === 0 && !modifierIsOnTool) {
            sendTranslated(player, errors.NO_AVAILABLE_SLOTS);
            return false;
        }
        const modifiedStack = this.addModifier(tool, modifierItem);
        if (typeof modifiedStack === "string") {
            sendTranslated(player, modifiedStack);
            return false;
        }
        entityInventory.container.setItem(0, modifiedStack);
        return true;
    }
    /**
     * Looks up the given modifier, checks if it's compatible with the tool and the other modifiers on the tool,
     * and applies it if it is compatible.
     *
     * TODO: Handle stacking issues with the slot counts when applying the same modifier to stack it
     *
     * @param itemStack the tool to apply the modifier to
     * @param modifier the modifier to apply
     */
    addModifier(itemStack, modifierItem) {
        const modifierItemId = modifierItem.typeId;
        const modifier = modifierRegistry[modifierItemId];
        if (!modifier) {
            return errors.EMPTY_MODIFIER_USED;
        }
        // Check if the modifier is compatible with the tool
        for (const check of modifier.incompatibleWithItemsChecks) {
            if (check(itemStack)) {
                return errors.NOT_COMPATIBLE;
            }
        }
        // Check if the modifier is compaible with other applied modifiers
        const toolModifiers = this.getModifiers(itemStack);
        for (const toolModifier of toolModifiers) {
            if (modifier.incompatibleWithModifiers?.includes(toolModifier.regName)) {
                return errors.NOT_COMPATIBLE;
            }
        }
        // Finally, what and how do we apply the modifier?
        let didSomething = false;
        let didStack = false;
        if (modifier.enchantments.length > 0) {
            const enchantments = itemStack.getComponent(ItemComponentTypes.Enchantable);
            if (enchantments) {
                // Apply enchantments
                let enchantmentsApplied = 0;
                for (const enchantment of modifier.enchantments) {
                    // Check the item for compatiablity
                    if (!enchantment.applierChecker(itemStack)) {
                        continue;
                    }
                    // Do we already have the enchant? If so, what level is it?
                    const currentEnchant = enchantments.getEnchantment(EnchantmentTypes.get(enchantment.enchantment));
                    const currentEnchantLevel = currentEnchant?.level || 0;
                    if (currentEnchantLevel !== 0) {
                        didStack = true;
                    }
                    if (currentEnchantLevel >= enchantment.max) {
                        continue;
                    }
                    enchantments.addEnchantment({
                        type: EnchantmentTypes.get(enchantment.enchantment),
                        level: currentEnchantLevel + 1,
                    });
                    enchantmentsApplied++;
                }
                // We failed to apply any enchantments
                if (enchantmentsApplied !== 0) {
                    didSomething = true;
                }
            }
        }
        if (modifier.properties.length > 0) {
            let appliedProps = 0;
            for (const { name, max } of modifier.properties) {
                const existing = itemStack.getDynamicProperty(name);
                if (!existing) {
                    itemStack.setDynamicProperty(name, 1);
                    appliedProps++;
                    continue;
                }
                if (existing >= max) {
                    continue;
                }
                itemStack.setDynamicProperty(name, existing + 1);
                appliedProps++;
                didStack = true;
            }
            if (appliedProps > 0) {
                didSomething = true;
            }
        }
        if (didSomething) {
            // Update the lore of the item
            this.updateModifiersLore(itemStack, modifier, modifierItemId, didStack);
        }
        return didSomething ? itemStack : errors.NO_CHANGES;
    }
    removeModifiers(itemStack) {
        // Find the modifier from the stack given, reverse it's effects, and return the new stack
        const modifiers = this.getModifiers(itemStack);
        if (modifiers.length === 0) {
            return null;
        }
        const returnItems = [];
        for (const { regName, modifier } of modifiers) {
            if (modifier.enchantments.length > 0) {
                const enchantments = itemStack.getComponent(ItemComponentTypes.Enchantable);
                if (enchantments) {
                    for (const enchant of enchantments.getEnchantments()) {
                        // Get the regname of that modifier
                        returnItems.push(new ItemStack(regName, enchant.level));
                    }
                    enchantments.removeAllEnchantments();
                }
            }
            if (modifier.properties.length > 0) {
                for (const { name } of modifier.properties) {
                    // Same as the above, track down the modifier so we can create a return item based on it
                    const propValue = itemStack.getDynamicProperty(name);
                    itemStack.setDynamicProperty(name, undefined);
                    returnItems.push(new ItemStack(regName, propValue ? propValue : 1));
                }
            }
        }
        const lore = itemStack.getLore();
        const newLore = lore.filter((line) => !line.startsWith("Modifiers: ") && !line.startsWith("Slots: "));
        itemStack.setLore(newLore);
        return {
            mutatedStack: itemStack,
            returnItems
        };
    }
    getModifiers(itemStack) {
        const lore = itemStack.getLore();
        if (!lore) {
            return [];
        }
        const modifiersLine = lore.find((line) => line.startsWith("Modifiers: "));
        if (!modifiersLine) {
            return [];
        }
        const modifiersParts = modifiersLine
            .replace("Modifiers: ", "")
            .split(", ")
            .map((part) => part.split(" ")[0].trim());
        const heldModifiers = [];
        const modifierRegKeys = Object.keys(modifierRegistry);
        for (const keys of modifierRegKeys) {
            const modifier = modifierRegistry[keys];
            if (modifiersParts.includes(modifier.displayName)) {
                heldModifiers.push({ regName: keys, modifier });
            }
        }
        return heldModifiers;
    }
    updateModifiersLore(stack, modifier, modifierRegName, stacked) {
        const lore = stack.getLore();
        if (!lore) {
            return; // HOW?!
        }
        const loreCopy = [...lore];
        const modifiersLine = lore.findIndex((line) => line.startsWith("Modifiers: "));
        let modifiers = [
            ...this.getModifiers(stack),
            { regName: modifierRegName, modifier },
        ];
        // Remove duplicates
        const seen = new Set();
        modifiers = modifiers.filter((item) => {
            const duplicate = seen.has(item.regName);
            seen.add(item.regName);
            return !duplicate;
        });
        // Figure out the correct level of the modifier
        for (const localMod of modifiers) {
            let highestLevel = 0;
            if (localMod.modifier.enchantments.length > 0) {
                for (const enchantment of localMod.modifier.enchantments) {
                    const enchantmentLevel = stack.getComponent(ItemComponentTypes.Enchantable)?.getEnchantment(EnchantmentTypes.get(enchantment.enchantment))?.level || 0;
                    if (enchantmentLevel > highestLevel) {
                        highestLevel = enchantmentLevel;
                    }
                }
            }
            if (localMod.modifier.properties.length > 0) {
                for (const { name } of localMod.modifier.properties) {
                    const propValue = stack.getDynamicProperty(name);
                    if (propValue && propValue > highestLevel) {
                        highestLevel = propValue;
                    }
                }
            }
            localMod.level = highestLevel;
        }
        const newModifiersData = `Modifiers: ${modifiers.map((t) => t.modifier.displayName + " " + numberToRomanNumaral(t.level ?? 1)).join(", ")}`;
        if (modifiersLine === -1) {
            loreCopy.push(newModifiersData);
        }
        else {
            loreCopy[modifiersLine] = newModifiersData;
        }
        // Only update the slot count if we're not stacking
        if (stacked) {
            stack.setLore(loreCopy);
            return;
        }
        // Update the slot count
        const slotsLine = lore.findIndex((line) => line.startsWith("Slots: "));
        const currentSlotsData = this.getAvailableSlots(stack);
        const newSlotsData = `Slots: ${currentSlotsData.used + 1}/${currentSlotsData.total}`;
        if (slotsLine === -1) {
            loreCopy.push(newSlotsData);
        }
        else {
            loreCopy[slotsLine] = newSlotsData;
        }
        stack.setLore(loreCopy);
    }
    /**
     * Checks if an item is the correct item to hold a modifier
     */
    itemIsModifierHolder(itemStack) {
        const id = itemStack.typeId;
        return id.startsWith("ftb_tc:") && id.endsWith("_modifier");
    }
    /**
     * Takes the lore of the item and parses the Slots: 0/3 into available slots
     */
    getAvailableSlots(itemStack) {
        const itemLore = itemStack.getLore();
        if (!itemLore) {
            return { available: 3, total: 3, used: 0 };
        }
        const line = itemLore.find((line) => line.includes("Slots:"));
        if (!line) {
            return { available: 3, total: 3, used: 0 };
        }
        const slots = line.split(":")[1].trim().split("/");
        if (slots.length !== 2) {
            return { available: 3, total: 3, used: 0 };
        }
        return {
            available: parseInt(slots[1]) - parseInt(slots[0]),
            total: parseInt(slots[1]),
            used: parseInt(slots[0]),
        };
    }
}

export { ModifierComponent };
