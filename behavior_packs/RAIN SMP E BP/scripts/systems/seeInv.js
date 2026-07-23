import { ActionFormData } from "@minecraft/server-ui";
import { buildPotionDisplay } from "../utils/data/potions";
import { toastError, toastSuccess, toastInfo } from "../utils/realmPerf.js";

const MAX_BUTTON_NAME_LEN = 22;
const MAX_DESC_LINE_LEN = 46;
const MAX_LORE_LINES = 10;
const CONSOLE_PAGE_SIZE = 7;

function stripColorCodes(text) {
  return String(text ?? "").replace(/§./g, "");
}

function truncateText(text, maxLen) {
  const plain = stripColorCodes(text).trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen - 1)}…`;
}

function stripBold(text) {
  return String(text ?? "").replace(/§l/gi, "");
}

function sanitizeLine(text) {
  return truncateText(stripBold(stripColorCodes(text)), MAX_DESC_LINE_LEN);
}

function getItemShortName(item) {
  if (item.nameTag) return stripColorCodes(item.nameTag);

  const id = String(item.typeId || "unknown")
    .split(":")
    .pop()
    .replace(/_/g, " ");

  return id.charAt(0).toUpperCase() + id.slice(1);
}

function getItemTypeColor(typeId) {
  const id = String(typeId || "").toLowerCase();
  const base = id.split(":").pop() || "";

  if (id.includes("potion") || id.includes("splash") || id.includes("lingering")) return "§d";
  if (base === "enchanted_book") return "§5";
  if (
    base.includes("sword") || base.includes("axe") || base === "trident" ||
    base === "bow" || base === "crossbow" || base === "mace"
  ) return "§c";
  if (
    base.includes("pickaxe") || base.includes("shovel") || base.includes("hoe") ||
    base === "shears" || base === "fishing_rod" || base === "flint_and_steel"
  ) return "§6";
  if (
    base.includes("helmet") || base.includes("chestplate") || base.includes("leggings") ||
    base.includes("boots") || base === "shield" || base === "elytra"
  ) return "§9";
  if (base.includes("spawn_egg")) return "§a";
  if (
    base.includes("apple") || base.includes("bread") || base.includes("beef") ||
    base.includes("pork") || base.includes("chicken") || base.includes("fish") ||
    base.includes("steak") || base.includes("carrot") || base.includes("potato") ||
    base.includes("berry") || base.includes("stew") || base.includes("soup") ||
    base.includes("cookie") || base.includes("melon") || base.includes("honey") ||
    base === "cake" || base.includes("mutton") || base.includes("rabbit")
  ) return "§e";
  if (
    base.includes("diamond") || base.includes("emerald") || base.includes("netherite") ||
    base.includes("ingot") || base.includes("ore") || base.includes("crystal") ||
    base.includes("shard") || base.includes("nugget") || base.includes("raw_")
  ) return "§b";
  if (
    base.includes("block") || base.includes("planks") || base.includes("stone") ||
    base.includes("brick") || base.includes("concrete") || base.includes("terracotta") ||
    base.includes("glass") || base.includes("stairs") || base.includes("slab") ||
    base.includes("door") || base.includes("log") || base.includes("wood") ||
    base.includes("sand") || base.includes("dirt") || base.includes("grass")
  ) return "§2";
  if (id.startsWith("bd:") || id.startsWith("viberater:")) return "§3";

  return "§f";
}

function toRoman(num) {
  if (!num || num <= 0) return "I";

  const romans = [
    ["M", 1000], ["CM", 900], ["D", 500], ["CD", 400],
    ["C", 100], ["XC", 90], ["L", 50], ["XL", 40],
    ["X", 10], ["IX", 9], ["V", 5], ["IV", 4], ["I", 1],
  ];

  let res = "";
  let n = Number(num);

  for (const [r, val] of romans) {
    while (n >= val) {
      res += r;
      n -= val;
    }
  }

  return res || "I";
}

function getEnchantCount(item) {
  const enchArr = item.getComponent?.("minecraft:enchantable")?.getEnchantments?.();
  return Array.isArray(enchArr) ? enchArr.length : 0;
}

function formatItemButtonLabel(item, displayIndex) {
  const color = getItemTypeColor(item.typeId);
  const name = truncateText(getItemShortName(item), MAX_BUTTON_NAME_LEN);
  const amt = item.amount > 1 ? ` §7x${item.amount}` : "";
  const enchCount = getEnchantCount(item);
  const enchHint = enchCount > 0 ? ` §5+${enchCount}` : "";
  return `§8[${displayIndex}] ${color}${name}§r${amt}${enchHint}`;
}

function buildSlotPickerBody({ playerName, sectionName, itemCount, emptyText, accentColor = "§b" }) {
  if (emptyText) {
    return `${accentColor}${playerName}§r\n\n§7${emptyText}`;
  }

  const sectionLine = sectionName ? `§7Section: ${accentColor}${sectionName}§r\n` : "";
  return (
    `${accentColor}${playerName}§r\n` +
    sectionLine +
    `§7Items found: §f${itemCount}\n\n` +
    `§8Select a slot to view details.`
  );
}

function getPagedEntries(entries, page, pageSize = CONSOLE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.max(0, Math.min(totalPages - 1, Number(page) || 0));
  return {
    page: safePage,
    totalPages,
    visible: entries.slice(safePage * pageSize, safePage * pageSize + pageSize),
  };
}

function buildItemDescriptionBody(item, displaySlot) {
  const typeColor = getItemTypeColor(item.typeId);
  const lines = [];
  const potionDisplay = buildPotionDisplay(item);

  lines.push(`§7Slot §f${displaySlot}`);

  let name = getItemShortName(item);
  if (potionDisplay?.displayName) {
    name = sanitizeLine(potionDisplay.displayName);
  } else {
    name = sanitizeLine(name);
  }

  lines.push(`${typeColor}${name}§r`);
  lines.push(`§7Amount: §f${item.amount || 1}`);

  const durComp = item.getComponent?.("minecraft:durability");
  if (durComp && durComp.maxDurability > 0) {
    const remaining = durComp.maxDurability - (durComp.damage || 0);
    const pct = Math.round((remaining / durComp.maxDurability) * 100);
    const durColor = pct > 50 ? "§a" : pct > 20 ? "§e" : "§c";
    lines.push(`§7Durability: ${durColor}${remaining}§7/${durComp.maxDurability}`);
  }

  const enchArr = item.getComponent?.("minecraft:enchantable")?.getEnchantments?.();
  if (Array.isArray(enchArr) && enchArr.length > 0) {
    lines.push("");
    lines.push("§5Enchants:");
    for (const en of enchArr) {
      const rawId = en?.type?.id || en?.id || en?.typeId || en?.name || "unknown";
      const id = String(rawId).split(":").pop().replace(/_/g, " ");
      const lvl = en?.lvl || en?.level || en?.levels || 1;
      lines.push(`§d${id.charAt(0).toUpperCase() + id.slice(1)} ${toRoman(lvl)}`);
    }
  }

  if (potionDisplay?.effectLines?.length) {
    lines.push("");
    lines.push("§dEffects:");
    for (const line of potionDisplay.effectLines.slice(0, 6)) {
      const cleaned = sanitizeLine(line);
      if (cleaned) lines.push(`§f${cleaned}`);
    }
  }

  if (potionDisplay?.whenAppliedLines?.length) {
    for (const chunk of potionDisplay.whenAppliedLines.slice(0, 4)) {
      const cleaned = sanitizeLine(chunk);
      if (cleaned) lines.push(`§7${cleaned}`);
    }
  }

  const lore = Array.isArray(item.getLore?.()) ? item.getLore() : [];
  const cleanLore = lore.map(sanitizeLine).filter(Boolean);

  if (cleanLore.length > 0) {
    lines.push("");
    lines.push("§7Description:");
    for (const line of cleanLore.slice(0, MAX_LORE_LINES)) {
      lines.push(`§f${line}`);
    }
    if (cleanLore.length > MAX_LORE_LINES) {
      lines.push(`§8... +${cleanLore.length - MAX_LORE_LINES} more lines`);
    }
  }

  lines.push("");
  lines.push(`§8${sanitizeLine(item.typeId || "unknown")}`);

  return lines.join("\n");
}

function getViewerInventory(viewer) {
  return viewer.getComponent("inventory")?.container
    || viewer.getComponent("minecraft:inventory")?.container;
}

function getEnderChestContainer(target) {
  return target.getComponent("minecraft:ender_inventory")?.container
    || target.getComponent("ender_inventory")?.container;
}

async function showItemActionMenu(viewer, item, displaySlot) {
  const body = buildItemDescriptionBody(item, displaySlot);

  const r = await new ActionFormData()
    .title("bd.action:Item Actions")
    .body(body)
    .button("§aGrab")
    .button("§bDuplicate")
    .button("§cDelete")
    .button("§7Back")
    .show(viewer);

  if (!r || r.canceled || r.selection === 3) return null;
  return r.selection;
}

function applyItemAction(viewer, container, contIndex, item, action) {
  const viewerInv = getViewerInventory(viewer);

  if (action === 0) {
    if (!viewerInv || viewerInv.emptySlotsCount <= 0) {
      toastError(viewer, "Your inventory is full.", "seeinv_inv_full");
      return false;
    }

    try {
      viewerInv.addItem(item);
      container.setItem(contIndex, undefined);
      toastSuccess(viewer, "Item taken.", "seeinv_grab_ok");
      return true;
    } catch (e) {
      toastError(viewer, "Failed to transfer item.", "seeinv_grab_fail");
      return false;
    }
  }

  if (action === 1) {
    if (!viewerInv || viewerInv.emptySlotsCount <= 0) {
      toastError(viewer, "Your inventory is full.", "seeinv_dup_full");
      return false;
    }

    try {
      viewerInv.addItem(item.clone());
      toastSuccess(viewer, "Item duplicated.", "seeinv_dup_ok");
      return true;
    } catch (e) {
      toastError(viewer, "Failed to duplicate item.", "seeinv_dup_fail");
      return false;
    }
  }

  if (action === 2) {
    container.setItem(contIndex, undefined);
    toastInfo(viewer, "Item deleted.", "seeinv_deleted");
    return true;
  }

  return false;
}

export async function seeEnderChest(viewer, target) {
  while (true) {
    const container = getEnderChestContainer(target);
    if (!container) {
      toastError(viewer, "Could not access ender chest.", "seeechest_no_access");
      return false;
    }

    const itemEntries = [];

    for (let i = 0; i < Math.min(container.size, 27); i++) {
      const item = container.getItem(i);
      if (!item) continue;

      itemEntries.push({
        slot: i,
        label: formatItemButtonLabel(item, i + 1),
      });
    }

    let page = 0;

    while (true) {
      const paged = getPagedEntries(itemEntries, page);
      page = paged.page;

      const entries = [...paged.visible];
      if (paged.totalPages > 1 && page > 0) entries.push({ slot: "PREV", label: "§ePrevious Page" });
      if (paged.totalPages > 1 && page < paged.totalPages - 1) entries.push({ slot: "NEXT", label: "§eNext Page" });
      entries.push({ slot: "CLEAR_ALL", label: "§cClear All" });
      entries.push({ slot: "BACK", label: "§7Back" });

      const pageLine = paged.totalPages > 1 ? `\n§7Page: §f${page + 1}/${paged.totalPages}` : "";
      const form = new ActionFormData()
        .title(`bd.action:${target.name} Ender Chest`)
        .body(buildSlotPickerBody({
          playerName: target.name,
          sectionName: "Ender Chest",
          itemCount: itemEntries.length,
          emptyText: itemEntries.length === 0 ? "Ender chest is empty." : undefined,
          accentColor: "§5",
        }) + pageLine);

      entries.forEach((e) => form.button(e.label));

      const resp = await form.show(viewer);
      if (!resp || resp.canceled) return false;

      const choice = entries[resp.selection];
      if (!choice) continue;

      if (choice.slot === "PREV") {
        page--;
        continue;
      }
      if (choice.slot === "NEXT") {
        page++;
        continue;
      }

      if (choice.slot === "BACK") return false;

      if (choice.slot === "CLEAR_ALL") {
        const confirm = await new ActionFormData()
          .title("bd.action:Clear Ender Chest?")
          .body("§7Remove every item from this ender chest?\n\n§cThis cannot be undone.")
          .button("§cClear All")
          .button("§7Cancel")
          .show(viewer);

        if (!confirm || confirm.canceled || confirm.selection !== 0) continue;

        for (let i = 0; i < Math.min(container.size, 27); i++) {
          container.setItem(i, undefined);
        }

        toastInfo(viewer, "Ender chest cleared.", "seeechest_cleared_all");
        break;
      }

      const contIndex = choice.slot;
      const item = container.getItem(contIndex);

      if (!item) {
        toastError(viewer, "That slot is empty.", "seeechest_empty_slot");
        break;
      }

      const action = await showItemActionMenu(viewer, item, contIndex + 1);
      if (action === null) continue;

      applyItemAction(viewer, container, contIndex, item, action);
      break;
    }
  }
}

export async function seeInv(viewer, target) {
  while (true) {
    const container = target.getComponent("inventory")?.container
      || target.getComponent("minecraft:inventory")?.container;

    if (!container) {
      toastError(viewer, "Could not access inventory.", "seeinv_no_access");
      return false;
    }

    const sectionForm = new ActionFormData()
      .title(`bd.action:${target.name} Inventory`)
      .body(`§7Choose which inventory section to inspect.\n\n§8Player: §f${target.name}`)
      .button("§2Container")
      .button("§eHotbar")
      .button("§7Cancel");

    const sec = await sectionForm.show(viewer);
    if (!sec || sec.canceled || sec.selection === 2) return false;

    const hotbar = sec.selection === 1;
    const sectionName = hotbar ? "Hotbar" : "Container";

    const itemEntries = [];
    const start = hotbar ? 0 : 9;
    const end = hotbar
      ? Math.min(container.size, 9)
      : Math.min(container.size, 36);

    for (let i = start; i < end; i++) {
      const item = container.getItem(i);
      if (!item) continue;

      const displayIndex = hotbar ? i + 1 : i - 8;

      itemEntries.push({
        slot: i,
        label: formatItemButtonLabel(item, displayIndex),
      });
    }

    if (itemEntries.length === 0) {
      toastInfo(viewer, `No items in ${sectionName.toLowerCase()}.`, "seeinv_empty_section");
      continue;
    }

    let page = 0;
    while (true) {
      const paged = getPagedEntries(itemEntries, page);
      page = paged.page;

      const entries = [...paged.visible];
      if (paged.totalPages > 1 && page > 0) entries.push({ slot: "PREV", label: "§ePrevious Page" });
      if (paged.totalPages > 1 && page < paged.totalPages - 1) entries.push({ slot: "NEXT", label: "§eNext Page" });
      entries.push({ slot: "BACK", label: "§7Back" });

      const pageLine = paged.totalPages > 1 ? `\n§7Page: §f${page + 1}/${paged.totalPages}` : "";
      const form = new ActionFormData()
        .title(`bd.action:${target.name} ${sectionName}`)
        .body(buildSlotPickerBody({
          playerName: target.name,
          sectionName,
          itemCount: itemEntries.length,
          accentColor: hotbar ? "§e" : "§2",
        }) + pageLine);

      entries.forEach((e) => form.button(e.label));

      const resp = await form.show(viewer);
      if (!resp || resp.canceled) return false;

      const choice = entries[resp.selection];
      if (!choice) continue;
      if (choice.slot === "PREV") {
        page--;
        continue;
      }
      if (choice.slot === "NEXT") {
        page++;
        continue;
      }
      if (choice.slot === "BACK") break;

      const contIndex = choice.slot;
      const item = container.getItem(contIndex);

      if (!item) {
        toastError(viewer, "That slot is empty.", "seeinv_empty_slot");
        break;
      }

      const displaySlot = hotbar ? contIndex + 1 : contIndex - 8;
      const action = await showItemActionMenu(viewer, item, displaySlot);
      if (action === null) continue;

      applyItemAction(viewer, container, contIndex, item, action);
      break;
    }
  }
}
