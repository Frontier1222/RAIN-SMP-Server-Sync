import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
import { pickInventorySlot } from "../utils/inventoryPick.js";
import { buildItemDataFromItemStack } from "../utils/itemDisplay.js";
import { addAuctionListing } from "../store.js";
import { pickVanillaItem } from "../utils/itemCatalogPick.js";
import { toastError, toastSuccess } from "../../../utils/realmPerf.js";

export async function createListingMenu(player) {
  const sellPick = await pickInventorySlot(player, "Select item to SELL");
  if (!sellPick) return;

  const max = sellPick.item.amount;

  if (max < 1) {
    toastError(player, "§cThat item stack has an invalid amount.", "auction_invalid_amount");
    return;
  }

  const amountRes = await new ModalFormData()
    .title("Sell Amount")
    .slider("Amount", 1, max, {
      valueStep: 1,
      defaultValue: max
    })
    .show(player);

  if (amountRes.canceled) return;

  const sellAmount = amountRes.formValues[0];

  const wantItem = await pickVanillaItem(player, "Select item you WANT");
  if (!wantItem) return;

  const maxPay = Math.min(64, wantItem.maxAmount ?? 64);

  const wantRes = await new ModalFormData()
    .title("Payment Amount")
    .slider("Buyer pays", 1, maxPay, {
      defaultValue: 1,
      valueStep: 1
    })
    .show(player);

  if (wantRes.canceled) return;

  const listing = {
    id: `${Date.now()}-${player.name}`,
    sellerName: player.name,
    createdAt: Date.now(),
    sell: buildItemDataFromItemStack(sellPick.item, sellAmount),
    want: buildItemDataFromItemStack(wantItem, wantRes.formValues[0]),
  };

  const confirm = await new ActionFormData()
    .title("Confirm Listing")
    .body("List this item?")
    .button("§aConfirm")
    .button("§7Cancel")
    .show(player);

  if (confirm.selection !== 0) return;

  const remaining = sellPick.item.amount - sellAmount;
  const container = player.getComponent("minecraft:inventory").container;

  if (remaining <= 0) {
    container.setItem(sellPick.slot, undefined);
  } else {
    sellPick.item.amount = remaining;
    container.setItem(sellPick.slot, sellPick.item);
  }

  addAuctionListing(listing);
  toastSuccess(player, "§aListing created!", "auction_list_created");
}