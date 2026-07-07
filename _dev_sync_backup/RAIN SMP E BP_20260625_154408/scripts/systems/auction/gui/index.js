import { ActionFormData } from "@minecraft/server-ui";
import { peekAuctionClaimCount } from "../store.js";
import { browseListingsMenu } from "./browse.js";
import { createListingMenu } from "./create.js";
import { myListingsMenu } from "./myListings.js";
import { claimsMenu } from "./claims.js";
import { denyRestrictedCreative, isRestrictedCreativeRole } from "../../../utils/creativeRoleGuard.js";

export async function openAuctionHouse(player) {
  if (!player) return;

  if (isRestrictedCreativeRole(player)) {
    denyRestrictedCreative(
      player,
      "anti_abuse_auction",
      "You cannot use the Auction House in Creative mode."
    );
    return;
  }

  while (true) {
    const claims = peekAuctionClaimCount(player.name);

    const form = new ActionFormData()
      .title("bd.gui:AUCTION HOUSE")
      .body("§7Trade items with other players\n§8Item-for-item only")
      .button("§bBrowse Listings", 'textures/bd/auctions/browse')
      .button("§aCreate Listing", 'textures/bd/auctions/create')
      .button(claims > 0 ? `§eClaims (§a${claims}§e)` : "§eClaims", 'textures/bd/auctions/claims')
      .button("§dMy Listings", 'textures/bd/auctions/my')

    const res = await form.show(player);
    if (res.canceled) return;

    switch (res.selection) {
      case 0: await browseListingsMenu(player); break;
      case 1: await createListingMenu(player); break;
      case 2: await claimsMenu(player); break;
      case 3: await myListingsMenu(player); break;
      default: return;
    }
  }
}
