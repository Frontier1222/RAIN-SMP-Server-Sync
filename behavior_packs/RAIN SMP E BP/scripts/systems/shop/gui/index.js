import { system } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

// Store functions
import {
  listShops,
  addShopItem,
  addShop,
  removeShopItem,
  getShopByNpc,
  setShopNpc,
  updateShop,
  removeShop,
  getShopWants,
  EVENT_LOOT_BAG_ICONS
} from '../store.js';
import { resolveShopItemIcon } from '../itemIcons.js';
import { getEventShopDetails } from '../eventDetails.js';

// Auction utils
import { pickInventorySlot } from '../../auction/utils/inventoryPick.js';
import {
  buildItemDataFromItemStack,
  buildItemStackFromItemData,
  parseMcColorCodes
} from '../../auction/utils/itemDisplay.js';

import {
  countItemsByType,
  takeItemsByType,
  giveItemToPlayer
} from '../../auction/utils/inventory.js';

// Menu link
import { openShopForEntityPlayer as openRealNpcMenu } from '../menu.js';
import { toastError, toastSuccess } from '../../../utils/realmPerf.js';

// ==========================================
// LORE HELPERS
// ==========================================
function parseLoreInput(text) {
  if (!text || !String(text).trim()) return [];

  return String(text)
    .split("|")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(0, 20);
}

function loreToInput(lore) {
  if (!Array.isArray(lore)) return "";
  return lore.join("|");
}

// ==========================================
// ADMIN SHOP MANAGER EXPORT
// ==========================================
export async function openShopManager(player) {
  if (!player) return;

  while (true) {
    const shops = listShops();

    const listMenu = new ActionFormData()
      .title("bd.action:§5SHOP SELECTION")
      .body("\nSelect a shop configuration to manage:\n ");

    if (shops.length === 0) {
      listMenu.button("§d+ Create Your First Shop");
    } else {
      for (const s of shops) {
        listMenu.button(`§d${s.name}`);
      }

      listMenu.button("§d+ Create New Shop");

      // Auto generators
      listMenu.button("§cAuto-Generate Nether Shop");
      listMenu.button("§eAuto-Generate Banker Shop");
      listMenu.button("§bAuto-Generate Specialist Shop");
      listMenu.button("§aAuto-Generate Event Shop");
      listMenu.button("§5Auto-Generate End Shop");
      listMenu.button("§4Auto-Generate Redstone Shop");
      listMenu.button("§6Auto-Generate Butcher Shop");
      listMenu.button("§2Auto-Generate Wood Shop");
      listMenu.button("§7Auto-Generate Stone Shop");
    }

    const response = await listMenu.show(player);
    if (response.canceled) return;

    // Create a blank shop
    if (shops.length === 0 || response.selection === shops.length) {
      const modal = new ModalFormData()
        .title("bd.modal:§5Create Shop")
        .textField("Enter Shop Name", "New Shop");

      const r = await modal.show(player);
      if (r.canceled || !r.formValues[0]) continue;

      addShop({
        id: Date.now().toString(),
        name: String(r.formValues[0]),
        npc: null,
        items: [],
        useTabs: true
      });

      continue;
    }

    // Auto-Generators
    else if (response.selection === shops.length + 1) {
      generateNetherShop(player);
      continue;
    }
    else if (response.selection === shops.length + 2) {
      generateBankerShop(player);
      continue;
    }
    else if (response.selection === shops.length + 3) {
      generateSpecialistShop(player);
      continue;
    }
    else if (response.selection === shops.length + 4) {
      generateEventShop(player);
      continue;
    }
    else if (response.selection === shops.length + 5) {
      generateEndShop(player);
      continue;
    }
    else if (response.selection === shops.length + 6) {
      generateRedstoneShop(player);
      continue;
    }
    else if (response.selection === shops.length + 7) {
      generateButcherShop(player);
      continue;
    }
    else if (response.selection === shops.length + 8) {
      generateWoodShop(player);
      continue;
    }
    else if (response.selection === shops.length + 9) {
      generateStoneShop(player);
      continue;
    }

    const shop = shops[response.selection];

    while (true) {
      const editor = new ActionFormData()
        .title(`bd.action:§5${shop.name}`)
        .button("§dAdd Item")
        .button("§5Edit Items")
        .button("§bManage Tabs")
        .button("§eRename Shop")
        .button("§cDelete Shop")
        .button("§7Back to List");

      const e = await editor.show(player);
      if (e.canceled || e.selection === 5) break;

      // ==========================================
      // 0. ADD ITEM
      // ==========================================
      if (e.selection === 0) {
        const pick = await pickInventorySlot(player, "Select item to SELL");
        if (!pick) continue;

        const sellItem = pick.item;

        const realAmount = sellItem.amount ?? 1;
        const max = Math.max(2, Math.min(64, realAmount));

        const existingLore = loreToInput(sellItem.getLore?.() ?? []);

        const detailsForm = new ModalFormData()
          .title("bd.modal:§5Item Details")
          .slider("How many to sell?", 1, max, { valueStep: 1, defaultValue: 1 })
          .textField("Custom Display Name", "e.g. Rain Rare Coin")
          .textField("Lore Lines", "Line 1|Line 2|Line 3", { defaultValue: existingLore })
          .textField("Category Tab Name", "e.g. Coins", { defaultValue: "Misc Items" })
          .textField("Icon Filepath (No .png)", "e.g. textures/items/apple");

        const detailsRes = await detailsForm.show(player);
        if (detailsRes.canceled) continue;

        const sellAmt = Math.floor(detailsRes.formValues[0]);
        const customName = detailsRes.formValues[1]?.trim() || "";
        const loreLines = parseLoreInput(detailsRes.formValues[2]);
        const categoryName = detailsRes.formValues[3]?.trim() || "Misc Items";
        const iconPath = detailsRes.formValues[4]?.trim() || "";

        const payPick = await pickInventorySlot(player, "Select payment item");

        let wants = [];

        if (payPick) {
          const payAmtRes = await new ModalFormData()
            .title("bd.modal:§5Set Price")
            .slider("Cost for buyer", 1, 64, { valueStep: 1, defaultValue: 1 })
            .show(player);

          if (!payAmtRes.canceled) {
            wants.push(buildItemDataFromItemStack(
              payPick.item,
              Math.floor(Number(payAmtRes.formValues[0]))
            ));
          }

          if (wants.length) {
            const secondMenu = new ActionFormData()
              .title("bd.action:§5Second Payment?")
              .body("§7Add a second item cost for this trade?")
              .button("§aYes — pick 2nd item")
              .button("§7No — finish");

            const secondRes = await secondMenu.show(player);
            if (!secondRes.canceled && secondRes.selection === 0) {
              const payPick2 = await pickInventorySlot(player, "Select 2nd payment item");
              if (payPick2) {
                const payAmtRes2 = await new ModalFormData()
                  .title("bd.modal:§5Second Price")
                  .slider("Cost for buyer", 1, 64, { valueStep: 1, defaultValue: 1 })
                  .show(player);

                if (!payAmtRes2.canceled) {
                  wants.push(buildItemDataFromItemStack(
                    payPick2.item,
                    Math.floor(Number(payAmtRes2.formValues[0]))
                  ));
                }
              }
            }
          }
        }

        const sellData = buildItemDataFromItemStack(sellItem, sellAmt);

        if (customName !== "") {
          sellData.nameTag = parseMcColorCodes(customName);
        }

        sellData.lore = loreLines;

        addShopItem(shop.id, {
          sell: sellData,
          want: wants[0] || null,
          wants: wants.length > 1 ? wants : undefined,
          category: categoryName,
          icon: iconPath,
          customName
        });

        toastSuccess(player, `Item added to ${categoryName}!`, "custom_msg");
      }

      // ==========================================
      // 1. EDIT ITEMS
      // ==========================================
      else if (e.selection === 1) {
        while (true) {
          const currentShop = listShops().find(s => s.id === shop.id);

          if (!currentShop || !currentShop.items || currentShop.items.length === 0) {
            toastError(player, "§cThis shop is empty!", "custom_msg");
            break;
          }

          const editMenu = new ActionFormData()
            .title(`bd.action:§5Editing: §d${currentShop.name}`)
            .body("Select an item to manage it:");

          for (const itemEntry of currentShop.items) {
            const displayName =
              itemEntry.customName ||
              itemEntry.sell?.nameTag ||
              itemEntry.sell.typeId.replace('minecraft:', '').replace(/_/g, ' ').toUpperCase();

            const priceText = getShopWants(itemEntry).length
              ? `Price: ${getShopWants(itemEntry).map(w => `${w.amount}x ${w.typeId}`).join(' + ')}`
              : 'Free';
            const loreCount = Array.isArray(itemEntry.sell?.lore) ? itemEntry.sell.lore.length : 0;

            editMenu.button(`§d${displayName} §7(x${itemEntry.sell.amount}) §8- ${priceText}\n§5Lore Lines: §d${loreCount}`);
          }

          editMenu.button("§cBack to Menu");

          const editRes = await editMenu.show(player);
          if (editRes.canceled || editRes.selection === currentShop.items.length) break;

          const selectedIndex = editRes.selection;
          const itemToManage = currentShop.items[selectedIndex];

          const actionMenu = new ActionFormData()
            .title("bd.action:§5Manage Item")
            .button("§eEdit Details")
            .button("§cRemove Item")
            .button("§7Cancel");

          const actionRes = await actionMenu.show(player);
          if (actionRes.canceled || actionRes.selection === 2) continue;

          if (actionRes.selection === 0) {
            const safeName = String(itemToManage.customName || itemToManage.sell?.nameTag || '');
            const safeLore = loreToInput(itemToManage.sell?.lore || []);
            const safeSellId = String(itemToManage.sell?.typeId || 'minecraft:dirt');
            const safeSellAmt = Math.max(1, Math.min(64, Number(itemToManage.sell?.amount) || 1));
            const safeWantId = String(itemToManage.want?.typeId || '');
            const safeWantAmt = Math.max(1, Math.min(64, Number(itemToManage.want?.amount) || 1));
            const safeWant2Id = String(itemToManage.wants?.[1]?.typeId || '');
            const safeWant2Amt = Math.max(1, Math.min(64, Number(itemToManage.wants?.[1]?.amount) || 1));
            const safeCategory = String(itemToManage.category || 'Misc Items');
            const safeIcon = String(itemToManage.icon || '');

            const editForm = new ModalFormData()
              .title('bd.modal:§5Edit Item Details')
              .textField('Custom Display Name', 'e.g. Rain Rare Coin', { defaultValue: safeName })
              .textField('Lore Lines', 'Line 1|Line 2|Line 3', { defaultValue: safeLore })
              .textField('Item Identifier to Give', 'minecraft:diamond_sword', { defaultValue: safeSellId })
              .slider('Amount to Give', 1, 64, { valueStep: 1, defaultValue: safeSellAmt })
              .textField('Payment Item 1 (blank = free)', 'viberater:frontier_coin', { defaultValue: safeWantId })
              .slider('Payment 1 Amount', 1, 64, { valueStep: 1, defaultValue: safeWantAmt })
              .textField('Payment Item 2 (optional)', 'minecraft:emerald', { defaultValue: safeWant2Id })
              .slider('Payment 2 Amount', 1, 64, { valueStep: 1, defaultValue: safeWant2Amt })
              .textField('Category Tab Name', 'e.g. Coins', { defaultValue: safeCategory })
              .textField('Icon Filepath (No .png)', 'e.g. textures/items/apple', { defaultValue: safeIcon });

            const saveRes = await editForm.show(player);
            if (saveRes.canceled) continue;

            itemToManage.customName = parseMcColorCodes(saveRes.formValues[0].trim());

            if (itemToManage.customName !== '') {
              itemToManage.sell.nameTag = itemToManage.customName;
            } else {
              delete itemToManage.sell.nameTag;
            }

            itemToManage.sell.lore = parseLoreInput(saveRes.formValues[1]);

            itemToManage.sell.typeId = saveRes.formValues[2].trim();
            itemToManage.sell.amount = Math.floor(saveRes.formValues[3]);

            const costItemId = saveRes.formValues[4].trim();
            const costItemId2 = saveRes.formValues[6].trim();
            const wants = [];

            if (costItemId !== '') {
              wants.push({
                typeId: costItemId,
                amount: Math.floor(saveRes.formValues[5]),
              });
            }

            if (costItemId2 !== '') {
              wants.push({
                typeId: costItemId2,
                amount: Math.floor(saveRes.formValues[7]),
              });
            }

            itemToManage.want = wants[0] || null;
            itemToManage.wants = wants.length > 1 ? wants : undefined;

            itemToManage.category = saveRes.formValues[8].trim() || 'Misc Items';
            itemToManage.icon = saveRes.formValues[9].trim();

            removeShopItem(shop.id, itemToManage.id);
            addShopItem(shop.id, itemToManage);

            toastSuccess(player, "Trade Updated Successfully!", "custom_msg");
          } else if (actionRes.selection === 1) {
            removeShopItem(shop.id, itemToManage.id);
            toastSuccess(player, "Removed!", "custom_msg");
          }
        }
      }

      // ==========================================
      // 2. MANAGE TABS
      // ==========================================
      else if (e.selection === 2) {
        while (true) {
          const currentShop = listShops().find(s => s.id === shop.id);
          const uniqueTabs = [...new Set((currentShop.items || []).map(i => i.category || 'Misc Items'))];

          const tabMenu = new ActionFormData()
            .title("bd.action:§5Manage Tabs")
            .body(`Tabs Enabled: §e${currentShop.useTabs !== false ? "YES" : "NO"}§r\n\nSelect a tab to manage:`);

          tabMenu.button(currentShop.useTabs !== false ? "§cDisable Tabs (Show All)" : "§aEnable Tabs");

          for (const tab of uniqueTabs) {
            tabMenu.button(`${tab}`);
          }

          tabMenu.button("§7Back");

          const tRes = await tabMenu.show(player);
          if (tRes.canceled || tRes.selection === uniqueTabs.length + 1) break;

          if (tRes.selection === 0) {
            currentShop.useTabs = currentShop.useTabs === false;
            updateShop(currentShop);
            toastSuccess(player, `Tabs are now ${currentShop.useTabs ? "ENABLED" : "DISABLED"} for buyers.`, "custom_msg");
            continue;
          }

          const selectedTab = uniqueTabs[tRes.selection - 1];

          const manageTabMenu = new ActionFormData()
            .title(`bd.action:§5Tab: ${selectedTab}`)
            .button("§eRename Tab")
            .button("§bMove Items to...")
            .button("§cDelete Tab & All Items")
            .button("§7Cancel");

          const mtRes = await manageTabMenu.show(player);
          if (mtRes.canceled || mtRes.selection === 3) continue;

          if (mtRes.selection === 0) {
            const renameForm = new ModalFormData()
              .title("bd.modal:§5Rename Tab")
              .textField("New Tab Name:", "e.g. Rare Items", { defaultValue: selectedTab });

            const rnRes = await renameForm.show(player);
            if (rnRes.canceled || !rnRes.formValues[0].trim()) continue;

            const newName = rnRes.formValues[0].trim();

            currentShop.items.forEach(i => {
              if ((i.category || 'Misc Items') === selectedTab) {
                i.category = newName;
              }
            });

            updateShop(currentShop);
            toastSuccess(player, `Tab renamed to ${newName}!`, "custom_msg");
          } else if (mtRes.selection === 1) {
            const otherTabs = uniqueTabs.filter(t => t !== selectedTab);

            if (otherTabs.length === 0) {
              toastError(player, "§cNo other tabs exist to move items to!", "custom_msg");
              continue;
            }

            const moveForm = new ModalFormData()
              .title("bd.modal:§5Move Items")
              .dropdown("Move all items to:", otherTabs);

            const mvRes = await moveForm.show(player);
            if (mvRes.canceled) continue;

            const targetTab = otherTabs[mvRes.formValues[0]];

            currentShop.items.forEach(i => {
              if ((i.category || 'Misc Items') === selectedTab) {
                i.category = targetTab;
              }
            });

            updateShop(currentShop);
            toastSuccess(player, `Moved all items to ${targetTab}!`, "custom_msg");
          } else if (mtRes.selection === 2) {
            const delConfirm = new ActionFormData()
              .title("bd.action:§cDelete Tab")
              .body(`Are you sure you want to delete "§e${selectedTab}§r" and ALL items inside it?`)
              .button("§cYES, Delete Everything")
              .button("§aNO, Cancel");

            const dcRes = await delConfirm.show(player);
            if (dcRes.canceled || dcRes.selection === 1) continue;

            currentShop.items = currentShop.items.filter(i => (i.category || 'Misc Items') !== selectedTab);
            updateShop(currentShop);

            toastError(player, `§cTab "${selectedTab}" deleted.`, "custom_msg");
          }
        }
      }

      // ==========================================
      // 3. RENAME SHOP
      // ==========================================
      else if (e.selection === 3) {
        const renameForm = new ModalFormData()
          .title('bd.modal:§5Rename Shop')
          .textField('New Shop Name:', 'e.g. Weapon Shop', { defaultValue: shop.name });

        const rRes = await renameForm.show(player);
        if (rRes.canceled) continue;

        const newName = rRes.formValues[0]?.trim();

        if (newName && newName !== '') {
          updateShop({ id: shop.id, name: newName });
          shop.name = newName;
          toastSuccess(player, `Shop successfully renamed to ${newName}!`, "custom_msg");
        }
      }

      // ==========================================
      // 4. DELETE SHOP
      // ==========================================
      else if (e.selection === 4) {
        const confirmForm = new ActionFormData()
          .title('bd.action:§cDelete Shop')
          .body(`Are you absolutely sure you want to delete the shop "§d${shop.name}§r"?\n\n§cWARNING: This will delete ALL items inside it. This cannot be undone!`)
          .button('§cYES, Delete Shop')
          .button('§aNO, Cancel');
        
        const delRes = await confirmForm.show(player);
        if (delRes.canceled || delRes.selection === 1) continue;

        removeShop(shop.id);
        toastError(player, `§cShop "${shop.name}" deleted.`, "custom_msg");
        player.playSound("random.levelup");
        break; 
      }
    }
  }
}

// ==========================================
// SHOP GENERATOR HELPERS
// ==========================================
const COINS = {
  common: "viberater:rain_common_coin",
  uncommon: "viberater:rain_uncommon_coin",
  rare: "viberater:rain_rare_coin",
  rain: "viberater:rain_coin",
  event: "viberater:rain_event_coin"
};

const COIN_NAMES = {
  [COINS.common]: "Rain SMP Common Coin",
  [COINS.uncommon]: "Rain SMP Uncommon Coin",
  [COINS.rare]: "Rain SMP Rare Coin",
  [COINS.rain]: "Rain SMP Coin",
  [COINS.event]: "Event Coin"
};

function buildGeneratedShopTrade(t) {
  const menuLabel = parseMcColorCodes(t.name || "");
  const itemName = parseMcColorCodes(t.sellNameTag || COIN_NAMES[t.id] || "");

  const sell = {
    typeId: t.id,
    amount: t.amt,
  };

  if (itemName) {
    sell.nameTag = itemName;
  }

  const eventDetails = getEventShopDetails(t.name);
  const lore = eventDetails.length ? eventDetails : t.lore;
  if (Array.isArray(lore) && lore.length > 0) {
    sell.lore = lore.map((line) => parseMcColorCodes(String(line)));
  }

  if (Array.isArray(t.enchantments) && t.enchantments.length > 0) {
    sell.enchantments = t.enchantments.map(e => ({ id: e.id, level: e.level }));
  }

  if (t.book) {
    sell.book = { ...t.book };
  }

  const wants = Array.isArray(t.wants)
    ? t.wants.map(w => ({
        typeId: w.typeId,
        amount: w.amount,
        nameTag: COIN_NAMES[w.typeId] || w.nameTag || "",
        icon: resolveShopItemIcon(w.typeId, w.icon || "")
      }))
    : [];

  if (!wants.length && t.wantId) {
    wants.push({
      typeId: t.wantId,
      amount: t.cost,
      nameTag: COIN_NAMES[t.wantId] || t.wantNameTag || "",
      icon: resolveShopItemIcon(t.wantId, t.wantIcon || "")
    });
  }

  return {
    id: `${Date.now()}_${Math.floor(Math.random() * 999999)}`,
    sell,
    want: wants[0] || null,
    wants,
    sellOptions: Array.isArray(t.sellOptions)
      ? t.sellOptions.map(option => ({ ...option }))
      : undefined,
    category: t.tab || "Items",
    icon: t.icon || "",
    customName: menuLabel || itemName
  };
}

function createGeneratedShop(player, shopName, suffix, trades, successMessage) {
  return upsertGeneratedShop(player, shopName, suffix, trades, successMessage);
}

function upsertGeneratedShop(player, shopName, suffix, trades, successMessage) {
  try {
    const items = trades.map(t => buildGeneratedShopTrade(t));
    const existing = listShops().find(s => s.name === shopName);

    if (existing) {
      updateShop({
        id: existing.id,
        name: shopName,
        npc: existing.npc ?? null,
        items,
        useTabs: true
      });

      toastSuccess(
        player,
        `§a${shopName} updated with ${items.length} items. Its linked NPC was preserved.`,
        "custom_msg"
      );
    } else {
      addShop({
        id: Date.now().toString() + suffix,
        name: shopName,
        npc: null,
        items,
        useTabs: true
      });

      toastSuccess(player, successMessage || `${shopName} successfully generated with ${items.length} items!`, "custom_msg");
    }

    player.playSound("random.levelup");
  } catch (e) {
    toastError(player, `§cFailed to update ${shopName}: ${e}`, "custom_msg");
    player.playSound("note.bass");
  }
}

function eventLootIcon(itemId, fallback = "") {
  return EVENT_LOOT_BAG_ICONS[itemId] || fallback;
}

// ==========================================
// HARDCODED BANKER SHOP GENERATOR
// ==========================================
export function generateBankerShop(player) {
  const trades = [
    // Buy Coins
    {
      id: COINS.common,
      amt: 1,
      cost: 20,
      wantId: "minecraft:raw_iron",
      name: "Buy Common Coin",
      icon: "textures/items/rain_common_coin",
      tab: "Buy Coins"
    },
    {
      id: COINS.uncommon,
      amt: 1,
      cost: 48,
      wantId: "minecraft:raw_gold",
      name: "Buy Uncommon Coin",
      icon: "textures/items/rain_uncommon_coin",
      tab: "Buy Coins"
    },
    {
      id: COINS.uncommon,
      amt: 1,
      cost: 48,
      wantId: "minecraft:emerald",
      name: "Buy Uncommon Coin",
      icon: "textures/items/rain_uncommon_coin",
      tab: "Buy Coins"
    },
    {
      id: COINS.rare,
      amt: 1,
      cost: 4,
      wantId: "minecraft:diamond_block",
      name: "Buy Rare Coin",
      icon: "textures/items/rain_rare_coin",
      tab: "Buy Coins"
    },
    {
      id: COINS.rain,
      amt: 1,
      cost: 3,
      wantId: "minecraft:netherite_ingot",
      name: "Buy Rain SMP Coin",
      icon: "textures/items/rain_coin",
      tab: "Buy Coins"
    },

    // Sell Coins
    {
      id: "minecraft:raw_iron",
      amt: 8,
      cost: 1,
      wantId: COINS.common,
      name: "Sell Common Coin For Raw Iron",
      icon: "textures/items/raw_iron",
      tab: "Sell Coins"
    },
    {
      id: "minecraft:raw_gold",
      amt: 20,
      cost: 1,
      wantId: COINS.uncommon,
      name: "Sell Uncommon Coin For Raw Gold",
      icon: "textures/items/raw_gold",
      tab: "Sell Coins"
    },
    {
      id: "minecraft:emerald",
      amt: 20,
      cost: 1,
      wantId: COINS.uncommon,
      name: "Sell Uncommon Coin For Emeralds",
      icon: "textures/items/emerald",
      tab: "Sell Coins"
    },
    {
      id: "minecraft:diamond_block",
      amt: 2,
      cost: 1,
      wantId: COINS.rare,
      name: "Sell Rare Coin For Diamond Blocks",
      icon: "textures/items/diamond_block",
      tab: "Sell Coins"
    },
    {
      id: "minecraft:netherite_ingot",
      amt: 1,
      cost: 1,
      wantId: COINS.rain,
      name: "Sell Rain SMP Coin For Netherite Ingots",
      icon: "textures/items/netherite_ingot",
      tab: "Sell Coins"
    }
  ];

  createGeneratedShop(player, "Banker", "_bank", trades, "§aBanker Shop successfully generated!");
}

// ==========================================
// HARDCODED REDSTONE SHOP GENERATOR
// ==========================================
export function generateRedstoneShop(player) {
  const trades = [
    // Basic Redstone
    { id: "minecraft:redstone", amt: 32, cost: 1, wantId: COINS.common, name: "Redstone Dust", icon: "textures/items/redstone_dust", tab: "Basic Redstone" },
    { id: "minecraft:quartz", amt: 16, cost: 1, wantId: COINS.common, name: "Nether Quartz", icon: "textures/items/quartz", tab: "Basic Redstone" },
    { id: "minecraft:redstone_torch", amt: 12, cost: 1, wantId: COINS.common, name: "Redstone Torches", icon: "textures/blocks/redstone_torch_on", tab: "Basic Redstone" },
    { id: "minecraft:redstone_lamp", amt: 1, cost: 1, wantId: COINS.common, name: "Redstone Lamp", icon: "textures/blocks/redstone_lamp_off", tab: "Basic Redstone" },

    // Components
    { id: "minecraft:repeater", amt: 5, cost: 1, wantId: COINS.common, name: "Repeaters", icon: "textures/items/repeater", tab: "Redstone Components" },
    { id: "minecraft:comparator", amt: 3, cost: 1, wantId: COINS.common, name: "Comparators", icon: "textures/items/comparator", tab: "Redstone Components" },
    { id: "minecraft:piston", amt: 5, cost: 1, wantId: COINS.common, name: "Pistons", icon: "textures/blocks/piston_top_normal", tab: "Redstone Components" },
    { id: "minecraft:sticky_piston", amt: 4, cost: 1, wantId: COINS.common, name: "Sticky Pistons", icon: "textures/blocks/piston_top_sticky", tab: "Redstone Components" },
    { id: "minecraft:dropper", amt: 4, cost: 1, wantId: COINS.common, name: "Droppers", icon: "textures/blocks/dropper_front_horizontal", tab: "Redstone Components" },
    { id: "minecraft:dispenser", amt: 4, cost: 1, wantId: COINS.common, name: "Dispensers", icon: "textures/blocks/dispenser_front_horizontal", tab: "Redstone Components" },
    { id: "minecraft:observer", amt: 2, cost: 1, wantId: COINS.common, name: "Observers", icon: "textures/blocks/observer_front", tab: "Redstone Components" },
    { id: "minecraft:hopper", amt: 3, cost: 1, wantId: COINS.common, name: "Hoppers", icon: "textures/items/hopper", tab: "Redstone Components" },

    // Rails
    { id: "minecraft:minecart", amt: 3, cost: 1, wantId: COINS.common, name: "Minecarts", icon: "textures/items/minecart_normal", tab: "Rails & Transportation" },
    { id: "minecraft:rail", amt: 16, cost: 1, wantId: COINS.common, name: "Rails", icon: "textures/blocks/rail_normal", tab: "Rails & Transportation" },
    { id: "minecraft:activator_rail", amt: 5, cost: 1, wantId: COINS.common, name: "Activator Rails", icon: "textures/blocks/rail_activator", tab: "Rails & Transportation" },
    { id: "minecraft:detector_rail", amt: 5, cost: 1, wantId: COINS.common, name: "Detector Rails", icon: "textures/blocks/rail_detector", tab: "Rails & Transportation" },
    { id: "minecraft:golden_rail", amt: 5, cost: 2, wantId: COINS.common, name: "Powered Rails", icon: "textures/blocks/rail_golden", tab: "Rails & Transportation" },

    // Miscellaneous
    { id: "minecraft:tripwire_hook", amt: 5, cost: 1, wantId: COINS.common, name: "Tripwire Hooks", icon: "textures/items/trip_wire_source", tab: "Miscellaneous" },
    { id: "minecraft:string", amt: 10, cost: 1, wantId: COINS.common, name: "String", icon: "textures/items/string", tab: "Miscellaneous" },
    { id: "minecraft:iron_door", amt: 3, cost: 1, wantId: COINS.common, name: "Iron Doors", icon: "textures/items/door_iron", tab: "Miscellaneous" },
    { id: "minecraft:wooden_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Oak Pressure Plates", icon: "textures/blocks/planks_oak", tab: "Pressure Plates" },
    { id: "minecraft:spruce_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Spruce Pressure Plates", icon: "textures/blocks/planks_spruce", tab: "Pressure Plates" },
    { id: "minecraft:birch_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Birch Pressure Plates", icon: "textures/blocks/planks_birch", tab: "Pressure Plates" },
    { id: "minecraft:jungle_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Jungle Pressure Plates", icon: "textures/blocks/planks_jungle", tab: "Pressure Plates" },
    { id: "minecraft:acacia_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Acacia Pressure Plates", icon: "textures/blocks/planks_acacia", tab: "Pressure Plates" },
    { id: "minecraft:dark_oak_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Dark Oak Pressure Plates", icon: "textures/blocks/planks_big_oak", tab: "Pressure Plates" },
    { id: "minecraft:mangrove_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Mangrove Pressure Plates", icon: "textures/blocks/mangrove_planks", tab: "Pressure Plates" },
    { id: "minecraft:cherry_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Cherry Pressure Plates", icon: "textures/blocks/cherry_planks", tab: "Pressure Plates" },
    { id: "minecraft:pale_oak_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Pale Oak Pressure Plates", icon: "textures/blocks/pale_oak_planks", tab: "Pressure Plates" },
    { id: "minecraft:bamboo_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Bamboo Pressure Plates", icon: "textures/blocks/bamboo_planks", tab: "Pressure Plates" },
    { id: "minecraft:crimson_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Crimson Pressure Plates", icon: "textures/blocks/huge_fungus/crimson_planks", tab: "Pressure Plates" },
    { id: "minecraft:warped_pressure_plate", amt: 10, cost: 1, wantId: COINS.common, name: "Warped Pressure Plates", icon: "textures/blocks/huge_fungus/warped_planks", tab: "Pressure Plates" },
    { id: "minecraft:tnt", amt: 4, cost: 1, wantId: COINS.uncommon, name: "TNT", icon: "textures/blocks/tnt_side", tab: "Miscellaneous" },
  ];

  createGeneratedShop(player, "Redstone Shop", "_redstone", trades, "§aRedstone Shop successfully generated!");
}

// ==========================================
// HARDCODED END SHOP GENERATOR
// ==========================================
export function generateEndShop(player) {
  const trades = [
    // Blocks
    { id: "minecraft:end_stone", amt: 64, cost: 1, wantId: COINS.common, name: "End Stone", icon: "textures/blocks/end_stone", tab: "Blocks" },
    { id: "minecraft:glass", amt: 48, cost: 1, wantId: COINS.common, name: "Glass", icon: "textures/blocks/glass", tab: "Blocks" },
    { id: "minecraft:chorus_fruit", amt: 16, cost: 1, wantId: COINS.common, name: "Chorus Fruit", icon: "textures/items/chorus_fruit", tab: "Blocks" },

    // Utilities
    { id: "minecraft:purpur_block", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Purpur Blocks", icon: "textures/blocks/purpur_block", tab: "Utilities" },
    { id: "minecraft:ender_chest", amt: 2, cost: 1, wantId: COINS.uncommon, name: "Ender Chests", icon: "textures/blocks/ender_chest_front", tab: "Utilities" },
    { id: "minecraft:end_rod", amt: 16, cost: 1, wantId: COINS.uncommon, name: "End Rods", icon: "textures/blocks/end_rod", tab: "Utilities" },
    { id: "minecraft:ender_pearl", amt: 16, cost: 1, wantId: COINS.uncommon, name: "Ender Pearls", icon: "textures/items/ender_pearl", tab: "Utilities" },
    { id: "minecraft:magenta_dye", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Magenta Dye", icon: "textures/items/dye_powder_magenta", tab: "Utilities" },
    { id: "minecraft:purple_dye", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Purple Dye", icon: "textures/items/dye_powder_purple", tab: "Utilities" },
    { id: "minecraft:end_crystal", amt: 2, cost: 1, wantId: COINS.uncommon, name: "End Crystals", icon: "textures/items/end_crystal", tab: "Utilities" },

    // Rare Items
    { id: "minecraft:shulker_shell", amt: 2, cost: 1, wantId: COINS.rare, name: "Shulker Shells", icon: "textures/items/shulker_shell", tab: "Rare Items" },
    { id: "minecraft:dragon_breath", amt: 32, cost: 3, wantId: COINS.rare, name: "Dragon's Breath", icon: "textures/items/dragons_breath", tab: "Rare Items" },
    { id: "minecraft:dragon_head", amt: 1, cost: 5, wantId: COINS.rare, name: "Dragon Head", icon: "textures/items/dragon_head", tab: "Rare Items" },
    { id: "minecraft:elytra", amt: 1, cost: 20, wantId: COINS.rare, name: "Elytra", icon: "textures/items/elytra", tab: "Rare Items" },

    // Special Items
    { id: "minecraft:dragon_egg", amt: 1, cost: 100, wantId: COINS.rain, name: "Dragon Egg", icon: "textures/blocks/dragon_egg", tab: "Special Items", lore: ["§7Unique luxury item", "§8Price: 100 Rain SMP Coins"] }
  ];

  createGeneratedShop(player, "End Shop", "_end", trades, "§aEnd Shop successfully generated!");
}

// ==========================================
// HARDCODED BUTCHER SHOP GENERATOR
// ==========================================
export function generateButcherShop(player) {
  const trades = [
    { id: "minecraft:cooked_beef", amt: 16, cost: 1, wantId: COINS.common, name: "Cooked Steak", icon: "textures/items/beef_cooked", tab: "High Saturation Foods" },
    { id: "minecraft:cooked_porkchop", amt: 16, cost: 1, wantId: COINS.common, name: "Cooked Porkchops", icon: "textures/items/porkchop_cooked", tab: "High Saturation Foods" },

    { id: "minecraft:cooked_mutton", amt: 24, cost: 1, wantId: COINS.common, name: "Cooked Mutton", icon: "textures/items/mutton_cooked", tab: "Medium Saturation Foods" },
    { id: "minecraft:cooked_chicken", amt: 24, cost: 1, wantId: COINS.common, name: "Cooked Chicken", icon: "textures/items/chicken_cooked", tab: "Medium Saturation Foods" },
    { id: "minecraft:cooked_salmon", amt: 24, cost: 1, wantId: COINS.common, name: "Cooked Salmon", icon: "textures/items/fish_salmon_cooked", tab: "Medium Saturation Foods" },

    { id: "minecraft:cooked_cod", amt: 32, cost: 1, wantId: COINS.common, name: "Cooked Cod", icon: "textures/items/fish_cod_cooked", tab: "Lower Saturation Foods" },
    { id: "minecraft:cooked_rabbit", amt: 32, cost: 1, wantId: COINS.common, name: "Cooked Rabbit", icon: "textures/items/rabbit_cooked", tab: "Lower Saturation Foods" },

    { id: "minecraft:leather", amt: 8, cost: 1, wantId: COINS.common, name: "Leather", icon: "textures/items/leather", tab: "Materials & Drops" },
    { id: "minecraft:feather", amt: 8, cost: 1, wantId: COINS.common, name: "Feathers", icon: "textures/items/feather", tab: "Materials & Drops" },
    { id: "minecraft:rabbit_hide", amt: 5, cost: 1, wantId: COINS.common, name: "Rabbit Hide", icon: "textures/items/rabbit_hide", tab: "Materials & Drops" },
    { id: "minecraft:rabbit_foot", amt: 3, cost: 1, wantId: COINS.common, name: "Rabbit Foot", icon: "textures/items/rabbit_foot", tab: "Materials & Drops" }
  ];

  createGeneratedShop(player, "Butcher Shop", "_butcher", trades, "§aButcher Shop successfully generated!");
}

// ==========================================
// HARDCODED NETHER SHOP GENERATOR
// ==========================================
export function generateNetherShop(player) {
  const trades = [
    // Basic Nether Blocks
    { id: "minecraft:netherrack", amt: 64, cost: 1, wantId: COINS.common, name: "Netherrack", icon: "textures/blocks/netherrack", tab: "Basic Nether Blocks" },
    { id: "minecraft:basalt", amt: 48, cost: 1, wantId: COINS.common, name: "Basalt", icon: "textures/blocks/basalt_side", tab: "Basic Nether Blocks" },
    { id: "minecraft:blackstone", amt: 48, cost: 1, wantId: COINS.common, name: "Blackstone", icon: "textures/blocks/blackstone", tab: "Basic Nether Blocks" },
    { id: "minecraft:soul_sand", amt: 48, cost: 1, wantId: COINS.common, name: "Soul Sand", icon: "textures/blocks/soul_sand", tab: "Basic Nether Blocks" },
    { id: "minecraft:soul_soil", amt: 48, cost: 1, wantId: COINS.common, name: "Soul Soil", icon: "textures/blocks/soul_soil", tab: "Basic Nether Blocks" },
    { id: "minecraft:nether_brick", amt: 32, cost: 1, wantId: COINS.common, name: "Nether Bricks", icon: "textures/blocks/nether_brick", tab: "Basic Nether Blocks" },
    { id: "minecraft:red_nether_brick", amt: 16, cost: 1, wantId: COINS.common, name: "Red Nether Bricks", icon: "textures/blocks/red_nether_brick", tab: "Basic Nether Blocks" },
    { id: "minecraft:quartz_block", amt: 16, cost: 1, wantId: COINS.common, name: "Nether Quartz Blocks", icon: "textures/blocks/quartz_block_side", tab: "Basic Nether Blocks" },

    // Nether Wood & Vegetation
    { id: "minecraft:crimson_hyphae", amt: 32, cost: 1, wantId: COINS.common, name: "Crimson Hyphae", icon: "textures/blocks/huge_fungus/crimson_stem_side", tab: "Nether Wood & Vegetation" },
    { id: "minecraft:warped_hyphae", amt: 32, cost: 1, wantId: COINS.common, name: "Warped Hyphae", icon: "textures/blocks/huge_fungus/warped_stem_side", tab: "Nether Wood & Vegetation" },
    { id: "minecraft:crimson_fungus", amt: 16, cost: 1, wantId: COINS.common, name: "Crimson Fungus", icon: "textures/blocks/crimson_fungus", tab: "Nether Wood & Vegetation" },
    { id: "minecraft:crimson_roots", amt: 16, cost: 1, wantId: COINS.common, name: "Crimson Roots", icon: "textures/blocks/crimson_roots", tab: "Nether Wood & Vegetation" },
    { id: "minecraft:warped_fungus", amt: 16, cost: 1, wantId: COINS.common, name: "Warped Fungus", icon: "textures/blocks/warped_fungus", tab: "Nether Wood & Vegetation" },
    { id: "minecraft:warped_roots", amt: 16, cost: 1, wantId: COINS.common, name: "Warped Roots", icon: "textures/blocks/warped_roots", tab: "Nether Wood & Vegetation" },

    // Lighting & Miscellaneous
    { id: "minecraft:shroomlight", amt: 4, cost: 1, wantId: COINS.common, name: "Shroomlights", icon: "textures/blocks/shroomlight", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:nether_wart", amt: 2, cost: 1, wantId: COINS.uncommon, name: "Nether Wart", icon: "textures/items/nether_wart", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:glowstone", amt: 2, cost: 1, wantId: COINS.uncommon, name: "Glowstone Blocks", icon: "textures/blocks/glowstone", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:blaze_rod", amt: 2, cost: 1, wantId: COINS.uncommon, name: "Blaze Rods", icon: "textures/items/blaze_rod", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:magma_cream", amt: 2, cost: 1, wantId: COINS.uncommon, name: "Magma Cream", icon: "textures/items/magma_cream", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:ghast_tear", amt: 2, cost: 1, wantId: COINS.uncommon, name: "Ghast Tears", icon: "textures/items/ghast_tear", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:music_disc_pigstep", amt: 1, cost: 3, wantId: COINS.uncommon, name: "Pigstep Music Disc", icon: "textures/items/record_pigstep", tab: "Lighting & Miscellaneous" },
    { id: "minecraft:wither_skeleton_skull", amt: 1, cost: 3, wantId: COINS.rare, name: "Wither Skeleton Skull", icon: "textures/items/wither_skeleton_face", tab: "Lighting & Miscellaneous" }
  ];

  createGeneratedShop(player, "Nether Shop", "_nether", trades, "§aNether Shop successfully generated!");
}

// ==========================================
// HARDCODED WOOD SHOP GENERATOR
// ==========================================
export function generateWoodShop(player) {
  const trades = [
    // Standard Woods
    { id: "minecraft:oak_log", amt: 64, cost: 1, wantId: COINS.common, name: "Oak Logs", icon: "textures/blocks/log_oak", tab: "Standard Woods" },
    { id: "minecraft:spruce_log", amt: 64, cost: 1, wantId: COINS.common, name: "Spruce Logs", icon: "textures/blocks/log_spruce", tab: "Standard Woods" },
    { id: "minecraft:birch_log", amt: 64, cost: 1, wantId: COINS.common, name: "Birch Logs", icon: "textures/blocks/log_birch", tab: "Standard Woods" },
    { id: "minecraft:jungle_log", amt: 64, cost: 1, wantId: COINS.common, name: "Jungle Logs", icon: "textures/blocks/log_jungle", tab: "Standard Woods" },
    { id: "minecraft:acacia_log", amt: 64, cost: 1, wantId: COINS.common, name: "Acacia Logs", icon: "textures/blocks/log_acacia", tab: "Standard Woods" },
    { id: "minecraft:dark_oak_log", amt: 64, cost: 1, wantId: COINS.common, name: "Dark Oak Logs", icon: "textures/blocks/log_big_oak", tab: "Standard Woods" },

    // Stripped Woods
    { id: "minecraft:stripped_oak_log", amt: 64, cost: 1, wantId: COINS.common, name: "Stripped Oak Logs", icon: "textures/blocks/stripped_oak_log", tab: "Stripped Woods" },
    { id: "minecraft:stripped_spruce_log", amt: 64, cost: 1, wantId: COINS.common, name: "Stripped Spruce Logs", icon: "textures/blocks/stripped_spruce_log", tab: "Stripped Woods" },
    { id: "minecraft:stripped_birch_log", amt: 64, cost: 1, wantId: COINS.common, name: "Stripped Birch Logs", icon: "textures/blocks/stripped_birch_log", tab: "Stripped Woods" },
    { id: "minecraft:stripped_jungle_log", amt: 64, cost: 1, wantId: COINS.common, name: "Stripped Jungle Logs", icon: "textures/blocks/stripped_jungle_log", tab: "Stripped Woods" },
    { id: "minecraft:stripped_acacia_log", amt: 64, cost: 1, wantId: COINS.common, name: "Stripped Acacia Logs", icon: "textures/blocks/stripped_acacia_log", tab: "Stripped Woods" },
    { id: "minecraft:stripped_dark_oak_log", amt: 64, cost: 1, wantId: COINS.common, name: "Stripped Dark Oak Logs", icon: "textures/blocks/stripped_dark_oak_log", tab: "Stripped Woods" },

    // Nether Woods
    { id: "minecraft:crimson_hyphae", amt: 32, cost: 1, wantId: COINS.common, name: "Crimson Hyphae", icon: "textures/blocks/huge_fungus/crimson_stem_side", tab: "Nether Woods" },
    { id: "minecraft:warped_hyphae", amt: 32, cost: 1, wantId: COINS.common, name: "Warped Hyphae", icon: "textures/blocks/huge_fungus/warped_stem_side", tab: "Nether Woods" },
    { id: "minecraft:stripped_crimson_hyphae", amt: 32, cost: 1, wantId: COINS.common, name: "Stripped Crimson Hyphae", icon: "textures/blocks/huge_fungus/stripped_crimson_stem_side", tab: "Nether Woods" },
    { id: "minecraft:stripped_warped_hyphae", amt: 32, cost: 1, wantId: COINS.common, name: "Stripped Warped Hyphae", icon: "textures/blocks/huge_fungus/stripped_warped_stem_side", tab: "Nether Woods" },

    // Rare Biome Woods
    { id: "minecraft:cherry_log", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Cherry Logs", icon: "textures/blocks/cherry_log_side", tab: "Rare Biome Woods" },
    { id: "minecraft:pale_oak_log", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Pale Oak Logs", icon: "textures/blocks/pale_oak_log_side", tab: "Rare Biome Woods" },
    { id: "minecraft:mangrove_log", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Mangrove Logs", icon: "textures/blocks/mangrove_log_side", tab: "Rare Biome Woods" },
    { id: "minecraft:bamboo_block", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Bamboo Blocks", icon: "textures/blocks/bamboo_block", tab: "Rare Biome Woods" },

    // Rare Stripped Woods
    { id: "minecraft:stripped_cherry_log", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Stripped Cherry Logs", icon: "textures/blocks/stripped_cherry_log_side", tab: "Rare Stripped Woods" },
    { id: "minecraft:stripped_pale_oak_log", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Stripped Pale Oak Logs", icon: "textures/blocks/stripped_pale_oak_log_side", tab: "Rare Stripped Woods" },
    { id: "minecraft:stripped_mangrove_log", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Stripped Mangrove Logs", icon: "textures/blocks/stripped_mangrove_log_side", tab: "Rare Stripped Woods" },
    { id: "minecraft:stripped_bamboo_block", amt: 64, cost: 1, wantId: COINS.uncommon, name: "Stripped Bamboo Blocks", icon: "textures/blocks/stripped_bamboo_block", tab: "Rare Stripped Woods" }
  ];

  createGeneratedShop(player, "Wood Shop", "_wood", trades, "§aWood Shop successfully generated!");
}

// ==========================================
// HARDCODED STONE SHOP GENERATOR
// ==========================================
export function generateStoneShop(player) {
  const trades = [
    { id: "minecraft:cobblestone", amt: 64, cost: 1, wantId: COINS.common, name: "Cobblestone", icon: "textures/blocks/cobblestone", tab: "Stone Blocks" },
    { id: "minecraft:stone", amt: 48, cost: 1, wantId: COINS.common, name: "Stone", icon: "textures/blocks/stone", tab: "Stone Blocks" },
    { id: "minecraft:cobbled_deepslate", amt: 64, cost: 1, wantId: COINS.common, name: "Cobbled Deepslate", icon: "textures/items/cobbled_deepslate", tab: "Stone Blocks" },
    { id: "minecraft:deepslate", amt: 48, cost: 1, wantId: COINS.common, name: "Deepslate", icon: "textures/items/deepslate", tab: "Stone Blocks" },
    { id: "minecraft:andesite", amt: 64, cost: 1, wantId: COINS.common, name: "Andesite", icon: "textures/blocks/stone_andesite", tab: "Stone Blocks" },
    { id: "minecraft:diorite", amt: 64, cost: 1, wantId: COINS.common, name: "Diorite", icon: "textures/blocks/stone_diorite", tab: "Stone Blocks" },
    { id: "minecraft:granite", amt: 64, cost: 1, wantId: COINS.common, name: "Granite", icon: "textures/blocks/stone_granite", tab: "Stone Blocks" },
    { id: "minecraft:tuff", amt: 48, cost: 1, wantId: COINS.common, name: "Tuff", icon: "textures/blocks/tuff", tab: "Stone Blocks" },
    { id: "minecraft:brick_block", amt: 48, cost: 1, wantId: COINS.common, name: "Brick Blocks", icon: "textures/blocks/brick", tab: "Stone Blocks" },
    { id: "minecraft:calcite", amt: 48, cost: 1, wantId: COINS.uncommon, name: "Calcite", icon: "textures/blocks/calcite", tab: "Stone Blocks" },
    { id: "minecraft:prismarine", amt: 48, cost: 1, wantId: COINS.uncommon, name: "Prismarine Blocks", icon: "textures/items/ocean_prismarine_bricks", tab: "Stone Blocks" }
  ];

  createGeneratedShop(player, "Stone Shop", "_stone", trades, "§aStone Shop successfully generated!");
}

// ==========================================
// HARDCODED SPECIALIST SHOP GENERATOR
// ==========================================
export function generateSpecialistShop(player) {
  const trades = [
    // Utility Blocks
    { id: "minecraft:sponge", amt: 1, cost: 1, wantId: COINS.common, name: "Sponge", icon: "textures/blocks/sponge", tab: "Utility Blocks" },
    { id: "minecraft:obsidian", amt: 8, cost: 1, wantId: COINS.common, name: "Obsidian", icon: "textures/blocks/obsidian", tab: "Utility Blocks" },
    { id: "minecraft:crying_obsidian", amt: 4, cost: 1, wantId: COINS.common, name: "Crying Obsidian", icon: "textures/blocks/crying_obsidian", tab: "Utility Blocks" },
    { id: "minecraft:amethyst_block", amt: 32, cost: 1, wantId: COINS.common, name: "Amethyst Blocks", icon: "textures/blocks/amethyst_block", tab: "Utility Blocks" },
    { id: "minecraft:sea_lantern", amt: 32, cost: 1, wantId: COINS.common, name: "Sea Lanterns", icon: "textures/blocks/sea_lantern", tab: "Utility Blocks" },

    // Unobtainable Blocks
    { id: "minecraft:gilded_blackstone", amt: 32, cost: 5, wantId: COINS.uncommon, name: "Gilded Blackstone", icon: "textures/blocks/gilded_blackstone", tab: "Unobtainable Blocks" },
    { id: "minecraft:glowingobsidian", amt: 48, cost: 10, wantId: COINS.uncommon, name: "Glowing Obsidian", icon: "textures/blocks/glowing_obsidian", tab: "Unobtainable Blocks" },
    { id: "minecraft:reinforced_deepslate", amt: 8, cost: 32, wantId: COINS.rare, name: "Reinforced Deepslate", icon: "textures/blocks/reinforced_deepslate_top", tab: "Unobtainable Blocks" },
    { id: "minecraft:bedrock", amt: 1, cost: 64, wantId: COINS.rare, name: "Bedrock", icon: "textures/blocks/bedrock", tab: "Unobtainable Blocks" },

    // Decay placeholders
    {
      id: "minecraft:arrow",
      amt: 8,
      wants: [
        { typeId: "minecraft:wither_rose", amount: 10 },
        { typeId: "minecraft:arrow", amount: 8 }
      ],
      name: "Arrow of Decay",
      icon: "textures/items/arrow",
      tab: "Decay",
      sellNameTag: "§5Arrow of Decay",
      lore: ["§7Requires both Wither Roses and Arrows"]
    },
    { id: "minecraft:splash_potion", amt: 1, cost: 32, wantId: "minecraft:wither_rose", name: "Splash Decay Potion", icon: "textures/items/potion_bottle_splash", tab: "Decay", sellNameTag: "§5Splash Decay Potion" },
    { id: "minecraft:lingering_potion", amt: 1, cost: 48, wantId: "minecraft:wither_rose", name: "Lingering Decay Potion", icon: "textures/items/potion_bottle_lingering", tab: "Decay", sellNameTag: "§5Lingering Decay Potion" }
  ];

  createGeneratedShop(player, "Specialist Shop", "_spec", trades, "§aSpecialist Shop successfully generated!");
}

// ==========================================
// HARDCODED EVENT SHOP GENERATOR
// ==========================================
export function generateEventShop(player) {
  const trades = [
    // Randomized Rewards
    {
      id: "viberater:loot_random_skull",
      amt: 1,
      cost: 2,
      wantId: COINS.event,
      name: "Random Head",
      icon: eventLootIcon("viberater:loot_random_skull"),
      tab: "Randomized Rewards",
      lore: [
        "§7Random mob head",
        "§8Excludes Dragon & Player heads"
      ]
    },
    {
      id: "viberater:loot_music_disc",
      amt: 1,
      cost: 2,
      wantId: COINS.event,
      name: "Random Music Disc",
      icon: eventLootIcon("viberater:loot_music_disc"),
      tab: "Randomized Rewards",
      lore: ["§7All obtainable music discs"]
    },
    {
      id: "viberater:loot_common_trim",
      amt: 1,
      cost: 3,
      wantId: COINS.event,
      name: "Random Common Trim",
      icon: eventLootIcon("viberater:loot_common_trim"),
      tab: "Randomized Rewards",
      lore: [
        "§7Equal odds: Sentry, Dune, Coast, Wild",
        "§7Wayfinder, Raiser, Shaper",
        "§7Host, Bolt"
      ]
    },
    {
      id: "viberater:loot_rare_trim",
      amt: 1,
      cost: 5,
      wantId: COINS.event,
      name: "Random Rare Trim",
      icon: eventLootIcon("viberater:loot_rare_trim"),
      tab: "Randomized Rewards",
      lore: ["§7Equal odds: Vex, Rib, Snout, Eye", "§7Ward, Tide, Flow"]
    },
    {
      id: "viberater:loot_random_dyes",
      amt: 1,
      cost: 5,
      wantId: COINS.event,
      name: "Random Dye Bundle",
      icon: eventLootIcon("viberater:loot_random_dyes"),
      tab: "Randomized Rewards",
      lore: ["§7Stacks of random dyes"]
    },
    {
      id: "viberater:loot_random_flowers",
      amt: 1,
      cost: 5,
      wantId: COINS.event,
      name: "Random Flower Bundle",
      icon: eventLootIcon("viberater:loot_random_flowers"),
      tab: "Randomized Rewards",
      lore: ["§7Stacks of random flowers"]
    },
    {
      id: "viberater:loot_random_wool",
      amt: 1,
      cost: 5,
      wantId: COINS.event,
      name: "Random Wool Bundle",
      icon: eventLootIcon("viberater:loot_random_wool"),
      tab: "Randomized Rewards",
      lore: ["§7Stacks of random colored wool"]
    },
    {
      id: "viberater:loot_random_terracotta",
      amt: 1,
      cost: 5,
      wantId: COINS.event,
      name: "Random Terracotta Bundle",
      icon: eventLootIcon("viberater:loot_random_terracotta"),
      tab: "Randomized Rewards",
      lore: [
        "§7Colored terracotta & glazed",
        "§7terracotta stacks"
      ]
    },
    {
      id: "viberater:loot_random_concrete",
      amt: 1,
      cost: 5,
      wantId: COINS.event,
      name: "Random Concrete Bundle",
      icon: eventLootIcon("viberater:loot_random_concrete"),
      tab: "Randomized Rewards",
      lore: ["§7Stacks of random colored concrete"]
    },
    {
      id: "viberater:loot_hmob_egg",
      amt: 1,
      cost: 15,
      wantId: COINS.event,
      name: "Random Spawn Egg",
      icon: eventLootIcon("viberater:loot_hmob_egg"),
      tab: "Randomized Rewards",
      lore: [
        "§7Random allowed hostile mob egg",
        "§8Excludes Dragon, Wither, Iron Golem",
        "§8Piglins, Evoker, Pillager, Shulker",
        "§8Villager and Wither Skeleton"
      ]
    },
    {
      id: "minecraft:silence_armor_trim_smithing_template",
      amt: 1,
      cost: 30,
      wantId: COINS.event,
      name: "Random Legendary Trim",
      icon: "textures/items/silence_armor_trim_smithing_template",
      tab: "Randomized Rewards",
      sellOptions: [
        { typeId: "minecraft:silence_armor_trim_smithing_template" },
        { typeId: "minecraft:spire_armor_trim_smithing_template" }
      ],
      lore: ["§7Silence: 50%", "§7Spire: 50%"]
    },

    // Utility & Rare Items
    { id: "minecraft:enchanted_golden_apple", amt: 1, cost: 5, wantId: COINS.event, name: "Enchanted Golden Apple", icon: "textures/items/apple_golden", tab: "Utility & Rare Items" },
    { id: "minecraft:totem_of_undying", amt: 1, cost: 10, wantId: COINS.event, name: "Totem of Undying", icon: "textures/items/totem", tab: "Utility & Rare Items" },
    { id: "minecraft:wind_charge", amt: 32, cost: 15, wantId: COINS.event, name: "Breeze Bombs", icon: "textures/items/wind_charge", tab: "Utility & Rare Items" },
    { id: "minecraft:netherreactor", amt: 1, cost: 20, wantId: COINS.event, name: "Nether Reactor Core", icon: "textures/items/nether_reactor_core", tab: "Utility & Rare Items" },
    { id: "minecraft:netherite_upgrade_smithing_template", amt: 10, cost: 25, wantId: COINS.event, name: "Netherite Upgrade Templates", icon: "textures/items/netherite_upgrade_smithing_template", tab: "Utility & Rare Items" },
    {
      id: "minecraft:elytra",
      amt: 1,
      cost: 30,
      wantId: COINS.event,
      name: "Enchanted Elytra",
      icon: "textures/items/elytra",
      tab: "Utility & Rare Items",
      sellNameTag: "§b§lEnchanted Elytra",
      enchantments: [
        { id: "minecraft:unbreaking", level: 3 },
        { id: "minecraft:mending", level: 1 }
      ],
      lore: ["§7Unbreaking III", "§7Mending I"]
    },
    { id: "minecraft:heavy_core", amt: 1, cost: 40, wantId: COINS.event, name: "Heavy Core", icon: "textures/blocks/heavy_core", tab: "Utility & Rare Items" },
    { id: "minecraft:mob_spawner", amt: 1, cost: 50, wantId: COINS.event, name: "Mob Spawner", icon: "textures/blocks/mob_spawner", tab: "Utility & Rare Items" },
    { id: "minecraft:bedrock", amt: 1, cost: 64, wantId: COINS.event, name: "Bedrock", icon: "textures/blocks/bedrock", tab: "Utility & Rare Items" },
    { id: "minecraft:cod", amt: 1, cost: 90, wantId: COINS.event, name: "Knockback XVI Fish", icon: "textures/items/fish_cod_raw", tab: "Utility & Rare Items", sellNameTag: "§b§lKnockback XVI Fish", lore: ["§7Knockback XVI event reward"] },

    // Permit Books
    {
      id: "minecraft:written_book",
      amt: 1,
      cost: 100,
      wantId: COINS.event,
      name: "Raid Authorization Permit",
      icon: "textures/items/written_book",
      tab: "Permit Books",
      sellNameTag: "§c§lRaid Authorization Permit",
      lore: [
        "§7One approved target and property",
        "§7Present to server staff for activation",
        "§8Temporarily bypasses Kill and Steal protection"
      ],
      book: {
        signed: true,
        title: "Raid Permit",
        author: "RAIN SMP",
        pages: [
          "RAID AUTHORIZATION\n\nValid for one approved player or faction and one property only.",
          "Present this permit to server staff for approval and activation before use."
        ]
      }
    },
    {
      id: "minecraft:writable_book",
      amt: 1,
      cost: 128,
      wantId: COINS.event,
      name: "The Death Note",
      icon: "textures/items/writable_book",
      tab: "Permit Books",
      sellNameTag: "§4§lThe Death Note",
      lore: [
        "§7Write one online player's name",
        "§7Present the completed note to a moderator",
        "§8Subject to server rules and staff approval"
      ]
    },

    // Enchantment Books
    { id: "minecraft:enchanted_book", amt: 1, cost: 3, wantId: COINS.event, name: "Book: Unbreaking III", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:unbreaking", level: 3 }], lore: ["§7Unbreaking III"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 6, wantId: COINS.event, name: "Book: Protection IV", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:protection", level: 4 }], lore: ["§7Protection IV"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 10, wantId: COINS.event, name: "Book: Efficiency V", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:efficiency", level: 5 }], lore: ["§7Efficiency V"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 20, wantId: COINS.event, name: "Book: Sharpness V", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:sharpness", level: 5 }], lore: ["§7Sharpness V"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 30, wantId: COINS.event, name: "Book: Frost Walker II", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:frost_walker", level: 2 }], lore: ["§7Frost Walker II"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 40, wantId: COINS.event, name: "Book: Soul Speed III", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:soul_speed", level: 3 }], lore: ["§7Soul Speed III"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 50, wantId: COINS.event, name: "Book: Swift Sneak III", icon: "textures/items/book_enchanted", tab: "Enchantment Books", enchantments: [{ id: "minecraft:swift_sneak", level: 3 }], lore: ["§7Swift Sneak III"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 60, wantId: COINS.event, name: "Book: Protection V Placeholder", icon: "textures/items/book_enchanted", tab: "Enchantment Books", lore: ["§8Placeholder reward - not yet active"] },
    { id: "minecraft:enchanted_book", amt: 1, cost: 75, wantId: COINS.event, name: "Book: Sharpness VI Placeholder", icon: "textures/items/book_enchanted", tab: "Enchantment Books", lore: ["§8Placeholder reward - not yet active"] }
  ];

  upsertGeneratedShop(player, "Event Shop", "_evt", trades, "§a✨ Event Shop successfully generated!");
}

// ==========================================
// NPC INTERACTION PASSTHROUGH
// ==========================================
export function openShopForEntityPlayer(player, entity) {
  return openRealNpcMenu(player, entity);
}
