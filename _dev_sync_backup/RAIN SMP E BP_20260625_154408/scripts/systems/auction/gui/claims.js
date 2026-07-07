import { claimAuctionClaims } from "../store.js";
import { buildItemStackFromItemData } from "../utils/itemDisplay.js";
import { giveItemToPlayer } from "../utils/inventory.js";
import { toast, toastSuccess } from "../../../utils/realmPerf.js";

export async function claimsMenu(player) {
  const items = claimAuctionClaims(player.name);
  if (!items.length) {
    toast(player, "§7No items to claim.", "auction_no_claims");
    return;
  }

  for (const it of items) {
    giveItemToPlayer(player, buildItemStackFromItemData(it));
  }

  toastSuccess(player, "§aAll claims collected.", "auction_claims_collected");
}