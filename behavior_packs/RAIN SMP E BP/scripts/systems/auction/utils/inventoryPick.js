import { ItemStack, ItemComponentTypes } from "@minecraft/server";
import { ActionFormData } from '@minecraft/server-ui';
// inventory picker uses action form labels now rather than chest grid

export function formatListingLine(listing) {
  return `§f${itemName(listing.sell)}§r x${listing.sell.amount} §7for§r §e${itemName(listing.want)}§r x${listing.want.amount}`;
}

export function itemName(data) {
  if (data.nameTag) return data.nameTag;
  if (data.localizationKey) return data.localizationKey;
  return data.typeId.split(":")[1].replace(/_/g, " ");
}

export function buildItemStackFromItemData(data) {
  const stack = new ItemStack(data.typeId, data.amount);

  if (data.nameTag) stack.nameTag = data.nameTag;
  if (data.lore?.length) stack.setLore(data.lore);

  const ench = stack.getComponent(ItemComponentTypes.Enchantable);
  if (ench && Array.isArray(data.enchantments)) {
    for (const e of data.enchantments) {
      const type = EnchantmentTypes.get(e.id);
      if (type) ench.addEnchantment({ type, level: e.level });
    }
  }

  const dur = stack.getComponent(ItemComponentTypes.Durability);
  if (dur && data.durability) {
    dur.damage = data.durability.damage;
  }

  return stack;
}

export function buildItemDataFromItemStack(item, amountOverride) {
  return {
    typeId: item.typeId,
    amount: amountOverride ?? item.amount,
    nameTag: item.nameTag ?? "",
    lore: item.getLore?.() ?? [],
    localizationKey: item.localizationKey ?? "",
    enchantments: item.getComponent(ItemComponentTypes.Enchantable)
      ?.getEnchantments()
      ?.map(e => ({ id: e.type.id, level: e.level })) ?? [],
    durability: (() => {
      const d = item.getComponent(ItemComponentTypes.Durability);
      return d ? { maxDurability: d.maxDurability, damage: d.damage } : null;
    })()
  };
}

export async function pickInventorySlot(player, title) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return null;

  // ask which section to browse
  const sectionForm = new ActionFormData()
    .title(`bd.action:${title}`)
    .button("Container")
    .button("Hotbar")
    .button("§7Cancel");
  const secRes = await sectionForm.show(player);
  if (secRes.canceled) return null;
  if (secRes.selection === 2) return null;
  const hotbar = secRes.selection === 1;

  const start = hotbar ? 0 : 9;
  const end = hotbar ? Math.min(inv.size, 9) : Math.min(inv.size, 36);

  const formatLabel = (slot, item) => {
    const parts = [];
    parts.push({ text: `Slot ${slot}: ` });
    if (item.nameTag) {
      parts.push({ text: item.nameTag });
    } else if (item.localizationKey) {
      parts.push({ translate: item.localizationKey });
    } else {
      const name = item.typeId.split(":")[1]?.replace(/_/g, " ") || item.typeId;
      parts.push({ text: name });
    }
    if (item.amount) parts.push({ text: ` x${item.amount}` });
    return { rawtext: parts };
  };

  const entries = [];
  for (let i = start; i < end; i++) {
    const item = inv.getItem(i);
    if (!item) continue;
    if (item.typeId === 'bd:gui') continue;
    entries.push({ slot: i, label: formatLabel(i, item) });
  }
  entries.push({ slot: "CANCEL", label: { rawtext: [{ text: "§7Cancel" }] } });

  const form = new ActionFormData().title(`bd.action:${title}`);
  entries.forEach(e => form.button(e.label));

  const res = await form.show(player);
  if (res.canceled) return null;
  const choice = entries[res.selection];
  if (!choice || choice.slot === "CANCEL") return null;

  const realSlot = choice.slot;
  return {
    slot: realSlot,
    item: inv.getItem(realSlot),
  };
}