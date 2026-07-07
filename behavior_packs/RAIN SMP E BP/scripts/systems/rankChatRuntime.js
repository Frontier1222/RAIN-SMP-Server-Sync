import { system, world } from "@minecraft/server";
import { formatChatLine, getRankMeta, getFactionTag } from "./ranks.js";

const VANISH_TAG = "bd_vanish";
const recentFormatted = new Map();
const syncedTeamKey = new Map();

let beforeChatListener = null;
let beforeRegistered = false;
let afterRegistered = false;
let retryTicks = 0;

function isVanishedPlayer(player) {
    if (!player) return false;
    const stored = player.getDynamicProperty("bd_vanish");
    return stored === true || stored === 1 || player.hasTag(VANISH_TAG);
}

function runWorldCommand(command) {
    const dims = ["overworld", "nether", "the_end"];
    for (const id of dims) {
        try {
            world.getDimension(id).runCommand(command);
            return true;
        } catch (e) {}
    }
    return false;
}

function escapeCmd(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildTeamPrefix(player) {
    const rank = getRankMeta(player);
    const facTag = getFactionTag(player);
    let prefix = `§8[§r${rank.color}§l${rank.label}§8]§r `;
    if (facTag) prefix += `§8[§r§e${facTag}§8]§r `;
    return prefix;
}

function teamIdFor(player) {
    return `rain_${String(player.id).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 14)}`;
}

export function syncRankChatTeam(player, force = false) {
    if (!player?.id || !player.name) return;

    const hidden = isVanishedPlayer(player);
    const prefix = hidden ? "" : buildTeamPrefix(player);
    const cacheKey = `${player.id}|${hidden ? "hidden" : prefix}`;

    if (!force && syncedTeamKey.get(player.id) === cacheKey) return;
    syncedTeamKey.set(player.id, cacheKey);

    const safeName = escapeCmd(player.name);
    const teamId = teamIdFor(player);

    system.run(() => {
        try {
            if (!player.isValid) return;
        } catch (e) {
            return;
        }

        if (hidden) {
            runWorldCommand(`team leave "${safeName}"`);
            return;
        }

        const safePrefix = escapeCmd(prefix);
        runWorldCommand(`team add "${teamId}"`);
        runWorldCommand(`team modify "${teamId}" prefix "${safePrefix}"`);
        runWorldCommand(`team join "${teamId}" "${safeName}"`);
    });
}

export function deliverFormattedChat(player, message) {
    if (!player || isVanishedPlayer(player)) return;

    const line = formatChatLine(player, message);
    recentFormatted.set(player.id, { message: String(message ?? ""), at: Date.now() });

    try {
        world.sendMessage(line);
    } catch (e) {
        system.run(() => {
            try {
                world.sendMessage(line);
            } catch (e2) {
                for (const viewer of world.getPlayers()) {
                    try { viewer.sendMessage(line); } catch (e3) {}
                }
            }
        });
    }

    syncRankChatTeam(player, true);
}

function onAfterChat(ev) {
    const player = ev.sender;
    if (!player) return;

    const message = String(ev.message ?? "");
    const trimmed = message.trim();
    if (!trimmed || trimmed.startsWith("/")) return;
    if (isVanishedPlayer(player)) return;

    const recent = recentFormatted.get(player.id);
    if (recent && recent.message === message && Date.now() - recent.at < 750) {
        return;
    }

    system.run(() => deliverFormattedChat(player, message));
}

function tryRegisterBeforeChat() {
    if (beforeRegistered || typeof beforeChatListener !== "function") return false;

    const signal = world.beforeEvents?.chatSend;
    if (!signal) return false;

    signal.subscribe(beforeChatListener);
    beforeRegistered = true;
    console.warn("[RAIN] Chat ranks active (beforeEvents).");
    return true;
}

function tryRegisterAfterChat() {
    if (afterRegistered) return false;

    const signal = world.afterEvents?.chatSend;
    if (!signal) return false;

    signal.subscribe(onAfterChat);
    afterRegistered = true;
    console.warn("[RAIN] Chat ranks fallback active (afterEvents).");
    return true;
}

function syncAllRankTeams() {
    try {
        for (const player of world.getPlayers()) {
            syncRankChatTeam(player);
        }
    } catch (e) {}
}

function bootChatRuntime() {
    tryRegisterBeforeChat();
    tryRegisterAfterChat();
    syncAllRankTeams();
}

export function startRankChatRuntime(onBeforeChat) {
    beforeChatListener = onBeforeChat;

    bootChatRuntime();
    system.run(bootChatRuntime);
    system.runTimeout(bootChatRuntime, 20);
    system.runTimeout(bootChatRuntime, 100);

    if (world.afterEvents?.worldLoad) {
        world.afterEvents.worldLoad.subscribe(bootChatRuntime);
    }

    if (world.afterEvents?.playerSpawn) {
        world.afterEvents.playerSpawn.subscribe((ev) => {
            bootChatRuntime();
            system.runTimeout(() => syncRankChatTeam(ev.player, true), 10);
        });
    }

    const retry = system.runInterval(() => {
        retryTicks++;
        bootChatRuntime();

        if (beforeRegistered || afterRegistered || retryTicks >= 150) {
            system.clearRun(retry);
            if (!beforeRegistered && !afterRegistered) {
                console.warn("[RAIN] chatSend missing — manifest needs @minecraft/server beta + Beta APIs on.");
            }
        }
    }, 20);

    system.runInterval(() => syncAllRankTeams(), 200);
}
