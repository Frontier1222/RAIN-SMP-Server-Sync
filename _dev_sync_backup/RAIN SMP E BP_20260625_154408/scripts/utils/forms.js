import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { InventoryConfig } from '../data/constants';
import { buildPotionDisplay } from '../data/potions';
import { dataTypes, itemTypes } from '../data/types';
import { getEnchantName, isRawMessage, toRoman } from '../data/utilities';
const config = new InventoryConfig();
/**
 * Helper for displaying a fake chest UI via ActionFormData.
 *
 * **Deprecated:** shops, auction house and inventory viewer now use plain
 * action menus with text-only button labels. This class remains for legacy
 * features that may still rely on grid layouts.
 */
class ChestFormData {
    #buttonArray;
    #titleText;
    slotCount;
    constructor(size = 27) {
        const sizing = config.chestSizes.get(size) ?? { title: '', size: 27 };
        this.slotCount = sizing.size;
        this.#buttonArray = Array(this.slotCount).fill([{ text: '' }, undefined]);
        this.#titleText = { rawtext: [{ text: sizing.title }] };
    }
    title(text) {
        if (typeof text === 'string') {
            this.#titleText.rawtext.push({ text });
        }
        else if ('rawtext' in text && Array.isArray(text.rawtext)) {
            this.#titleText.rawtext.push(...text.rawtext);
        }
        else {
            this.#titleText.rawtext.push(text);
        }
        return this;
    }
    button(slot, name, texture, options) {
        const amount = options?.amount || 1;
        const description = options?.description || [];
        const durability = options?.durability || 0;
        const enchanted = options?.enchanted || false;
        const rawText = { rawtext: [{ text: `stack#${String(Math.min(Math.max(amount, 1), 99)).padStart(2, '0')}dur#${String(Math.min(Math.max(durability, 0), 99)).padStart(2, '0')}§r` }] };
        const namePrefix = enchanted ? '§b' : '';
        if (typeof name === 'string') {
            rawText.rawtext.push({ text: `${namePrefix}${name}§r` });
        }
        else if (isRawMessage(name)) {
            rawText.rawtext.push({ text: namePrefix }, ...name.rawtext, { text: '§r' });
        }
        else {
            return this;
        }
        if (description?.length) {
            for (const obj of description) {
                if (typeof obj === 'string') {
                    rawText.rawtext.push({ text: `§r\n§5${obj}` });
                }
                else if (isRawMessage(obj)) {
                    rawText.rawtext.push(...obj.rawtext, { text: '§r' });
                }
            }
        }
        const targetTexture = texture && config.customContentKeys.has(texture) ? config.customContent[texture]?.texture : texture;
        const id = targetTexture ? dataTypes.get(targetTexture) ?? itemTypes.get(targetTexture) : undefined;
        const encoded = id === undefined ? targetTexture : (id + (id < 256 ? 0 : config.customItems)) * 65536 + (enchanted ? 32768 : 0);
        const index = Math.max(0, Math.min(slot, this.slotCount - 1));
        this.#buttonArray.splice(index, 1, [rawText, encoded]);
        return this;
    }
    pattern(pattern, key) {
    const width = 9;

    for (let row = 0; row < pattern.length; row++) {
        const line = pattern[row];

        for (let col = 0; col < line.length; col++) {
            const char = line[col];
            const data = key[char];
            if (!data) continue;

            const slot = col + row * width;
            if (slot >= this.slotCount) continue;

            this.button(
                slot,
                data.name,
                data.texture,
                {
                    amount: data.amount,
                    durability: data.durability,
                    enchanted: data.enchanted,
                    description: data.description,
                }
            );
        }
    }

    return this;
}
    async show(player) {
        const form = new ActionFormData();
        for (const [raw, id] of this.#buttonArray) {
            if (id === undefined) {
                form.button({ rawtext: [raw] });
            }
            else {
                form.button({ rawtext: [raw] }, String(id));
            }
        }
        form.title(this.#titleText);
        const baseCount = this.#buttonArray.length;
        const container = config.inventoryEnabled ? player.getComponent(EntityComponentTypes.Inventory)?.container : undefined;
        if (container) {
            for (let i = 0; i < container.size; i++) {
                const item = container.getItem(i);
                if (!item) {
                    form.button('');
                    continue;
                }
                const durabilityComponent = item.getComponent(ItemComponentTypes.Durability);
                let durability = 0;
                if (durabilityComponent) {
                    const { damage, maxDurability } = durabilityComponent;
                    if (damage > 0) {
                        durability = Math.max(1, Math.min(99, Math.round(((maxDurability - damage) / maxDurability) * 99)));
                    }
                } 
                const potionDisplay = buildPotionDisplay(item);
                const defaultItemName = item.nameTag ??
                    item.typeId
                        .replace(/.*(?<=:)/, "")
                        .replace(/_/g, " ")
                        .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())
                        .replace("And", "and");
                const itemName = potionDisplay ? potionDisplay.displayName : defaultItemName;
                const rawtext = {
                    rawtext: [
                        {
                            text: `stack#${String(item.amount).padStart(2, '0')}dur#${String(durability).padStart(2, '0')}§r${itemName}`,
                        },
                    ],
                };
                if (potionDisplay) {
                    for (const line of potionDisplay.effectLines) {
                        rawtext.rawtext.push({ text: `§r\n§7${line}` });
                    }
                    for (const chunk of potionDisplay.whenAppliedLines) {
                        rawtext.rawtext.push({ text: chunk });
                    }
                }
                
                const enchantableComponent = item.getComponent(ItemComponentTypes.Enchantable);
                let hasEnchants = false;
                if (enchantableComponent) {
                    const enchants = enchantableComponent.getEnchantments();
                    if (enchants.length > 0) {
                        hasEnchants = true;
                    }
                    if (hasEnchants && !item.nameTag && !potionDisplay) {
                        rawtext.rawtext[0].text = rawtext.rawtext[0].text.replace(itemName, `§b${itemName}§r`);
                    }
                    for (const enchant of enchants) {
                        const enchantName = getEnchantName(enchant.type.id);
                        const level = toRoman(enchant.level) || enchant.level.toString();
                        rawtext.rawtext.push({ text: `§r\n§7${enchantName} ${level}` });
                    }
                }
                const lore = item.getLore().join('\n');
                if (lore) {
                    rawtext.rawtext.push({ text: '§r\n§o§5' + lore });
                }
                const baseTexture = potionDisplay ? potionDisplay.textureKey : item.typeId;
                const targetTexture = baseTexture && config.customContentKeys.has(baseTexture) ? config.customContent[baseTexture].texture : baseTexture;
                const id = dataTypes.get(targetTexture) ?? itemTypes.get(targetTexture);
                const encoded = id === undefined ? targetTexture : (id + (id < 256 ? 0 : config.customItems)) * 65536 + (hasEnchants ? 32768 : 0);
                
                form.button(rawtext, String(encoded));
            }
        }
        const response = await form.show(player);
        const canceled = !!response.canceled;
        const selection = response.selection;
        if (canceled || selection === undefined) {
            return { canceled: true, selection, slotIndex: -1, type: 'container' };
        }
        if (selection < baseCount) {
            return { canceled: false, selection, slotIndex: selection, type: 'container' };
        }
        if (!container) {
            return { canceled: false, selection, slotIndex: selection, type: 'container' };
        }
        const inventoryIndex = selection - baseCount;
        if (inventoryIndex < 0 || inventoryIndex >= container.size) {
            return { canceled: false, selection, slotIndex: -1, type: 'inventory' };
        }
        return { canceled: false, selection, slotIndex: inventoryIndex, type: 'inventory' };
    }
}
export { ChestFormData };