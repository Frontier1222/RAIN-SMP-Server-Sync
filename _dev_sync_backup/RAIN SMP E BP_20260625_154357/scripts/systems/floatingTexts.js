import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { toastError, toastSuccess } from "../utils/realmPerf.js";

const WORLD_KEY = "bd_floating_texts";

function isStaff(player) {
  return (
    player.hasTag("staff") ||
    player.hasTag("rank:owner") ||
    player.hasTag("rank:admin") ||
    player.hasTag("rank:mod")
  );
}

function dimIdToShort(id) {
  if (id === "minecraft:overworld") return "overworld";
  if (id === "minecraft:nether") return "nether";
  if (id === "minecraft:the_end") return "the_end";
  return "overworld";
}

function dimShortToId(shortId) {
  if (shortId === "overworld") return "minecraft:overworld";
  if (shortId === "nether") return "minecraft:nether";
  if (shortId === "the_end") return "minecraft:the_end";
  return "minecraft:overworld";
}

function getDimensionById(dimId) {
  return world.getDimension(dimIdToShort(dimId));
}

function newId() {
  return `ft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTextInput(s) {
  return (s ?? "").toString().replace(/\\n/g, "\n");
}

function formatTextForInput(s) {
  return (s ?? "").toString().replace(/\n/g, "\\n");
}

function parseTags(raw) {
  const s = (raw ?? "").toString().trim();
  if (!s) return [];

  const parts = s.split(",").map((p) => p.trim()).filter((p) => p.length > 0);
  const unique = [];
  const seen = new Set();
  for (const t of parts) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  return unique;
}

function loadAll() {
  const raw = world.getDynamicProperty(WORLD_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(entries) {
  world.setDynamicProperty(WORLD_KEY, JSON.stringify(entries));
}

function findEntityFor(entry) {
  const dim = getDimensionById(entry.dim);
  const idTag = `bd_ft_id:${entry.id}`;

  for (const ent of dim.getEntities({ type: "bd:floating_text" })) {
    if (ent.hasTag(idTag)) return ent;
  }

  return null;
}

function ensureSpawned(entry) {
  const dim = getDimensionById(entry.dim);
  const idTag = `bd_ft_id:${entry.id}`;

  try {
    let ent = findEntityFor(entry);

    if (!entry.enabled) {
      if (ent) ent.remove();
      return;
    }

    if (!ent) {
      ent = dim.spawnEntity("bd:floating_text", { x: entry.x, y: entry.y, z: entry.z });
      ent.addTag("bd_ft");
      ent.addTag(idTag);
    }

    ent.teleport({ x: entry.x, y: entry.y, z: entry.z }, { dimension: dim });
    ent.nameTag = entry.text;
  } catch (error) {
    // Silently ignore chunks that are asleep
  }
}

function cleanupOrphans(entries) {
  const ids = new Set(entries.map((e) => e.id));

  for (const dimShort of ["overworld", "nether", "the_end"]) {
    const dim = world.getDimension(dimShort);
    for (const ent of dim.getEntities({ type: "bd:floating_text" })) {
      if (!ent.hasTag("bd_ft")) continue;

      let found = false;
      for (const tag of ent.getTags()) {
        if (!tag.startsWith("bd_ft_id:")) continue;
        const id = tag.slice("bd_ft_id:".length);
        if (!ids.has(id)) {
          ent.remove();
        }
        found = true;
        break;
      }

      if (!found) ent.remove();
    }
  }
}

export function resyncFloatingTexts() {
  const entries = loadAll();
  for (const e of entries) ensureSpawned(e);
  cleanupOrphans(entries);
}

export function initFloatingTexts() {
  system.runTimeout(() => resyncFloatingTexts(), 40);
}

function entryDisplayName(entry) {
  const label = (entry.label || "").trim();
  const firstLine = (entry.text || "").split("\n")[0] || "";
  const head = label || firstLine || "(empty)";
  const tags = (entry.tags || []).length ? ` §7[${entry.tags.join(", ")}]§r` : "";
  return `${head}${tags}`;
}

async function showListUi(player) {
  const entries = loadAll();

  const form = new ActionFormData().title("bd.action:Floating Texts");
  if (entries.length === 0) form.body("No floating texts yet.");

  for (const e of entries) {
    form.button(entryDisplayName(e));
  }

  form.button("§a+ Create at my position§r");
  form.button("§bResync (fix missing entities)§r");

  const res = await form.show(player);
  if (res.canceled) return;

  const createIdx = entries.length;
  const resyncIdx = entries.length + 1;

  if (res.selection === createIdx) {
    await createAtPlayer(player);
    return;
  }

  if (res.selection === resyncIdx) {
    resyncFloatingTexts();
    toastSuccess(player, "§aFloating texts resynced.", "ft_resync");
    return;
  }

  const chosen = entries[res.selection];
  if (!chosen) return;

  await showManageUi(player, chosen.id);
}

async function createAtPlayer(player) {
  const dimOptions = ["Overworld", "Nether", "The End"];
  const dimValues = ["overworld", "nether", "the_end"];
  const currentShort = dimIdToShort(player.dimension.id);
  const dimDefault = Math.max(0, dimValues.indexOf(currentShort));

  const form = new ModalFormData()
    .title("bd.modal:Create Floating Text")
    .textField("Label (optional)", "spawn, rules, ...", { defaultValue: "" })
    .textField("Text (use \\n for new line)", "Line1\\nLine2", { defaultValue: "" })
    .dropdown("Dimension", dimOptions, { defaultValueIndex: dimDefault })
    .textField("X", "", { defaultValue: (Math.floor(player.location.x * 100) / 100).toString() })
    .textField("Y", "", { defaultValue: (Math.floor(player.location.y * 100) / 100).toString() })
    .textField("Z", "", { defaultValue: (Math.floor(player.location.z * 100) / 100).toString() });

  const res = await form.show(player);
  if (res.canceled) return;

  const [labelRaw, textRaw, dimIdx, xRaw, yRaw, zRaw] = res.formValues;
  const text = normalizeTextInput(textRaw).trim();
  if (!text) {
    toastError(player, "§cText cannot be empty.", "ft_empty_text");
    return;
  }

  const x = Number(xRaw);
  const y = Number(yRaw);
  const z = Number(zRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    toastError(player, "§cInvalid coordinates.", "ft_invalid_coords");
    return;
  }

  const entries = loadAll();
  const entry = {
    id: newId(),
    label: (labelRaw ?? "").toString().trim(),
    text,
    dim: dimShortToId(dimValues[dimIdx] ?? "overworld"),
    x,
    y,
    z,
    tags: [],
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  entries.push(entry);
  saveAll(entries);
  ensureSpawned(entry);

  toastSuccess(player, "§aFloating text created.", "ft_created");
}

async function showManageUi(player, id) {
  const entries = loadAll();
  const entry = entries.find((e) => e.id === id);
  if (!entry) {
    toastError(player, "§cFloating text not found.", "ft_not_found");
    return;
  }

  const form = new ActionFormData()
    .title("bd.action:Floating Text")
    .body(
      `ID: §7${entry.id}§r\n` +
        `Dim: §7${entry.dim}§r\n` +
        `Pos: §7${entry.x.toFixed(2)}, ${entry.y.toFixed(2)}, ${entry.z.toFixed(2)}§r\n` +
        `Enabled: §7${entry.enabled ? "Yes" : "No"}§r\n` +
        `Tags: §7${(entry.tags || []).join(", ") || "(none)"}§r`
    )
    .button("Edit Text / Position")
    .button("Settings (tags)")
    .button("Move to me")
    .button("Teleport to text")
    .button("Delete");

  const res = await form.show(player);
  if (res.canceled) return;

  if (res.selection === 0) {
    await editEntryUi(player, entry.id);
    return;
  }

  if (res.selection === 1) {
    await settingsEntryUi(player, entry.id);
    return;
  }

  if (res.selection === 2) {
    const next = { ...entry };
    next.dim = player.dimension.id;
    next.x = Math.floor(player.location.x * 100) / 100;
    next.y = Math.floor(player.location.y * 100) / 100;
    next.z = Math.floor(player.location.z * 100) / 100;
    next.updatedAt = Date.now();

    const idx = entries.findIndex((e) => e.id === entry.id);
    entries[idx] = next;
    saveAll(entries);
    ensureSpawned(next);

    toastSuccess(player, "§aMoved floating text to your position.", "ft_moved");
    return;
  }

  if (res.selection === 3) {
    const dim = getDimensionById(entry.dim);
    player.teleport({ x: entry.x, y: entry.y, z: entry.z }, { dimension: dim });
    return;
  }

  if (res.selection === 4) {
    const confirm = new ActionFormData()
      .title("bd.action:Confirm Delete")
      .body(`Delete:\n§e${entryDisplayName(entry)}§r`)
      .button("§cDelete")
      .button("Cancel");

    const r2 = await confirm.show(player);
    if (r2.canceled || r2.selection !== 0) return;

    const idx = entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) entries.splice(idx, 1);
    saveAll(entries);

    const ent = findEntityFor(entry);
    if (ent) ent.remove();

    toastSuccess(player, "§aFloating text deleted.", "ft_deleted");
  }
}

async function editEntryUi(player, id) {
  const entries = loadAll();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;

  const dimOptions = ["Overworld", "Nether", "The End"];
  const dimValues = ["overworld", "nether", "the_end"];
  const dimDefault = Math.max(0, dimValues.indexOf(dimIdToShort(entry.dim)));

  const form = new ModalFormData()
    .title("bd.modal:Edit Floating Text")
    .textField("Label (optional)", "", { defaultValue: entry.label || "" })
    .textField("Text (use \\n for new line)", "Line1\\nLine2", { defaultValue: formatTextForInput(entry.text) })
    .dropdown("Dimension", dimOptions, { defaultValueIndex: dimDefault })
    .textField("X", "", { defaultValue: entry.x.toString() })
    .textField("Y", "", { defaultValue: entry.y.toString() })
    .textField("Z", "", { defaultValue: entry.z.toString() });

  const res = await form.show(player);
  if (res.canceled) return;

  const [labelRaw, textRaw, dimIdx, xRaw, yRaw, zRaw] = res.formValues;
  const text = normalizeTextInput(textRaw).trim();
  if (!text) {
    toastError(player, "§cText cannot be empty.", "ft_empty_text");
    return;
  }

  const x = Number(xRaw);
  const y = Number(yRaw);
  const z = Number(zRaw);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    toastError(player, "§cInvalid coordinates.", "ft_invalid_coords");
    return;
  }

  const next = { ...entry };
  next.label = (labelRaw ?? "").toString().trim();
  next.text = text;
  next.dim = dimShortToId(dimValues[dimIdx] ?? "overworld");
  next.x = x;
  next.y = y;
  next.z = z;
  next.updatedAt = Date.now();

  const idx = entries.findIndex((e) => e.id === entry.id);
  entries[idx] = next;
  saveAll(entries);
  ensureSpawned(next);

  toastSuccess(player, "§aFloating text updated.", "ft_updated");
}

async function settingsEntryUi(player, id) {
  const entries = loadAll();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;

  const form = new ModalFormData()
    .title("bd.modal:Floating Text Settings")
    .toggle("Enabled", { defaultValue: entry.enabled !== false })
    .textField("Tags (comma separated)", "spawn, rules", { defaultValue: (entry.tags || []).join(", ") });

  const res = await form.show(player);
  if (res.canceled) return;

  const [enabled, tagsRaw] = res.formValues;
  const next = { ...entry };
  next.enabled = !!enabled;
  next.tags = parseTags(tagsRaw);
  next.updatedAt = Date.now();

  const idx = entries.findIndex((e) => e.id === entry.id);
  entries[idx] = next;
  saveAll(entries);
  ensureSpawned(next);

  toastSuccess(player, "§aSettings saved.", "ft_settings_saved");
}

export async function openFloatingTextsUi(player) {
  if (!isStaff(player)) {
    toastError(player, "§cYou don't have permission to manage floating texts.", "ft_no_perm");
    return;
  }

  await showListUi(player);
}