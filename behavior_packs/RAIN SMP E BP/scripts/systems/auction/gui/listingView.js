// auction/gui/listingView.js
import { ActionFormData } from "@minecraft/server-ui";
import {
  listAuctionListings,
  removeAuctionListing,
  addAuctionClaim
} from "../store.js";
import { buildItemStackFromItemData } from "../utils/itemDisplay.js";
import { giveItemToPlayer, takeItemsByType, countItemsByType } from "../utils/inventory.js";
import { toastError, toastSuccess } from "../../../utils/realmPerf.js";

export async function viewAndTradeListingMenu(player, id) {
  const listing = listAuctionListings().find(l => l.id === id);
  if (!listing) return;

  const have = countItemsByType(
    player.getComponent("minecraft:inventory").container,
    listing.want.typeId
  );

  // helper to create display name (string or rawtext)
  const makeName = (data) => {
    if (!data) return "";
    if (data.nameTag) return data.nameTag;
    if (data.localizationKey) return { rawtext: [{ translate: data.localizationKey }] };
    return data.typeId?.split(":")[1]?.replace(/_/g, " ") || data.typeId;
  };

  const sellName = makeName(listing.sell);
  const wantName = makeName(listing.want);

  const body = { rawtext: [] };
  body.rawtext.push({ text: `Seller: §f${listing.sellerName}\n\n` });
  body.rawtext.push({ text: `§aOffering:\n` });
  if (typeof sellName === "string") body.rawtext.push({ text: `${sellName}` });
  else body.rawtext.push(...sellName.rawtext);
  body.rawtext.push({ text: ` x${listing.sell.amount}\n\n` });
  body.rawtext.push({ text: `§eWants:\n` });
  if (typeof wantName === "string") body.rawtext.push({ text: `${wantName}` });
  else body.rawtext.push(...wantName.rawtext);
  body.rawtext.push({ text: ` x${listing.want.amount}\n\nYou have: §f${have}` });

  const form = new ActionFormData()
    .title("bd.action:                                        Auction Listing") 
    .body(body)
    .button("§aTrade")
    .button("§7Back");

  const res = await form.show(player);
  if (res.canceled || res.selection !== 0) return;

  if (have < listing.want.amount) {
    toastError(player, "§cYou don't have the required items.", "auction_no_items");
    return;
  }

  const removed = removeAuctionListing(id);
  if (!removed.ok) return;

  takeItemsByType(
    player.getComponent("minecraft:inventory").container,
    listing.want.typeId,
    listing.want.amount
  );

  addAuctionClaim(listing.sellerName, listing.want);
  giveItemToPlayer(player, buildItemStackFromItemData(listing.sell));

  toastSuccess(player, "§aTrade completed!", "auction_trade_ok");
}