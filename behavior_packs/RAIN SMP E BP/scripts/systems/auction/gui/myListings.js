import { ActionFormData } from "@minecraft/server-ui";
import { listAuctionListings, removeAuctionListing, addAuctionClaim } from "../store.js";
import { formatListingLine } from "../utils/itemDisplay.js"; // text labels only
import { toastSuccess } from "../../../utils/realmPerf.js";

export async function myListingsMenu(player) {
  const mine = listAuctionListings().filter(l => l.sellerName === player.name);
  if (!mine.length) return;

  // FIXED: Kept the spacing trick, but removed the §l (Bold) to stop the glitch
  const form = new ActionFormData().title("bd.action:");
  const map = new Map();

  mine.forEach((l, i) => {
    form.button(formatListingLine(l));
    map.set(i, l.id);
  });
  form.button('§7Back');

  const res = await form.show(player);
  if (res.canceled) return;
  if (res.selection === mine.length) return;

  const id = map.get(res.selection);
  if (!id) return;

  const removed = removeAuctionListing(id);
  if (removed.ok) {
    addAuctionClaim(player.name, removed.removed.sell);
    toastSuccess(player, "§aListing cancelled. Item sent to claims.", "auction_listing_cancel");
  }
}