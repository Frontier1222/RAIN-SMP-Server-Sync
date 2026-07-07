import { world, system, EquipmentSlot } from "@minecraft/server";
import { notify, registerRealmHook, REALM_STAGGER } from "../utils/realmPerf.js";
import { isRainGuiItem } from "../utils/rainGui.js";

const DIM_ID = "minecraft:overworld";
const GAME_MS = 10 * 60 * 1000;
const GOAL_COOLDOWN_MS = 4500;
const SOLO_WAIT_MS = 30 * 1000;
const BALL_ENTITY = "minecraft:sulfur_cube";

const BTN_TEAM1 = { x: 909, y: 75, z: 50 };
const BTN_TEAM2 = { x: 909, y: 75, z: 46 };
const BTN_PRACTICE = { x: 909, y: 75, z: 48 };
const BTN_LEAVE_PRACTICE = { x: 909, y: 75, z: 49 };

const BALL_CENTER = { x: 894.52, y: 74.5, z: 49.42 };
const SPAWN_TEAM1 = { x: 894.52, y: 74, z: 56 };
const SPAWN_TEAM2 = { x: 894.52, y: 74, z: 43 };
const SPAWN_PRACTICE = { x: 894.52, y: 74, z: 65.54 };
const EXIT_POS = { x: 909.3, y: 75, z: 48.41 };

/** Team 1 defends ? Team 2 scores here. */
const GOAL_TEAM1 = { cx: 894.52, cy: 74, cz: 65.54, hx: 3, hy: 3, hz: 3 };
/** Team 2 defends ? Team 1 scores here. */
const GOAL_TEAM2 = { cx: 894.51, cy: 74, cz: 33.29, hx: 3, hy: 3, hz: 3 };

const ARENA_BOUNDS = { minX: 886, maxX: 916, minY: 72, maxY: 78, minZ: 30, maxZ: 68 };

const TAG_IN = "in_soccer";
const TAG_TEAM1 = "soccer_team_1";
const TAG_TEAM2 = "soccer_team_2";
const TAG_PRACTICE = "soccer_practice";
const TAG_BALL = "soccer_ball";

const BALL_BASE_BLOCKS = [
    "minecraft:oak_planks",
    "minecraft:spruce_planks",
    "minecraft:birch_planks",
    "minecraft:ice",
    "minecraft:packed_ice",
];

const savedInventories = new Map();

/** @type {{ mode: "team"|"practice"|null, team1: number, team2: number, endsAt: number, lastGoalAt: number, ballId: string|null, waitingSoloUntil: number }} */
const game = {
    mode: null,
    team1: 0,
    team2: 0,
    endsAt: 0,
    lastGoalAt: 0,
    ballId: null,
    waitingSoloUntil: 0,
};

function getDim() {
    return world.getDimension(DIM_ID);
}

function blockMatches(block, loc) {
    if (!block || !loc) return false;
    return block.location.x === loc.x && block.location.y === loc.y && block.location.z === loc.z;
}

function isButtonBlock(block) {
    return String(block?.typeId || "").includes("button");
}

export function isSoccerPlayer(player) {
    if (!player) return false;
    return player.hasTag(TAG_IN) || player.hasTag(TAG_TEAM1) || player.hasTag(TAG_TEAM2) || player.hasTag(TAG_PRACTICE);
}

export function isSoccerBallEntity(entity) {
    if (!entity?.id) return false;
    if (entity.id === game.ballId) return true;
    return entity.typeId === BALL_ENTITY && entity.hasTag?.(TAG_BALL);
}

/** HUD line rendered below the stats sidebar (main.js buildActionbar). */
export function getSoccerHudFooter(player) {
    if (!player?.isValid || !isSoccerPlayer(player) || !game.mode || !game.endsAt) return "";

    const remainingSec = Math.max(0, Math.ceil((game.endsAt - Date.now()) / 1000));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const clock = `${mins}:${secs.toString().padStart(2, "0")}`;

    if (game.mode === "team") {
        return `\n§r\n§e[Soccer] §bT1 §f${game.team1} §8| §cT2 §f${game.team2} §8| §e${clock}`;
    }
    return `\n§r\n§e[Soccer] §7Practice §8| §e${clock}`;
}

function isInsideBox(loc, box) {
    if (!loc) return false;
    return (
        loc.x >= box.cx - box.hx &&
        loc.x <= box.cx + box.hx &&
        loc.y >= box.cy - box.hy &&
        loc.y <= box.cy + box.hy &&
        loc.z >= box.cz - box.hz &&
        loc.z <= box.cz + box.hz
    );
}

function isInArenaBounds(loc) {
    if (!loc) return false;
    return (
        loc.x >= ARENA_BOUNDS.minX &&
        loc.x <= ARENA_BOUNDS.maxX &&
        loc.y >= ARENA_BOUNDS.minY &&
        loc.y <= ARENA_BOUNDS.maxY &&
        loc.z >= ARENA_BOUNDS.minZ &&
        loc.z <= ARENA_BOUNDS.maxZ
    );
}

function getSoccerPlayers() {
    try {
        return world.getPlayers({ tags: [TAG_IN] });
    } catch (e) {
        return world.getAllPlayers().filter((p) => p.hasTag(TAG_IN));
    }
}

function getTeamPlayers() {
    return getSoccerPlayers().filter((p) => p.hasTag(TAG_TEAM1) || p.hasTag(TAG_TEAM2));
}

function saveAndClearInventory(player) {
    const invComp = player.getComponent("inventory");
    const eqComp = player.getComponent("equippable");
    if (!invComp || !eqComp) return;

    const container = invComp.container;
    const savedData = { inventory: [], equipment: {} };

    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (isRainGuiItem(item)) continue;
        savedData.inventory[i] = item?.clone();
    }

    savedData.equipment[EquipmentSlot.Head] = eqComp.getEquipment(EquipmentSlot.Head)?.clone();
    savedData.equipment[EquipmentSlot.Chest] = eqComp.getEquipment(EquipmentSlot.Chest)?.clone();
    savedData.equipment[EquipmentSlot.Legs] = eqComp.getEquipment(EquipmentSlot.Legs)?.clone();
    savedData.equipment[EquipmentSlot.Feet] = eqComp.getEquipment(EquipmentSlot.Feet)?.clone();
    savedData.equipment[EquipmentSlot.Offhand] = eqComp.getEquipment(EquipmentSlot.Offhand)?.clone();

    savedInventories.set(player.id, savedData);
    container.clearAll();

    for (const slot of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand]) {
        eqComp.setEquipment(slot, undefined);
    }

    player.addTag(TAG_IN);
}

function restoreInventory(player) {
    if (!savedInventories.has(player.id)) return;

    const savedData = savedInventories.get(player.id);
    const invComp = player.getComponent("inventory");
    const eqComp = player.getComponent("equippable");
    if (!invComp || !eqComp) return;

    const container = invComp.container;
    container.clearAll();

    for (let i = 0; i < container.size; i++) {
        const item = savedData.inventory[i];
        if (!item || isRainGuiItem(item)) continue;
        container.setItem(i, item);
    }

    eqComp.setEquipment(EquipmentSlot.Head, savedData.equipment[EquipmentSlot.Head]);
    eqComp.setEquipment(EquipmentSlot.Chest, savedData.equipment[EquipmentSlot.Chest]);
    eqComp.setEquipment(EquipmentSlot.Legs, savedData.equipment[EquipmentSlot.Legs]);
    eqComp.setEquipment(EquipmentSlot.Feet, savedData.equipment[EquipmentSlot.Feet]);
    eqComp.setEquipment(EquipmentSlot.Offhand, savedData.equipment[EquipmentSlot.Offhand]);

    savedInventories.delete(player.id);
}

function clearSoccerTags(player) {
    player.removeTag(TAG_IN);
    player.removeTag(TAG_TEAM1);
    player.removeTag(TAG_TEAM2);
    player.removeTag(TAG_PRACTICE);
}

function formatScoreLine() {
    const mins = game.endsAt > 0 ? Math.max(0, Math.ceil((game.endsAt - Date.now()) / 60000)) : 0;
    return `§e[Soccer] §bTeam 1 §7- §f${game.team1} §8| §cTeam 2 §7- §f${game.team2} §8| §7${mins}m left`;
}

function broadcastScore(extra = "") {
    const line = game.mode === "team"
        ? formatScoreLine() + (extra ? ` §8? ${extra}` : "")
        : `§e[Soccer] §7Practice${extra ? ` §8? ${extra}` : ""}`;
    try {
        world.sendMessage(line);
    } catch (e) {}
}

function teleportPlayerToSpawn(player) {
    if (player.hasTag(TAG_PRACTICE)) {
        player.teleport(SPAWN_PRACTICE, { dimension: getDim() });
    } else if (player.hasTag(TAG_TEAM1)) {
        player.teleport(SPAWN_TEAM1, { dimension: getDim() });
    } else if (player.hasTag(TAG_TEAM2)) {
        player.teleport(SPAWN_TEAM2, { dimension: getDim() });
    }
}

function resetPlayersAfterGoal() {
    for (const player of getSoccerPlayers()) {
        teleportPlayerToSpawn(player);
        try {
            player.addEffect("resistance", 40, { amplifier: 4, showParticles: false });
        } catch (e) {}
    }
}

function playGoalCelebration(goalBox, message) {
    const dim = getDim();
    const loc = { x: goalBox.cx, y: goalBox.cy + 1, z: goalBox.cz };

    try {
        dim.playSound("random.levelup", loc, { volume: 1.4, pitch: 1 });
        dim.playSound("mob.villager.celebrate", loc, { volume: 1.2, pitch: 1.1 });
        dim.playSound("random.firework", loc, { volume: 0.8, pitch: 1 });
    } catch (e) {}

    try {
        for (let i = 0; i < 16; i++) {
            dim.spawnParticle("minecraft:villager_happy", {
                x: loc.x + (Math.random() - 0.5) * 3,
                y: loc.y + Math.random() * 2,
                z: loc.z + (Math.random() - 0.5) * 3,
            });
        }
        dim.spawnParticle("minecraft:totem_particle", loc);
    } catch (e) {}

    broadcastScore(message.replace(/§./g, "").trim());

    for (const p of getSoccerPlayers()) {
        notify(p, "soccer_goal", "§a§lGOAL!", message, "random.levelup", 2500, 1);
        try {
            p.onScreenDisplay.setTitle("§a§lGOAL!", {
                subtitle: message,
                stayDuration: 35,
                fadeInDuration: 5,
                fadeOutDuration: 10,
            });
        } catch (e) {}
        try {
            p.playSound("random.levelup", { volume: 1, pitch: 1.2 });
        } catch (e) {}
    }
}

function removeBallEntity() {
    if (!game.ballId) {
        try {
            for (const entity of getDim().getEntities({ type: BALL_ENTITY })) {
                if (entity.hasTag?.(TAG_BALL)) entity.remove();
            }
        } catch (e) {}
        return;
    }

    try {
        const entity = world.getEntity(game.ballId);
        if (entity?.isValid) entity.remove();
    } catch (e) {
        try {
            for (const entity of getDim().getEntities({ type: BALL_ENTITY })) {
                if (entity.id === game.ballId || entity.hasTag?.(TAG_BALL)) {
                    entity.remove();
                    break;
                }
            }
        } catch (e2) {}
    }
    game.ballId = null;
}

function pickRandomBaseBlock() {
    return BALL_BASE_BLOCKS[Math.floor(Math.random() * BALL_BASE_BLOCKS.length)];
}

function equipBallBaseBlock(entity) {
    if (!entity?.isValid) return;
    const base = pickRandomBaseBlock();
    const id = base.replace("minecraft:", "");

    try {
        entity.triggerEvent("minecraft:spawn_medium");
    } catch (e) {}

    system.runTimeout(() => {
        if (!entity?.isValid) return;
        try {
            entity.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${id}`);
        } catch (e) {}
        try {
            entity.triggerEvent("minecraft:become_football");
        } catch (e) {}
    }, 3);
}

function spawnBall() {
    removeBallEntity();
    const dim = getDim();

    try {
        const entity = dim.spawnEntity(BALL_ENTITY, BALL_CENTER);
        if (!entity?.id) return;

        game.ballId = entity.id;
        try {
            entity.addTag(TAG_BALL);
        } catch (e) {}
        equipBallBaseBlock(entity);
    } catch (e) {}
}

function getBallEntity() {
    if (!game.ballId) return null;
    try {
        const entity = world.getEntity(game.ballId);
        if (entity?.isValid) return entity;
    } catch (e) {}
    game.ballId = null;
    return null;
}

function ensureGameTimer(mode) {
    if (game.endsAt > Date.now() && game.mode === mode) return;
    game.mode = mode;
    game.endsAt = Date.now() + GAME_MS;
    game.team1 = 0;
    game.team2 = 0;
    game.waitingSoloUntil = 0;
    spawnBall();
    broadcastScore(mode === "team" ? "Match started!" : "Practice session started!");
}

function leaveSoccer(player, reason = "You left the soccer arena.") {
    if (!isSoccerPlayer(player)) return;

    restoreInventory(player);
    clearSoccerTags(player);
    player.teleport(EXIT_POS, { dimension: getDim() });
    notify(player, "soccer_leave", "§e§l[Soccer]§r", reason, "random.pop");

    system.runTimeout(() => {
        const remaining = getSoccerPlayers();
        if (!remaining.length) {
            removeBallEntity();
            game.mode = null;
            game.endsAt = 0;
            game.team1 = 0;
            game.team2 = 0;
            game.waitingSoloUntil = 0;
            return;
        }
        if (game.mode === "team" && getTeamPlayers().length === 1) {
            game.waitingSoloUntil = Date.now() + SOLO_WAIT_MS;
        }
    }, 5);
}

function endGame(reason) {
    if (game.mode === "team") {
        let winner = "§7Draw!";
        if (game.team1 > game.team2) winner = "§bTeam 1 wins!";
        else if (game.team2 > game.team1) winner = "§cTeam 2 wins!";
        world.sendMessage(`§e[Soccer] §f${reason} ${formatScoreLine()} §8? ${winner}`);
    } else {
        world.sendMessage(`§e[Soccer] §7Practice ended. §f${reason}`);
    }

    for (const player of [...getSoccerPlayers()]) {
        leaveSoccer(player, reason);
    }

    removeBallEntity();
    game.mode = null;
    game.endsAt = 0;
    game.team1 = 0;
    game.team2 = 0;
    game.waitingSoloUntil = 0;
}

function registerGoal(scoringTeam, goalBox) {
    const now = Date.now();
    if (now - game.lastGoalAt < GOAL_COOLDOWN_MS) return;
    game.lastGoalAt = now;

    const message = game.mode === "team"
        ? `§bTeam ${scoringTeam} §fscored! §8(${game.team1 + (scoringTeam === 1 ? 1 : 0)}-${game.team2 + (scoringTeam === 2 ? 1 : 0)})`
        : "§7Practice goal!";

    if (game.mode === "team") {
        if (scoringTeam === 1) game.team1 += 1;
        else game.team2 += 1;
    }

    playGoalCelebration(goalBox, message);
    resetPlayersAfterGoal();

    system.runTimeout(() => spawnBall(), 12);
}

function tickBallGoals() {
    if (!game.mode || Date.now() > game.endsAt) return;

    let ball = getBallEntity();
    if (!ball) {
        spawnBall();
        return;
    }

    const loc = ball.location;
    if (!isInArenaBounds(loc)) {
        system.run(() => spawnBall());
        return;
    }

    if (isInsideBox(loc, GOAL_TEAM2)) {
        registerGoal(1, GOAL_TEAM2);
    } else if (isInsideBox(loc, GOAL_TEAM1)) {
        registerGoal(2, GOAL_TEAM1);
    }
}

function tickGameClock() {
    if (!game.mode || !game.endsAt) return;
    if (Date.now() < game.endsAt) return;
    endGame("Time is up!");
}

function tickSoloWaitKick() {
    if (game.mode !== "team" || !game.waitingSoloUntil) return;

    const teamPlayers = getTeamPlayers();
    if (teamPlayers.length >= 2) {
        game.waitingSoloUntil = 0;
        return;
    }

    if (Date.now() < game.waitingSoloUntil) return;

    game.waitingSoloUntil = 0;
    for (const player of [...teamPlayers]) {
        leaveSoccer(player, "§cNobody joined within 30 seconds ? you were removed from the arena.");
    }
    if (!getSoccerPlayers().length) {
        removeBallEntity();
        game.mode = null;
        game.endsAt = 0;
    }
}

function tickArenaEntryGuard() {
    let dim;
    try {
        dim = getDim();
    } catch (e) {
        return;
    }

    for (const player of dim.getPlayers()) {
        if (!isInArenaBounds(player.location)) continue;
        if (isSoccerPlayer(player)) continue;

        player.teleport(EXIT_POS, { dimension: dim });
        notify(
            player,
            "soccer_no_entry",
            "§e§l[Soccer]§r",
            "§cYou cannot enter the arena without joining a team or practice.",
            "note.bass"
        );
    }
}

function joinTeam(player, teamNum) {
    if (player.hasTag(TAG_IN)) {
        notify(player, "soccer_already_in", "§e§l[Soccer]§r", "§cYou are already in the arena!", "", "note.bass");
        return;
    }
    if (player.hasTag("in_arena") || player.hasTag("in_spleef")) {
        notify(player, "soccer_other_minigame", "§e§l[Soccer]§r", "§cLeave the other minigame first!", "", "note.bass");
        return;
    }

    saveAndClearInventory(player);
    player.removeTag(TAG_PRACTICE);
    player.removeTag(TAG_TEAM1);
    player.removeTag(TAG_TEAM2);
    player.addTag(teamNum === 1 ? TAG_TEAM1 : TAG_TEAM2);

    ensureGameTimer("team");
    player.teleport(teamNum === 1 ? SPAWN_TEAM1 : SPAWN_TEAM2, { dimension: getDim() });

    if (getTeamPlayers().length === 1) {
        game.waitingSoloUntil = Date.now() + SOLO_WAIT_MS;
        notify(
            player,
            "soccer_wait",
            "§e§l[Soccer]§r",
            "§7Waiting for players? §e30s §7until auto-leave if nobody else joins.",
            "random.pop"
        );
    } else {
        game.waitingSoloUntil = 0;
    }

    notify(
        player,
        "soccer_join_team",
        "§e§l[Soccer]§r",
        `§aJoined §${teamNum === 1 ? "b" : "c"}Team ${teamNum}§a! Inventory saved. No PVP.`,
        "random.levelup"
    );
    broadcastScore(`${player.name} joined Team ${teamNum}`);
}

function joinPractice(player) {
    if (player.hasTag(TAG_IN)) {
        notify(player, "soccer_already_in", "§e§l[Soccer]§r", "§cYou are already in the arena!", "", "note.bass");
        return;
    }
    if (player.hasTag("in_arena") || player.hasTag("in_spleef")) {
        notify(player, "soccer_other_minigame", "§e§l[Soccer]§r", "§cLeave the other minigame first!", "", "note.bass");
        return;
    }

    saveAndClearInventory(player);
    player.removeTag(TAG_TEAM1);
    player.removeTag(TAG_TEAM2);
    player.addTag(TAG_PRACTICE);

    ensureGameTimer("practice");
    player.teleport(SPAWN_PRACTICE, { dimension: getDim() });

    notify(
        player,
        "soccer_join_practice",
        "§e§l[Soccer]§r",
        "§aPractice mode! Use the leave button to exit. Inventory saved.",
        "random.levelup"
    );
    broadcastScore(`${player.name} joined practice`);
}

function tryLeavePractice(player) {
    if (!player.hasTag(TAG_PRACTICE)) {
        notify(player, "soccer_leave_denied", "§e§l[Soccer]§r", "§cOnly practice players can use this button.", "", "note.bass");
        return;
    }
    leaveSoccer(player, "§7You left practice mode.");
}

export function initSoccerArena() {
    world.afterEvents.playerInteractWithBlock.subscribe((event) => {
        const block = event.block;
        const player = event.player;
        if (!isButtonBlock(block)) return;

        if (blockMatches(block, BTN_TEAM1)) {
            event.cancel = true;
            joinTeam(player, 1);
            return;
        }
        if (blockMatches(block, BTN_TEAM2)) {
            event.cancel = true;
            joinTeam(player, 2);
            return;
        }
        if (blockMatches(block, BTN_PRACTICE)) {
            event.cancel = true;
            joinPractice(player);
            return;
        }
        if (blockMatches(block, BTN_LEAVE_PRACTICE)) {
            event.cancel = true;
            tryLeavePractice(player);
        }
    });

    if (world.beforeEvents?.playerInteractWithEntity) {
        world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
            const target = event.target;
            if (!target || !isSoccerBallEntity(target)) return;
            if (!isInArenaBounds(target.location)) return;
            event.cancel = true;
        });
    }

    if (world.beforeEvents?.entityHurt) {
        world.beforeEvents.entityHurt.subscribe((event) => {
            const victim = event.hurtEntity;
            const attacker = event.damageSource?.damagingEntity;

            if (victim?.typeId === "minecraft:player" && isSoccerPlayer(victim)) {
                if (!attacker || attacker.typeId !== "minecraft:player" || isSoccerPlayer(attacker)) {
                    event.cancel = true;
                }
            }

            if (isSoccerBallEntity(victim)) {
                event.cancel = true;
            }
        });
    }

    if (world.afterEvents?.entitySpawn) {
        world.afterEvents.entitySpawn.subscribe((event) => {
            const entity = event.entity;
            if (!entity || entity.typeId !== BALL_ENTITY) return;
            if (!isInArenaBounds(entity.location)) return;
            if (entity.id === game.ballId || entity.hasTag?.(TAG_BALL)) return;
            system.run(() => {
                try {
                    entity.remove();
                } catch (e) {}
            });
        });
    }

    if (world.afterEvents?.playerLeave) {
        world.afterEvents.playerLeave.subscribe((event) => {
            savedInventories.delete(event.playerId);
        });
    }

    registerRealmHook(REALM_STAGGER.SLOW, () => {
        tickBallGoals();
        tickGameClock();
        tickSoloWaitKick();
    });

    registerRealmHook(REALM_STAGGER.MEDIUM, () => {
        tickArenaEntryGuard();
    });
}

/** Called from main.js on player death while tagged. */
export function handleSoccerPlayerDeath(player) {
    if (!isSoccerPlayer(player)) return false;
    leaveSoccer(player, "§cYou died ? items restored.");
    return true;
}

/** Called from main.js on player spawn after death. */
export function handleSoccerPlayerRespawn(player) {
    if (!isSoccerPlayer(player)) return false;
    clearSoccerTags(player);
    restoreInventory(player);
    player.teleport(EXIT_POS, { dimension: getDim() });
    return true;
}

export const SOCCER_FIXKIT_TAGS = [TAG_IN, TAG_TEAM1, TAG_TEAM2, TAG_PRACTICE];
