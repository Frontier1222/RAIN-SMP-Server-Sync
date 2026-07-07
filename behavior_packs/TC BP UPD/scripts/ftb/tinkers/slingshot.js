import { world, EquipmentSlot } from '@minecraft/server';
import { isEntityPlayer } from './utils.js';
import { Mth as X } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const SLING_COOLDOWN_TICKS = 80;
const SLING_COOLDOWN_CATEGORY = "ftb_tc:slingshot";

function slingChat(player, message) {
    player.sendMessage(`§7[§aSling§7] §r${message}`);
}

function getSlingPower(useDuration) {
    const timeUsed = ((9999 * 20) - useDuration) / 20;
    return Math.min(4, Math.max(0.5, timeUsed / 4));
}

world.afterEvents.itemStartUse.subscribe((data) => {
    if (data.itemStack && isSling(data.itemStack)) {
        slingChat(data.source, "§eCharging...");
    }
});

world.afterEvents.itemReleaseUse.subscribe((eventData) => {
    const { itemStack, source, useDuration } = eventData;
    if (!itemStack) {
        return;
    }
    const typeId = itemStack.typeId;
    if (!isSling(itemStack)) {
        return;
    }

    const power = getSlingPower(useDuration);

    if (typeId === "ftb_tc:earth_slime_sling") {
        source.applyKnockback({ x: 0, z: 0 }, power * 0.65);
        slingChat(source, "§aLaunched!");
    }
    if (typeId === "ftb_tc:scarlet_slime_sling") {
        const entityAtCrosshair = source.getEntitiesFromViewDirection({
            maxDistance: 6,
        });
        if (entityAtCrosshair.length) {
            const entity = entityAtCrosshair[0];
            const viewDirection = source.getViewDirection();
            const knockPower = power * 1.25;
            if (isEntityPlayer(entity.entity)) {
                entity.entity.applyKnockback({ x: viewDirection.x * power * 0.5, z: viewDirection.z * power * 0.5 }, 0.5);
            }
            else {
                entity.entity.applyImpulse({
                    x: viewDirection.x * knockPower,
                    y: viewDirection.y * 0.5,
                    z: viewDirection.z * knockPower,
                });
            }
            slingChat(source, "§cPushed target!");
        }
        else {
            slingChat(source, "§cNo targets found.");
            return;
        }
    }
    if (typeId === "ftb_tc:sky_slime_sling") {
        const viewDirection = source.getViewDirection();
        source.applyKnockback({ x: viewDirection.x * 2, z: viewDirection.z * 2 }, 0.5);
        slingChat(source, "§bBoosted!");
    }
    if (typeId === "ftb_tc:ender_slime_sling") {
        if (!source.isOnGround) {
            slingChat(source, "§5You must be on the ground to teleport.");
            return;
        }
        const result = source.getBlockFromViewDirection({
            maxDistance: 10,
        });
        if (!result) {
            const playerFacing = source.getViewDirection();
            const x = source.location.x + playerFacing.x * 10;
            let y = source.location.y + playerFacing.y * 10 + 1;
            const z = source.location.z + playerFacing.z * 10;
            const block = source.dimension.getBlock({ x, y, z });
            if (!block.isAir) {
                let tries = 0;
                while (tries < 10) {
                    const next = source.dimension.getBlock({ x, y, z });
                    if (next.isAir) {
                        source.teleport({ x, y, z });
                        slingChat(source, "§5Teleported!");
                        break;
                    }
                    y++;
                    tries++;
                }
                if (tries >= 10) {
                    slingChat(source, "§cNo safe place to teleport to.");
                }
            }
            else {
                source.teleport({ x, y, z });
                slingChat(source, "§5Teleported!");
            }
        }
        else {
            let hitBlock = result.block;
            let facingDirection = getOppositeFace(result.face);
            let tries = 0;
            let lastBlock = hitBlock;
            let teleported = false;
            while (tries < 10) {
                const block = lastBlock[facingDirection]();
                if (block.isAir) {
                    const blockAbove = block.above();
                    if (blockAbove.isAir) {
                        const loc = block.location;
                        source.teleport({
                            x: loc.x + 0.5,
                            y: loc.y,
                            z: loc.z + 0.5,
                        });
                        teleported = true;
                        slingChat(source, "§5Teleported!");
                        break;
                    }
                }
                lastBlock = block;
                tries++;
            }
            if (!teleported) {
                slingChat(source, "§cNo safe place to teleport to.");
            }
        }
    }
    if (typeId === "ftb_tc:ichor_slime_sling") {
        let foundEntities = [];
        foundEntities.push(...source.dimension.getEntities({
            location: source.location,
            maxDistance: 6,
            families: ["mob"],
        }));
        foundEntities.push(...source.dimension.getEntities({
            location: source.location,
            maxDistance: 6,
            families: ["player"],
        }));
        foundEntities = foundEntities.filter((entity) => entity.id !== source.id);
        if (foundEntities.length === 0) {
            slingChat(source, "§6Nothing to yeet.");
        }
        else {
            let yeetText = `Y${"EE".repeat(X.randomRanged(Math.max(1, power / 6), 2))}${"T".repeat(X.randomRanged(Math.max(1, power / 5), 2))}T!`;
            if (yeetText.length < 8) {
                yeetText = yeetText.toLowerCase();
            }
            slingChat(source, `§6${yeetText}`);
            const launchPower = power * 0.5;
            for (const entity of foundEntities) {
                entity.addEffect("fire_resistance", Math.floor(power * 8), { amplifier: 0 });
                if (isEntityPlayer(entity)) {
                    entity.applyKnockback({ x: 0, z: 0 }, launchPower);
                }
                else {
                    entity.applyImpulse({
                        x: 0,
                        y: launchPower,
                        z: 0,
                    });
                }
            }
        }
    }

    try {
        source.startItemCooldown(SLING_COOLDOWN_CATEGORY, SLING_COOLDOWN_TICKS);
    } catch (e) { }

    const lore = itemStack.getLore();
    const hasDurabilityLore = lore.find((line) => line.includes("Uses Left:"));
    let durability = 16;
    if (!hasDurabilityLore) {
        source.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${typeId} 1 1`);
    }
    else {
        const durabilityLore = lore.find((line) => line.includes("Uses Left:"));
        const durabilityValue = parseInt(durabilityLore.split(":")[1].trim().split("/")[0].replace(/\D/g, ""));
        durability = durabilityValue;
    }
    const newDurability = 16 - (durability - 1);
    if (newDurability >= 16) {
        source.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 minecraft:air`);
        source.playSound("random.break");
        slingChat(source, "§cYour sling broke!");
        return;
    }
    source.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${typeId} 1 ${newDurability}`);
    const equipment = source.getComponent("minecraft:equippable");
    if (!equipment)
        return;
    const handItem = equipment.getEquipment(EquipmentSlot.Mainhand);
    handItem.setLore([`§r§6Uses Left: §a§l${durability - 1}§r/16`]);
    equipment.setEquipment(EquipmentSlot.Mainhand, handItem);
});

function isSling(itemStack) {
    return (itemStack.typeId.startsWith("ftb_tc:") &&
        itemStack.typeId.endsWith("_sling"));
}
/**
 * @param {Direction} face
 */
function getOppositeFace(face, noFix = false) {
    switch (face.toLowerCase()) {
        case "down":
            return noFix ? "up" : "above";
        case "up":
            return noFix ? "down" : "below";
        case "north":
            return "south";
        case "south":
            return "north";
        case "west":
            return "east";
        case "east":
            return "west";
    }
}

export { getOppositeFace, isSling };
