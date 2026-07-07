import { system, world } from "@minecraft/server";
import { isAnvilBlock } from "./blockTypes.js";
import { isTinkersConstructItem } from "./tinkersClaim.js";
import { stripMcCodes } from "./soulboundGrave.js";
import {
    applyNameTagColorNormalization,
    needsAliasColorNormalization,
} from "../systems/auction/utils/itemDisplay.js";

const ANVIL_INPUT_SLOT = 0;
const WATCH_TICKS = 80;

/** @type {Map<string, { sanitized: boolean, renamed: boolean, originalNameTag?: string, blockKey: string }>} */
const anvilSessions = new Map();

function blockKey(block) {
    const loc = block.location;
    return `${block.dimension.id}:${loc.x},${loc.y},${loc.z}`;
}

function titleCase(text) {
    return String(text || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function deriveTinkersToolName(typeId) {
    const id = String(typeId || "").split(":")[1] || "";
    const headMatch = id.match(/head_([a-z0-9]+)/i);
    const material = headMatch ? headMatch[1] : "";

    let tool = id.split("_head_")[0] || id;
    if (tool.includes("_handle_")) {
        tool = tool.split("_handle_")[0];
    }
    tool = tool.replace(/_/g, " ");

    if (material && tool) {
        return `${titleCase(material)} ${titleCase(tool)}`;
    }

    return titleCase(tool) || "Tool";
}

function plainRenameText(stack) {
    if (stack?.nameTag) {
        return stripMcCodes(stack.nameTag).split("\n")[0].trim();
    }

    return deriveTinkersToolName(stack?.typeId);
}

function needsAnvilRenamePrep(stack) {
    if (!stack || !isTinkersConstructItem(stack.typeId)) return false;

    const plain = plainRenameText(stack);
    if (!plain) return false;

    if (!stack.nameTag) return true;
    if (stack.nameTag.includes("\u00A7")) return true;
    if (stack.nameTag.includes("\n")) return true;

    return stack.nameTag !== plain;
}

function prepareTinkersStackForAnvilRename(stack) {
    if (!needsAnvilRenamePrep(stack)) return false;

    const plain = plainRenameText(stack);
    if (!plain) return false;

    stack.nameTag = plain;
    return true;
}

function getAnvilContainer(block) {
    try {
        return block.getComponent("minecraft:inventory")?.container;
    } catch (e) {
        return undefined;
    }
}

function beginAnvilSession(player, block) {
    const key = blockKey(block);
    const existing = anvilSessions.get(player.id);
    if (existing?.blockKey === key) return existing;

    const session = {
        sanitized: false,
        renamed: false,
        originalNameTag: undefined,
        blockKey: key,
    };
    anvilSessions.set(player.id, session);
    return session;
}

function sanitizeAnvilInputOnce(block, session) {
    if (session.sanitized) return false;

    const container = getAnvilContainer(block);
    if (!container) return false;

    const stack = container.getItem(ANVIL_INPUT_SLOT);
    if (!stack || !isTinkersConstructItem(stack.typeId)) return false;
    if (!needsAnvilRenamePrep(stack)) return false;

    session.originalNameTag = stack.nameTag;
    if (!prepareTinkersStackForAnvilRename(stack)) return false;

    container.setItem(ANVIL_INPUT_SLOT, stack);
    session.sanitized = true;
    return true;
}

function restoreAnvilInputIfNeeded(block, session) {
    if (!session?.sanitized || session.renamed) return;

    const container = getAnvilContainer(block);
    if (!container) return;

    const stack = container.getItem(ANVIL_INPUT_SLOT);
    if (!stack || !isTinkersConstructItem(stack.typeId)) return;

    stack.nameTag = session.originalNameTag;
    container.setItem(ANVIL_INPUT_SLOT, stack);
}


function prepAnvilBeforeOpen(player, block) {
    beginAnvilSession(player, block);
    sanitizeAnvilInputOnce(block, anvilSessions.get(player.id));
}

function watchAnvilInput(player, block) {
    const key = blockKey(block);
    const session = beginAnvilSession(player, block);

    system.run(() => {
        if (player.isValid && block.isValid && blockKey(block) === key) {
            sanitizeAnvilInputOnce(block, session);
        }
    });

    let ticks = 0;
    const runId = system.runInterval(() => {
        ticks++;
        if (!player.isValid || !block.isValid || ticks > WATCH_TICKS) {
            restoreAnvilInputIfNeeded(block, session);
            system.clearRun(runId);
            anvilSessions.delete(player.id);
            return;
        }

        if (blockKey(block) !== key) return;

        sanitizeAnvilInputOnce(block, session);
    }, 2);
}

function tryFixRenamedOutput(player, slot, item) {
    if (!item || !isTinkersConstructItem(item.typeId)) return;
    if (!item.nameTag || !needsAliasColorNormalization(item.nameTag)) return;

    const session = anvilSessions.get(player.id);
    if (session) session.renamed = true;

    system.run(() => {
        try {
            const inv = player.getComponent("minecraft:inventory")?.container;
            if (!inv) return;

            const live = inv.getItem(slot);
            if (!live || live.typeId !== item.typeId) return;
            if (!applyNameTagColorNormalization(live)) return;

            inv.setItem(slot, live);
        } catch (e) {}
    });
}

/** Fix Tinkers anvil rename UI (default display_name uses § + newlines and breaks the text field). */
export function startTinkersAnvilRenameRuntime() {
    if (world.beforeEvents?.playerInteractWithBlock) {
        world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
            const block = ev.block;
            if (!block?.isValid || !isAnvilBlock(block.typeId)) return;
            prepAnvilBeforeOpen(ev.player, block);
        });
    }

    if (world.afterEvents?.playerInteractWithBlock) {
        world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
            const block = ev.block;
            if (!block?.isValid || !isAnvilBlock(block.typeId)) return;
            watchAnvilInput(ev.player, block);
        });
    }

    if (world.afterEvents?.playerInventoryItemChange) {
        world.afterEvents.playerInventoryItemChange.subscribe((ev) => {
            if (!anvilSessions.has(ev.player.id)) return;
            if (typeof ev.slot !== "number") return;
            tryFixRenamedOutput(ev.player, ev.slot, ev.itemStack);
        });
    }
}
