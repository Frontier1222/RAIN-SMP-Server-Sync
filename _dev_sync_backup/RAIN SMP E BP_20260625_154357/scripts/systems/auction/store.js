import { world } from "@minecraft/server";

const DP_KEY = "bd.auction_house_barter";
const DP_META_KEY = `${DP_KEY}.meta`;
const DP_CHUNK_PREFIX = `${DP_KEY}.chunk`;

const MAX_DP_STRING_BYTES = 32767;

const DEFAULT_STATE = {
  listings: [],
  claims: {}, 
};

let CACHED_STATE = DEFAULT_STATE;
let READY = false;

function safeParseJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function utf8ByteLength(str) {
  const s = String(str ?? "");
  let bytes = 0;

  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    if (cp === undefined) break;

    if (cp <= 0x7f) bytes += 1;
    else if (cp <= 0x7ff) bytes += 2;
    else if (cp <= 0xffff) bytes += 3;
    else bytes += 4;

    if (cp > 0xffff) i += 1;
  }

  return bytes;
}

function splitIntoDpChunks(text, maxBytes) {
  const src = String(text ?? "");
  const limit = Math.max(1, Math.floor(Number(maxBytes) || MAX_DP_STRING_BYTES));

  const out = [];
  let start = 0;

  while (start < src.length) {
    let end = start;
    let bytes = 0;

    while (end < src.length) {
      const cp = src.codePointAt(end);
      if (cp === undefined) break;

      const inc = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
      if (bytes + inc > limit) break;
      bytes += inc;

      end += cp > 0xffff ? 2 : 1;
    }

    if (end <= start) end = Math.min(src.length, start + 1);

    out.push(src.slice(start, end));
    start = end;
  }

  return out;
}

function clearChunkedStorage(fromIndex = 0, count = 0) {
  const n = Math.max(0, Math.trunc(Number(count)));
  for (let i = Math.max(0, Math.trunc(Number(fromIndex))); i < n; i++) {
    world.setDynamicProperty(`${DP_CHUNK_PREFIX}${i}`, undefined);
  }
}

function normalizeAuctionItem(raw) {
  const item = raw && typeof raw === "object" ? raw : null;
  if (!item) return null;

  const typeId = String(item?.typeId ?? "").trim();
  if (!typeId) return null;

  const amountRaw = Math.floor(Number(item?.amount ?? 1));
  const amount = Number.isFinite(amountRaw) ? Math.max(1, Math.min(64, amountRaw)) : 1;

  return { ...item, typeId, amount };
}

function normalizeListing(raw) {
  const id = String(raw?.id ?? "").trim();
  if (!id) return null;

  const sellerName = String(raw?.sellerName ?? "").trim();
  if (!sellerName) return null;

  const createdAt = Math.max(0, Math.trunc(Number(raw?.createdAt ?? 0)));

  const sell = normalizeAuctionItem(raw?.sell);
  if (!sell) return null;

  const want = normalizeAuctionItem(raw?.want);
  if (!want) return null;

  return { id, sellerName, createdAt, sell, want };
}

function normalizeState(raw) {
  const out = { listings: [], claims: {} };

  const listings = Array.isArray(raw?.listings) ? raw.listings : [];
  for (const l of listings) {
    const norm = normalizeListing(l);
    if (norm) out.listings.push(norm);
  }

  const claims = raw?.claims && typeof raw.claims === "object" ? raw.claims : {};
  for (const [k, v] of Object.entries(claims)) {
    const name = String(k ?? "").trim();
    if (!name) continue;

    const arr = Array.isArray(v) ? v : [];
    const items = [];
    for (const it of arr) {
      const norm = normalizeAuctionItem(it);
      if (norm) items.push(norm);
    }
    if (items.length) out.claims[name] = items.slice(-100);
  }

  return out;
}

function loadFromWorld() {
  const metaRaw = world.getDynamicProperty(DP_META_KEY);
  const meta = safeParseJson(metaRaw);

  let parsed = null;

  const chunks = Number(meta?.chunks ?? 0);
  if (Number.isFinite(chunks) && chunks > 0) {
    let text = "";
    for (let i = 0; i < chunks; i++) {
      const part = world.getDynamicProperty(`${DP_CHUNK_PREFIX}${i}`);
      if (!part || typeof part !== "string") {
        text = "";
        break;
      }
      text += part;
    }
    parsed = safeParseJson(text);
  } else {
    const raw = world.getDynamicProperty(DP_KEY);
    parsed = safeParseJson(raw);
  }

  if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
  return normalizeState(parsed);
}

function saveToWorld(state) {
  const oldMetaRaw = world.getDynamicProperty(DP_META_KEY);
  const oldMeta = safeParseJson(oldMetaRaw);
  const oldChunks = Math.max(0, Math.trunc(Number(oldMeta?.chunks ?? 0)));

  const normalized = normalizeState(state);
  const text = JSON.stringify(normalized);

  if (utf8ByteLength(text) <= MAX_DP_STRING_BYTES) {
    world.setDynamicProperty(DP_KEY, text);
    world.setDynamicProperty(DP_META_KEY, undefined);
    if (oldChunks > 0) clearChunkedStorage(0, oldChunks);
    CACHED_STATE = normalized;
    return normalized;
  }

  const parts = splitIntoDpChunks(text, MAX_DP_STRING_BYTES);
  const chunks = parts.length;
  const metaText = JSON.stringify({ v: 1, chunks });

  if (utf8ByteLength(metaText) > MAX_DP_STRING_BYTES) {
    CACHED_STATE = normalized;
    return normalized;
  }

  world.setDynamicProperty(DP_META_KEY, metaText);
  world.setDynamicProperty(DP_KEY, "");

  for (let i = 0; i < chunks; i++) {
    world.setDynamicProperty(`${DP_CHUNK_PREFIX}${i}`, parts[i] ?? "");
  }

  if (oldChunks > chunks) clearChunkedStorage(chunks, oldChunks);

  CACHED_STATE = normalized;
  return normalized;
}

function ensureReady() {
  if (READY) return;
  CACHED_STATE = loadFromWorld();
  READY = true;
}

export function listAuctionListings() {
  ensureReady();
  return [...(CACHED_STATE?.listings ?? [])];
}

export function getAuctionListingById(id) {
  ensureReady();
  const key = String(id ?? "").trim();
  if (!key) return null;
  return (CACHED_STATE?.listings ?? []).find((l) => l.id === key) ?? null;
}

export function addAuctionListing(listing) {
  ensureReady();
  const next = normalizeListing(listing);
  if (!next) return { ok: false, reason: "Invalid listing" };

  const current = listAuctionListings();
  if (current.some((l) => l.id === next.id)) return { ok: false, reason: "Duplicate id" };

  const saved = saveToWorld({ ...CACHED_STATE, listings: [...current, next] });
  return { ok: true, state: saved };
}

export function removeAuctionListing(id) {
  ensureReady();
  const key = String(id ?? "").trim();
  if (!key) return { ok: false, removed: null };

  const listings = [...(CACHED_STATE?.listings ?? [])];
  const idx = listings.findIndex((l) => l.id === key);
  if (idx < 0) return { ok: false, removed: null };

  const removed = listings.splice(idx, 1)[0] ?? null;
  const saved = saveToWorld({ ...CACHED_STATE, listings });
  return { ok: true, removed, state: saved };
}

export function addAuctionClaim(playerName, itemData) {
  ensureReady();
  const key = String(playerName ?? "").trim();
  if (!key) return { ok: false };

  const item = normalizeAuctionItem(itemData);
  if (!item) return { ok: false };

  const claims = { ...(CACHED_STATE?.claims ?? {}) };
  const current = Array.isArray(claims[key]) ? [...claims[key]] : [];
  current.push(item);

  while (current.length > 100) current.shift();

  claims[key] = current;
  const saved = saveToWorld({ ...CACHED_STATE, claims });
  return { ok: true, state: saved };
}

export function peekAuctionClaimCount(playerName) {
  ensureReady();
  const key = String(playerName ?? "").trim();
  if (!key) return 0;
  const current = CACHED_STATE?.claims?.[key];
  return Array.isArray(current) ? current.length : 0;
}

export function claimAuctionClaims(playerName) {
  ensureReady();
  const key = String(playerName ?? "").trim();
  if (!key) return [];

  const current = CACHED_STATE?.claims?.[key];
  const items = Array.isArray(current) ? [...current] : [];
  if (!items.length) return [];

  const claims = { ...(CACHED_STATE?.claims ?? {}) };
  delete claims[key];
  saveToWorld({ ...CACHED_STATE, claims });
  return items;
}