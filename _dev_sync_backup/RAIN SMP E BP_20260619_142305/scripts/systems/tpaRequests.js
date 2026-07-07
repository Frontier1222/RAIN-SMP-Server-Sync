import { system, world } from '@minecraft/server';
import { getTeleportCooldownRemainingSeconds, startTeleportCooldown } from '../utils/teleport.js';
import { isPlayerInPrison, PRISON_TPA_MESSAGE } from '../utils/prison.js';
import { toastError, toastInfo, getRealmPlayerById } from '../utils/realmPerf.js';

export const TPA_EXPIRY_MS = 60 * 1000;

const timeoutByTargetId = new Map();

function readRequests() {
  const raw = world.getDynamicProperty('tpa_requests');
  return JSON.parse(raw || '{}');
}

function writeRequests(requests) {
  world.setDynamicProperty('tpa_requests', JSON.stringify(requests));
}

function normalizeEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return { requesterId: entry, createdAt: Date.now() };
  return {
    requesterId: entry.requesterId ?? entry,
    createdAt: entry.createdAt ?? 0,
  };
}

function clearTimeoutForTargetId(targetId) {
  const handle = timeoutByTargetId.get(targetId);
  if (handle !== undefined) system.clearRun(handle);
  timeoutByTargetId.delete(targetId);
}

function scheduleExpiryForTargetId(targetId, entry) {
  clearTimeoutForTargetId(targetId);

  const createdAt = entry.createdAt ?? 0;
  if (!createdAt) return;

  const msLeft = TPA_EXPIRY_MS - (Date.now() - createdAt);
  if (msLeft <= 0) {
    expireTpaRequest(targetId);
    return;
  }

  const ticks = Math.max(1, Math.ceil(msLeft / 50));
  const handle = system.runTimeout(() => expireTpaRequest(targetId), ticks);
  timeoutByTargetId.set(targetId, handle);
}

export function createTpaRequest(requester, target) {
  if (isPlayerInPrison(target)) {
    toastError(requester, PRISON_TPA_MESSAGE, 'tpa_prison_target');
    return false;
  }

  if (isPlayerInPrison(requester)) {
    toastError(requester, 'You cannot send TPA requests while in prison.', 'tpa_prison_self');
    return false;
  }

  const requests = readRequests();
  const entry = { requesterId: requester.id, createdAt: Date.now() };

  requests[target.id] = entry;
  writeRequests(requests);
  scheduleExpiryForTargetId(target.id, entry);
  return true;
}

export function getTpaRequestForTargetId(targetId) {
  const requests = readRequests();
  const entry = normalizeEntry(requests[targetId]);
  if (!entry) return null;

  if (typeof requests[targetId] === 'string') {
    requests[targetId] = entry;
    writeRequests(requests);
  }

  return entry;
}

export function clearTpaRequestForTargetId(targetId) {
  clearTimeoutForTargetId(targetId);
  const requests = readRequests();
  if (!requests[targetId]) return;
  delete requests[targetId];
  writeRequests(requests);
}

export function expireTpaRequest(targetId) {
  clearTimeoutForTargetId(targetId);

  const requests = readRequests();
  const entry = normalizeEntry(requests[targetId]);
  if (!entry) return;

  delete requests[targetId];
  writeRequests(requests);

  const requester = getRealmPlayerById(entry.requesterId);
  const target = getRealmPlayerById(targetId);

  if (requester && target) {
    toastError(requester, `Your TPA request to ${target.name} expired.`, 'tpa_expired_requester');
    toastError(target, `TPA request from ${requester.name} expired.`, 'tpa_expired_target');
  } else if (requester && !target) {
    toastError(requester, 'Your TPA request expired.', 'tpa_expired_requester');
  }
}

export function startTpaExpiryRuntime() {
  const requests = readRequests();
  const now = Date.now();
  let changed = false;

  for (const [targetId, rawEntry] of Object.entries(requests)) {
    const entry = normalizeEntry(rawEntry);
    if (!entry) continue;

    if (typeof rawEntry === 'string') {
      requests[targetId] = entry;
      changed = true;
    }

    if (!entry.createdAt || now - entry.createdAt > TPA_EXPIRY_MS) {
      delete requests[targetId];
      changed = true;
      continue;
    }

    scheduleExpiryForTargetId(targetId, entry);
  }

  if (changed) writeRequests(requests);
}

function getOnlineRequester(entry) {
  if (!entry) return null;
  return getRealmPlayerById(entry.requesterId);
}

export function acceptTpaRequest(target) {
  if (isPlayerInPrison(target)) {
    toastError(target, PRISON_TPA_MESSAGE, 'tpa_prison_target');
    return false;
  }

  const entry = getTpaRequestForTargetId(target.id);
  if (!entry) {
    toastError(target, 'No pending TPA request.', 'tpa_none');
    return false;
  }

  if (entry.createdAt && Date.now() - entry.createdAt > TPA_EXPIRY_MS) {
    expireTpaRequest(target.id);
    toastError(target, 'TPA request expired.', 'tpa_expired');
    return false;
  }

  const requester = getOnlineRequester(entry);
  if (!requester) {
    toastError(target, 'Requester is no longer online.', 'tpa_offline');
    clearTpaRequestForTargetId(target.id);
    return false;
  }

  if (isPlayerInPrison(requester)) {
    toastError(target, 'That player is in prison — TPA rejected.', 'tpa_prison_reject');
    toastError(requester, 'Your TPA was rejected — you are in prison.', 'tpa_prison_reject');
    return false;
  }

  const cd = getTeleportCooldownRemainingSeconds(requester);
  if (cd > 0) {
    toastError(requester, `Teleport cooldown: ${cd}s`, 'tpa_cooldown');
    toastError(target, `${requester.name} is on teleport cooldown (${cd}s).`, 'tpa_cooldown_target');
    return false;
  }

  startTeleportCooldown(requester);
  requester.teleport(target.location, { dimension: target.dimension });
  toastInfo(requester, `Teleported to ${target.name}`, 'tpa_accept');
  toastInfo(target, `Accepted TPA from ${requester.name}`, 'tpa_accept_target');
  clearTpaRequestForTargetId(target.id);
  return true;
}

export function rejectTpaRequest(target) {
  const entry = getTpaRequestForTargetId(target.id);
  if (!entry) {
    toastError(target, 'No pending TPA request.', 'tpa_none');
    return false;
  }

  if (entry.createdAt && Date.now() - entry.createdAt > TPA_EXPIRY_MS) {
    expireTpaRequest(target.id);
    toastError(target, 'TPA request expired.', 'tpa_expired');
    return false;
  }

  const requester = getOnlineRequester(entry);
  if (requester) {
    toastError(requester, `${target.name} rejected your TPA request.`, 'tpa_rejected');
  }

  toastInfo(target, requester ? `Rejected TPA from ${requester.name}` : 'Rejected pending TPA request.', 'tpa_reject');
  clearTpaRequestForTargetId(target.id);
  return true;
}