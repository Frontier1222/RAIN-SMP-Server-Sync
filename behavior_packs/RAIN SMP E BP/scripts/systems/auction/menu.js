import { ItemStack, ItemComponentTypes } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
// Chest style forms replaced with action menus
import { buildPotionDisplay } from "../../utils/data/potions.js";
import {
  addAuctionClaim,
  addAuctionListing,
  claimAuctionClaims,
  listAuctionListings,
  peekAuctionClaimCount,
  removeAuctionListing,
} from "../store.js";
import { openAuctionHouse } from '../gui/index.js';
import { toastError, toastSuccess } from '../../utils/realmPerf.js';

const GUI_ITEM_ID = "bd:gui";

function newAuctionId(player) {
  const now = Date.now();
  const name = String(player?.name ?? "player").replace(/\s+/g, "_");
  const r = Math.floor(Math.random() * 1_000_000_000);
  return `${now}-${name}-${r}`;
}

function itemDisplayNameFromTypeId(typeId) {
  const s = String(typeId ?? "minecraft:barrier");
  const base = s.includes(":") ? s.split(":")[1] : s;
  return base
    .replace(/_/g, " ")
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}

function buildItemDataFromItemStack(item, amountOverride = null) {
  if (!item) return null;

  const typeId = String(item.typeId ?? "").trim();
  if (!typeId) return null;

  const maxAmt = Math.max(1, Math.min(64, Math.floor(Number(item.amount ?? 1)) || 1));
  const amount = amountOverride === null ? maxAmt : Math.max(1, Math.min(maxAmt, Math.floor(Number(amountOverride) || 1)));

  const lore = Array.isArray(item.getLore?.()) ? item.getLore().map((l) => String(l)).slice(0, 50) : [];

  const enchComp = item.getComponent?.(ItemComponentTypes.Enchantable);
  const enchants = enchComp?.getEnchantments?.() ?? [];
  const enchantments = Array.isArray(enchants)
    ? enchants
      .map((e) => ({ id: String(e?.type?.id ?? "").trim(), level: Math.max(1, Math.trunc(Number(e?.level ?? 1))) }))
      .filter((e) => e.id)
      .slice(0, 50)
    : [];

  const durComp = item.getComponent?.(ItemComponentTypes.Durability);
  const durability = durComp
    ? {
      maxDurability: Math.max(0, Math.trunc(Number(durComp.maxDurability ?? 0))),
      damage: Math.max(0, Math.trunc(Number(durComp.damage ?? 0))),
    }
    : null;

  return {
    typeId,
    amount,
    nameTag: item.nameTag ? String(item.nameTag) : "",
    lore,
    localizationKey: item.localizationKey ? String(item.localizationKey) : "",
    enchantments,
    durability,
  };
}

function applyEnchantments(stack, enchantments) {
  const enchComp = stack.getComponent?.(ItemComponentTypes.Enchantable);
  if (!enchComp) return;

  const list = Array.isArray(enchantments) ? enchantments : [];
  for (const e of list) {
    const id = String(e?.id ?? "").trim();
    const level = Math.max(1, Math.min(255, Math.trunc(Number(e?.level ?? 1))));
    if (!id) continue;

    const type = EnchantmentTypes.get(id) ?? EnchantmentTypes.get(`minecraft:${id}`);
    if (!type) continue;

    if (enchComp.addEnchantment) enchComp.addEnchantment({ type, level });
    else if (enchComp.addEnchantments) enchComp.addEnchantments([{ type, level }]);
  }
}

function buildItemStackFromItemData(data) {
  const typeId = String(data?.typeId ?? "").trim();
  if (!typeId) return null;

  const amount = Math.max(1, Math.min(64, Math.floor(Number(data?.amount ?? 1)) || 1));
  const stack = new ItemStack(typeId, amount);

  if (data?.nameTag) stack.nameTag = String(data.nameTag);
  if (Array.isArray(data?.lore) && data.lore.length) stack.setLore(data.lore.map((l) => String(l)));

  applyEnchantments(stack, data?.enchantments);

  const dur = data?.durability;
  if (dur && Number(dur.maxDurability) > 0 && Number(dur.damage) > 0) {
    const d = stack.getComponent?.(ItemComponentTypes.Durability);
    if (d) d.damage = Math.min(Math.max(0, Math.trunc(Number(dur.damage))), Math.trunc(Number(d.maxDurability ?? 0)));
  }

  return stack;
}



function giveItemToPlayer(player, stack) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv || !stack) return false;

  const leftover = inv.addItem(stack);
  if (leftover) {
    player.dimension.spawnItem(leftover, player.location);
  }
  return true;
}

function formatListingLine(listing) {
  const sellName = listing?.sell?.nameTag
    ? String(listing.sell.nameTag)
    : listing?.sell?.localizationKey
      ? String(listing.sell.localizationKey)
      : itemDisplayNameFromTypeId(listing?.sell?.typeId);

  const wantName = listing?.want?.nameTag
    ? String(listing.want.nameTag)
    : listing?.want?.localizationKey
      ? String(listing.want.localizationKey)
      : itemDisplayNameFromTypeId(listing?.want?.typeId);

  return `§f${sellName}§r x${listing.sell.amount} §7for§r §e${wantName}§r x${listing.want.amount}`;
}

async function myListingsMenu(player, startPage = 0) {
  const pageSize = 28;
  let page = Math.max(0, Math.trunc(Number(startPage) || 0));

  while (true) {
    const mine = [...listAuctionListings()]
      .filter((l) => String(l.sellerName) === String(player.name))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    const maxPage = Math.max(0, Math.ceil(mine.length / pageSize) - 1);
    if (page > maxPage) page = maxPage;

    const slice = mine.slice(page * pageSize, page * pageSize + pageSize);

    const form = new ActionFormData().title("bd.action:§lMy Listings");
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
      if (id) {
        const confirm = await new ActionFormData()
          .title("bd.action:§lCancel Listing")
          .body("Cancel this listing? Your item will go to Claims.")
          .button("§cCancel Listing")
          .button("§7Back")
          .show(player);
        if (confirm.canceled || confirm.selection !== 0) continue;
        const removed = removeAuctionListing(id);
        if (!removed.ok || !removed.removed) continue;
        addAuctionClaim(player.name, removed.removed.sell);
        toastSuccess(player, "§aListing canceled. Check Claims to retrieve your item.", "auction_cancel");
      }
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

async function createListingMenu(player) {
  const sellPick = await pickInventorySlot(player, "Select item to SELL");
  if (sellPick.status !== "picked") return;

  const sellMax = Math.max(1, Math.min(64, Math.floor(Number(sellPick.item.amount ?? 1)) || 1));

  const sellAmountForm = new ModalFormData()
    .title("Auction: Amount")
    .slider(`Sell amount (1-${sellMax})`, 1, sellMax, { defaultValue: sellMax, valueStep: 1 });

  const sellAmountRes = await sellAmountForm.show(player);
  if (sellAmountRes.canceled) return;

  const sellAmount = Math.max(1, Math.min(sellMax, Math.floor(Number(sellAmountRes.formValues?.[0] ?? sellMax))));

  const wantPick = await pickInventorySlot(player, "Select item you WANT as payment");
  if (wantPick.status !== "picked") return;

  const wantAmountForm = new ModalFormData()
    .title("Auction: Requested Payment")
    .slider("Buyer must pay amount", 1, 64, { defaultValue: 1, valueStep: 1 });

  const wantAmountRes = await wantAmountForm.show(player);
  if (wantAmountRes.canceled) return;

  const wantAmount = Math.max(1, Math.min(64, Math.floor(Number(wantAmountRes.formValues?.[0] ?? 1))));

  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;

  const live = inv.getItem(sellPick.slot);
  if (!live || live.typeId !== sellPick.item.typeId) {
    toastError(player, "§cThat item changed. Try again.", "auction_item_changed");
    return;
  }

  if ((live.amount ?? 1) < sellAmount) {
    toastError(player, "§cYou no longer have that many.", "auction_not_enough");
    return;
  }

  const sellData = buildItemDataFromItemStack(live, sellAmount);
  const wantData = buildItemDataFromItemStack(wantPick.item, wantAmount);
  if (!sellData || !wantData) return;

  const summary =
    `You are listing:\n§a${itemDisplayNameFromTypeId(sellData.typeId)}§r x${sellData.amount}\n\n` +
    `You want:\n§e${itemDisplayNameFromTypeId(wantData.typeId)}§r x${wantData.amount}`;

  const confirm = await new ActionFormData()
    .title("bd.action:§lConfirm Listing")
    .body(summary)
    .button("§aList")
    .button("§7Back")
    .show(player);

  if (confirm.canceled || confirm.selection !== 0) return;

  if (live.amount === sellAmount) inv.setItem(sellPick.slot, undefined);
  else {
    live.amount = (live.amount ?? 1) - sellAmount;
    inv.setItem(sellPick.slot, live);
  }

  const listing = {
    id: newAuctionId(player),
    sellerName: player.name,
    createdAt: Date.now(),
    sell: sellData,
    want: { typeId: wantData.typeId, amount: wantData.amount, nameTag: wantData.nameTag, lore: wantData.lore, localizationKey: wantData.localizationKey },
  };

  const addRes = addAuctionListing(listing);
  if (!addRes.ok) {
    addAuctionClaim(player.name, sellData);
    toastError(player, `§cFailed to list: ${addRes.reason || "Unknown"}. Item moved to Claims.`, "auction_list_fail");
    return;
  }

  toastSuccess(player, "§aListing created! Players can now trade for it.", "auction_list_ok");
}

async function claimsMenu(player) {
  while (true) {
    const count = peekAuctionClaimCount(player.name);

    const form = new ActionFormData()
      .title("bd.action:§lAuction Claims")
      .body(count > 0 ? `You have §a${count}§r item(s) to claim.` : "No items to claim.")
      .button(count > 0 ? "§aClaim All" : "§7Claim All")
      .button("§7Back");

    const res = await form.show(player);
    if (res.canceled || res.selection !== 0) return;

    if (count <= 0) continue;

    const items = claimAuctionClaims(player.name);
    if (!items.length) continue;

    for (const it of items) {
      const stack = buildItemStackFromItemData(it);
      if (stack) giveItemToPlayer(player, stack);
    }

    toastSuccess(player, "§aClaimed your items.", "auction_claim_ok");
  }
}

export async function openAuctionHouse(player) {
  while (true) {
    const claimCount = peekAuctionClaimCount(player.name);

    const form = new ActionFormData()
      .title("bd.action:§lAuction House")
      .body(
        "§7Trade items with other players\n" +
        "§8Item-for-item trading only\n\n" +
        (claimCount > 0
          ? `§eYou have §a${claimCount}§e unclaimed item(s).`
          : "§7No pending claims.")
      )
      .button("§bBrowse Listings")
      .button("§aCreate Listing")
      .button(claimCount > 0 ? `§eClaims (§a${claimCount}§e)` : "§7Claims")
      .button("§dMy Listings")

    const res = await form.show(player);
    if (res.canceled) return;

    switch (res.selection) {
      case 0:
        await browseListingsMenu(player);
        break;

      case 1:
        await createListingMenu(player);
        break;

      case 2:
        await claimsMenu(player);
        break;

      case 3:
        await myListingsMenu(player);
        break;

      default:
        return;
    }
  }
}
