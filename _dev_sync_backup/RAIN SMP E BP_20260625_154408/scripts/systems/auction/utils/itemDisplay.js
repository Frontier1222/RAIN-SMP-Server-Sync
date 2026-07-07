import { ItemStack, ItemComponentTypes, EnchantmentTypes, SignSide, system, world } from "@minecraft/server";
import { isSignBlock } from "../../../utils/blockTypes.js";

const MC = "\u00A7";

/** True when text still uses & or # aliases that should become §. */
export function needsAliasColorNormalization(text) {
  return /(?:&|#)[0-9a-fk-or]/i.test(String(text ?? ""));
}

/** @deprecated Use needsAliasColorNormalization — §-only text must not trigger rewrites. */
export function needsMcColorNormalization(text) {
  return needsAliasColorNormalization(text);
}

/** Normalize color codes to § (section) — primary Bedrock format. Also fixes & aliases and # from broken sign UI. */
export function parseMcColorCodes(text) {
  if (text == null || text === "") return text;

  let s = String(text);
  s = s.replace(/\u00A7/g, MC);
  // Sign editor often saves § as # — restore section codes only when followed by a valid code char.
  s = s.replace(/#([0-9a-fk-or])/gi, (_, code) => MC + code.toLowerCase());
  s = s.replace(/&([0-9a-fk-or])/gi, (_, code) => MC + code.toLowerCase());
  return s;
}

export function formatListingLine(listing) {
  return {
    rawtext: [
      {
        translate: itemName(listing.sell)
      },
      {
        text: `\n§7Trade for: §fx${listing.want.amount} `
      },
      {
        translate: `${itemName(listing.want)}`
      }
    ]
  };
}

export function itemName(data) {
  if (data.nameTag) return data.nameTag;
  if (data.localizationKey) return data.localizationKey;
  return data.typeId.split(":")[1].replace(/_/g, " ");
}

/** Update item rename color codes in-place without touching lore/NBT. */
export function applyNameTagColorNormalization(stack) {
  if (!stack?.nameTag || !needsAliasColorNormalization(stack.nameTag)) return false;

  const parsed = parseMcColorCodes(stack.nameTag);
  if (parsed === stack.nameTag) return false;

  stack.nameTag = parsed;
  return true;
}

/** Update name/lore color codes when building auction items from saved data. */
export function applyColorNormalizationToStack(stack) {
  if (!stack) return false;

  let changed = applyNameTagColorNormalization(stack);

  try {
    const lore = stack.getLore?.() ?? [];
    if (lore.length) {
      const parsedLore = lore.map((line) => {
        const raw = String(line);
        return needsAliasColorNormalization(raw) ? parseMcColorCodes(raw) : raw;
      });
      const same =
        parsedLore.length === lore.length &&
        parsedLore.every((line, index) => line === lore[index]);

      if (!same) {
        stack.setLore(parsedLore);
        changed = true;
      }
    }
  } catch (e) {}

  return changed;
}

export function buildItemStackFromItemData(data) {
  const stack = new ItemStack(data.typeId, data.amount || 1);

  if (data.nameTag) {
    stack.nameTag = parseMcColorCodes(data.nameTag);
  }

  if (Array.isArray(data.lore) && data.lore.length > 0) {
    try {
      stack.setLore(
        data.lore
          .map(line => parseMcColorCodes(String(line)))
          .slice(0, 20)
      );
    } catch (e) {
      console.warn("Failed to apply item lore: " + e);
    }
  }

  const ench = stack.getComponent(ItemComponentTypes.Enchantable);

  if (ench && Array.isArray(data.enchantments)) {
    for (const e of data.enchantments) {
      try {
        const type = EnchantmentTypes.get(e.id);

        if (type) {
          ench.addEnchantment({
            type,
            level: e.level
          });
        }
      } catch (err) {
        console.warn(`Failed to apply enchantment ${e.id}: ${err}`);
      }
    }
  }

  const dur = stack.getComponent(ItemComponentTypes.Durability);

  if (dur && data.durability) {
    try {
      dur.damage = data.durability.damage || 0;
    } catch (e) {
      console.warn("Failed to apply durability: " + e);
    }
  }

  if (
    data.book &&
    (
      data.typeId === "minecraft:writable_book" ||
      data.typeId === "minecraft:written_book"
    )
  ) {
    try {
      const bookComp = stack.getComponent(ItemComponentTypes.Book);

      if (bookComp) {
        const pages = Array.isArray(data.book.pages)
          ? data.book.pages.slice(0, 50)
          : [];

        if (pages.length > 0) {
          bookComp.setContents(
            pages.map(page => String(page).slice(0, 256))
          );
        }

        if (data.book.signed === true || data.typeId === "minecraft:written_book") {
          const title = String(data.book.title || data.nameTag || "Book").slice(0, 16);
          const author = String(data.book.author || "Rain SMP").slice(0, 16);

          bookComp.signBook(title, author);
        }
      }
    } catch (e) {
      console.warn("Failed to apply book data: " + e);
    }
  }

  return stack;
}

function fixSignBlockColorCodes(block) {
    if (!block?.isValid || !isSignBlock(block.typeId)) return;

    const sign = block.getComponent("minecraft:sign");
    if (!sign) return;

    for (const side of [SignSide.Front, SignSide.Back]) {
        let text;
        try {
            text = sign.getText(side);
        } catch (e) {
            try {
                text = sign.getText();
            } catch (err) {
                continue;
            }
        }

        if (text == null || text === "") continue;
        const raw = String(text);
        if (!needsAliasColorNormalization(raw)) continue;

        const parsed = parseMcColorCodes(raw);
        if (parsed === raw) continue;

        try {
            sign.setText(parsed, side);
        } catch (e) {
            try {
                sign.setText(parsed);
            } catch (err) {}
        }
    }
}

/** Re-apply § color codes after sign edits (UI may store & / # instead of section). */
export function startSignColorCodeFixRuntime() {
    if (world.afterEvents?.playerPlaceBlock) {
        world.afterEvents.playerPlaceBlock.subscribe((event) => {
            if (!isSignBlock(event.block?.typeId)) return;
            system.runTimeout(() => {
                try {
                    if (event.block?.isValid) fixSignBlockColorCodes(event.block);
                } catch (e) {}
            }, 2);
        });
    }
}

/** Disabled — use startTinkersAnvilRenameRuntime instead (inventory setItem breaks anvil UI). */
export function startAnvilColorCodeFixRuntime() {}

export function buildItemDataFromItemStack(item, amountOverride) {
  const book = (() => {
    try {
      const bookComp = item.getComponent(ItemComponentTypes.Book);

      if (!bookComp) return null;

      const pages = [];
      const pageCount = Math.min(bookComp.pageCount ?? 0, 50);

      for (let i = 0; i < pageCount; i++) {
        const page = bookComp.getPageContent(i);

        if (page !== undefined) {
          pages.push(String(page));
        }
      }

      return {
        signed: item.typeId === "minecraft:written_book",
        title: bookComp.title ?? item.nameTag ?? "",
        author: bookComp.author ?? "",
        pages
      };
    } catch (e) {
      return null;
    }
  })();

  return {
    typeId: item.typeId,
    amount: amountOverride ?? item.amount,
    nameTag: item.nameTag ?? "",
    lore: item.getLore?.() ?? [],
    localizationKey: item.localizationKey ?? "",

    enchantments: item.getComponent(ItemComponentTypes.Enchantable)
      ?.getEnchantments()
      ?.map(e => ({
        id: e.type.id,
        level: e.level
      })) ?? [],

    durability: (() => {
      const d = item.getComponent(ItemComponentTypes.Durability);

      return d
        ? {
            maxDurability: d.maxDurability,
            damage: d.damage
          }
        : null;
    })(),

    book
  };
}