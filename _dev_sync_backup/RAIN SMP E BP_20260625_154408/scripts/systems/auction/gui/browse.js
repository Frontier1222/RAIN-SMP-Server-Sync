// auction/gui/browse.js
import { ActionFormData } from "@minecraft/server-ui";
import { listAuctionListings } from "../store.js";
import { formatListingLine } from "../utils/itemDisplay.js";
import { viewAndTradeListingMenu } from "./listingView.js";

const LIST_SLOTS = [
  10,11,12,13,14,15,16,
  19,20,21,22,23,24,25,
  28,29,30,31,32,33,34
];

export async function browseListingsMenu(player, page = 0) {
  const pageSize = 28; 
  while (true) {
    const listings = [...listAuctionListings()]
      .sort((a, b) => b.createdAt - a.createdAt);

    const maxPage = Math.max(0, Math.ceil(listings.length / pageSize) - 1);
    if (page > maxPage) page = maxPage;

    const slice = listings.slice(page * pageSize, (page + 1) * pageSize);

    // FIXED: Removed the §l (Bold) to stop the visual UI glitch!
    const form = new ActionFormData().title("bd.action:Auction Listings");
    const map = new Map();

    slice.forEach((l, i) => {
      form.button(formatListingLine(l));
      map.set(i, l.id);
    });

    if (page > 0) form.button("§bPrev Page");
    form.button("§cBack");
    if (page < maxPage) form.button("§bNext Page");

    const res = await form.show(player);
    if (res.canceled) return;

    const sel = res.selection;
    if (sel < slice.length) {
      const id = map.get(sel);
      if (id) await viewAndTradeListingMenu(player, id);
      continue;
    }
    let offset = slice.length;
    if (page > 0) {
      if (sel === offset) { page--; continue; }
      offset++;
    }
    if (sel === offset) return;
    offset++;
    if (page < maxPage && sel === offset) { page++; continue; }
  }
}