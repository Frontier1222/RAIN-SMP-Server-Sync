import { system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { listShops, getShopByNpc, setShopNpc, getShopWants } from './store.js';
import { toastError, toastSuccess } from "../../utils/realmPerf.js";

import { buildItemStackFromItemData, parseMcColorCodes } from '../auction/utils/itemDisplay.js';
import { countItemsByType, takeItemsByType, giveItemToPlayer } from '../auction/utils/inventory.js';
import { buildShopButtonTexture, resolveShopItemIcon } from './itemIcons.js';

import { openShopManager } from './gui/index.js';
export { openShopManager };

function formatShopActionTitle(text) {
    return `bd.action:§5§l${text}§r`;
}

function formatWantName(want) {
    if (want?.nameTag) return want.nameTag;
    return (want?.typeId || "unknown").split(':').pop().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatPriceLine(wants) {
    if (!wants?.length) return '§aFree';
    return wants.map((w) => `§d${w.amount}x ${formatWantName(w)}`).join(' §7+ ');
}

// ==========================================
// 1. MAIN ENTRY - ROUTE TO TABS
// ==========================================
export async function openShopForPlayer(player, shop) {
    if (!shop || !player) return;

    const items = shop.items || [];
    if (items.length === 0) {
        toastError(player, "§cThis shop is currently empty!", "shop_empty");
        return;
    }

    const categories = new Map();
    for (const item of items) {
        const catName = item.category || "Misc Items";
        if (!categories.has(catName)) categories.set(catName, []);
        categories.get(catName).push(item);
    }

    const categoryNames = Array.from(categories.keys());

    // This forces the tabs to ALWAYS show first!
    return showShopTabs(player, shop, categories, categoryNames);
}

// ==========================================
// 2. THE TABS MENU
// ==========================================
async function showShopTabs(player, shop, categories, categoryNames) {
    const form = new ActionFormData().title(formatShopActionTitle(shop.name));

    for (const cat of categoryNames) {
        form.button(`§d${cat}`);
    }
    // Matches the purple UI theme
    form.button('§wClose');

    const res = await form.show(player);
    if (!res || res.canceled || res.selection === categoryNames.length) return;

    const selectedCategory = categoryNames[res.selection];
    const categoryItems = categories.get(selectedCategory);

    showShopCategory(player, shop, selectedCategory, categoryItems);
}

// ==========================================
// 3. THE ITEMS MENU (WITH ICONS)
// ==========================================
async function showShopCategory(player, shop, categoryName, categoryItems) {
    const form = new ActionFormData().title(formatShopActionTitle(`${shop.name} - ${categoryName}`));

    for (const item of categoryItems) {
        const wants = getShopWants(item);
        
        let displayName = item.customName || item.sell?.nameTag;
        if (!displayName) {
            displayName = (item.sell?.typeId || "unknown").split(':').pop().replace(/_/g, ' ');
            displayName = displayName.replace(/\b\w/g, l => l.toUpperCase());
        }
        
        const sellAmount = item.sell?.amount ?? 1;
        const priceLine = `§5Cost: ${formatPriceLine(wants)}`;

        const sellIcon = item.icon || resolveShopItemIcon(item.sell?.typeId);
        const buttonText = `§d${displayName} §7(x${sellAmount})\n${priceLine}`;
        const buttonIcon = buildShopButtonTexture(sellIcon);
        
        if (buttonIcon) {
            form.button(buttonText, buttonIcon);
        } else {
            form.button(buttonText);
        }
    }
    
    // Matches the purple UI theme
    form.button('§wBack');

    const res = await form.show(player);
    if (!res || res.canceled) return;
    
    if (res.selection === categoryItems.length) {
        return openShopForPlayer(player, shop); 
    }

    const pickedItem = categoryItems[res.selection];
    processPurchase(player, shop, categoryName, categoryItems, pickedItem);
}

function isShopActionLabel(text) {
    const plain = String(text ?? "").replace(/§[0-9a-fk-or]/gi, "").trim();
    return /^(buy|sell)\b/i.test(plain);
}

function buildShopPurchaseStack(picked) {
    const sell = { ...(picked.sell || {}) };

    // customName is for the shop menu only — never rename the item from it.
    if (sell.nameTag && isShopActionLabel(sell.nameTag)) {
        delete sell.nameTag;
    } else if (sell.nameTag) {
        sell.nameTag = parseMcColorCodes(sell.nameTag);
    }

    return buildItemStackFromItemData(sell);
}

// ==========================================
// 4. THE PURCHASE HANDLER
// ==========================================
async function processPurchase(player, shop, categoryName, categoryItems, picked) {
    const wants = getShopWants(picked);
    const inv = player.getComponent('minecraft:inventory')?.container;

    if (wants.length && inv) {
        for (const price of wants) {
            const have = countItemsByType(inv, price.typeId);
            if (have < price.amount) {
                toastError(player, '§cYou don\'t have the required payment.', "shop_no_payment");
                return showShopCategory(player, shop, categoryName, categoryItems);
            }
        }

        let itemNameStr = picked.customName || picked.sell?.nameTag;
        if (!itemNameStr) {
            itemNameStr = (picked.sell?.typeId || "unknown").split(':').pop().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        const priceStr = formatPriceLine(wants).replace(/§5Cost: /, '');

        const bodyStr = `\nItem: §d${itemNameStr} §7x${picked.sell.amount}\n\n§8Cost: ${priceStr}`;

        const confirm = await new ActionFormData()
            .title('bd.action:§5Buy Item')
            .body(bodyStr)
            .button('§aBuy')
            .button('§cCancel')
            .show(player);
        
        if (confirm.canceled || confirm.selection !== 0) {
            return showShopCategory(player, shop, categoryName, categoryItems);
        }

        for (const price of wants) {
            const have = countItemsByType(inv, price.typeId);
            if (have < price.amount) {
                toastError(player, '§cYou don\'t have the required payment.', "shop_no_payment");
                return showShopCategory(player, shop, categoryName, categoryItems);
            }
        }

        for (const price of wants) {
            const ok = takeItemsByType(inv, price.typeId, price.amount);
            if (!ok) {
                toastError(player, '§cFailed to take payment.', "shop_payment_fail");
                return showShopCategory(player, shop, categoryName, categoryItems);
            }
        }

        giveItemToPlayer(player, buildShopPurchaseStack(picked));
        toastSuccess(player, '§aPurchase complete!', "shop_purchase_ok");
        
        return showShopCategory(player, shop, categoryName, categoryItems);
    }

    const stack = buildShopPurchaseStack(picked);
    giveItemToPlayer(player, stack);
    toastSuccess(player, '§aItem received.', "shop_item_received");
    return showShopCategory(player, shop, categoryName, categoryItems);
}

// ==========================================
// 5. NPC INTERACTION LOGIC
// ==========================================
export function openShopForEntityPlayer(player, entity) {
    system.run(async () => {
        if (!entity || !player) return;

        // Check if the player is sneaking AND has the staff tag
        if (player.isSneaking && player.hasTag("staff")) {
            const shops = listShops();
            const currentShop = getShopByNpc(entity.id); // See if it's already linked

            const form = new ActionFormData()
                .title("bd.action:§5Link NPC to Shop")
                .body("Admin Setup: Which shop should this NPC open?");

            // Index 0: Dedicated Unlink Button
            if (currentShop) {
                form.button("§cUnlink this NPC");
            } else {
                form.button("§8Unlink this NPC (Not Linked)");
            }

            if (shops.length === 0) {
                form.button("§cNo shops created yet.");
                const res = await form.show(player);
                if (!res.canceled && res.selection === 0 && currentShop) {
                    setShopNpc(currentShop.id, null);
                    toastSuccess(player, "Successfully unlinked this NPC!", "npc_unlinked");
                }
                return;
            }

            // List all shops (Indexes 1+)
            for (const s of shops) {
                const isLinked = s.npc === entity.id;
                form.button(`${isLinked ? '§d[Linked] ' : ''}§5${s.name}`);
            }

            const res = await form.show(player);
            if (res.canceled) return;

            // Handle the Unlink button (Index 0)
            if (res.selection === 0) {
                if (currentShop) {
                    setShopNpc(currentShop.id, null);
                    toastSuccess(player, `Successfully unlinked this NPC from ${currentShop.name}!`, "npc_unlinked");
                } else {
                    toastError(player, "§cThis NPC is not currently linked to any shop.", "npc_not_linked");
                }
                return;
            }

            // Handle linking to a new shop (Subtract 1 from selection because Unlink is index 0)
            const selectedShop = shops[res.selection - 1];

            // Safety Check: If it was linked to an old shop, automatically unlink it first!
            if (currentShop && currentShop.id !== selectedShop.id) {
                setShopNpc(currentShop.id, null);
            }

            // Link the new shop
            setShopNpc(selectedShop.id, entity.id);
            toastSuccess(player, `Successfully linked this NPC to ${selectedShop.name}!`, "npc_linked");
            return;
        }

        // Normal shop opening logic for non-staff or non-sneaking players
        const shop = getShopByNpc(entity.id);
        if (!shop) {
            toastError(player, "§cThis NPC is closed.", "npc_closed");
            return;
        }
        
        return openShopForPlayer(player, shop);
    });
}