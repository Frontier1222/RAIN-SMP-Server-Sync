import { system } from '@minecraft/server';
import { getOppositeFace } from './slingshot.js';
import { BlockUtils as zt, tc as Ot, vec3 as Rt, VecUtils as I } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { TCBlocks } from './constants.js';

const tankSize = 45;
const allowance = 0; // 3 blocks can be missing
const allowedBlocks = [
    "ftb_tc:seared_brick_block",
    "ftb_tc:seared_brick_cracked",
    "ftb_tc:seared_glass",
    "ftb_tc:seared_paver",
    "ftb_tc:seared_brick_carved",
    "ftb_tc:seared_brick_cracked",
    "ftb_tc:seared_cobble",
    "ftb_tc:seared_fancy_bricks",
    "ftb_tc:seared_road",
    "ftb_tc:seared_small_bricks",
    "ftb_tc:seared_stone",
    "ftb_tc:seared_tile",
    "ftb_tc:seared_triangle",
    "ftb_tc:seared_tank",
    "ftb_tc:smeltery_controller",
    "ftb_tc:seared_drain"
];
const requiredBlocks = [
    "ftb_tc:smeltery_controller",
    "ftb_tc:seared_tank",
    "ftb_tc:seared_drain"
];
// Pos Matrix
const posMatrix = [
    // Front face
    [[-1, 0, 0], [0, 0, 0], [1, 0, 0]],
    [[-1, 1, 0], [0, 1, 0], [1, 1, 0]],
    [[-1, 2, 0], [0, 2, 0], [1, 2, 0]],
    // Floor
    [[-1, -1, -1], [0, -1, -1], [1, -1, -1]],
    [[-1, -1, -2], [0, -1, -2], [1, -1, -2]],
    [[-1, -1, -3], [0, -1, -3], [1, -1, -3]],
    // Left side
    [[-2, 0, -1], [-2, 0, -2], [-2, 0, -3]],
    [[-2, 1, -1], [-2, 1, -2], [-2, 1, -3]],
    [[-2, 2, -1], [-2, 2, -2], [-2, 2, -3]],
    // Back face
    [[-1, 0, -4], [0, 0, -4], [1, 0, -4]],
    [[-1, 1, -4], [0, 1, -4], [1, 1, -4]],
    [[-1, 2, -4], [0, 2, -4], [1, 2, -4]],
    // Right side
    [[2, 0, -1], [2, 0, -2], [2, 0, -3]],
    [[2, 1, -1], [2, 1, -2], [2, 1, -3]],
    [[2, 2, -1], [2, 2, -2], [2, 2, -3]]
];
system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id !== "ftb_tc:build_test_event") {
        return;
    }
    const entity = event.sourceEntity;
    if (!entity)
        return;
    const facing = calculateDirectionFromVec2(entity.getRotation());
    const oppositeFacing = getOppositeFace(facing);
    const validBuild = checkForCorrectBlocks(oppositeFacing, entity.dimension, entity.location);
    const block = entity.dimension.getBlock(entity.location);
    if (block?.typeId !== TCBlocks.SMELTERY_CONTROLLER) {
        return;
    }
    if (!validBuild[0]) {
        zt.updateBlockState(block, Ot("is_built"), false);
        entity.setProperty("ftb_tc:built", false);
        return;
    }
    zt.updateBlockState(block, Ot("is_built"), true);
    entity.setProperty("ftb_tc:built", true);
}, {
    namespaces: ["ftb_tc"]
});
/**
 *
 * @param {"north" | "south" | "west" | "east"} facing
 * @param {Dimension} dimension
 * @param {import("@minecraft/server").Vector3} location
 */
function checkForCorrectBlocks(facing, dimension, location) {
    const translatedMatrix = createMatrix(facing, location);
    const correctBlocks = new Set();
    const incorrectBlocks = new Set();
    const blocksNeeded = new Set(requiredBlocks);
    let foundBlocks = 0;
    let foundController = false;
    for (const row of translatedMatrix) {
        for (const vec of row) {
            const block = dimension.getBlock(vec);
            if (blocksNeeded.has(block?.typeId)) {
                blocksNeeded.delete(block.typeId);
            }
            if (block?.typeId === "ftb_tc:smeltery_controller") {
                if (foundController) {
                    incorrectBlocks.add(vec);
                    continue; // Only one controller is allowed
                }
                foundController = true;
            }
            let found = false;
            for (const allowedBlock of allowedBlocks) {
                const permMatches = block?.permutation.matches(allowedBlock);
                if (permMatches) {
                    foundBlocks++;
                    correctBlocks.add(allowedBlock);
                    found = true;
                    break;
                }
            }
            if (!found) {
                incorrectBlocks.add(vec);
            }
        }
    }
    return blocksNeeded.size == 0 && [foundBlocks >= tankSize - allowance, correctBlocks, incorrectBlocks];
}
function getMissingBlocks(block) {
    if (!block) {
        return new Set();
    }
    const direction = block.permutation.getState("minecraft:cardinal_direction");
    const dimension = block.dimension;
    const translatedMatrix = createMatrix(direction, block.location);
    const blocksNeeded = new Set(requiredBlocks);
    for (const row of translatedMatrix) {
        for (const vec of row) {
            const block = dimension.getBlock(vec);
            if (blocksNeeded.has(block?.typeId)) {
                blocksNeeded.delete(block.typeId);
            }
        }
    }
    return blocksNeeded;
}
function createMatrix(direction, startLocation) {
    let location = startLocation;
    // Shift the location back by 2 blocks depending on the facing
    if (direction === "north") {
        location = { x: location.x, y: location.y, z: location.z };
    }
    else if (direction === "south") {
        location = { x: location.x, y: location.y, z: location.z + 4 };
    }
    else if (direction === "west") {
        location = { x: location.x - 2, y: location.y, z: location.z + 2 };
    }
    else if (direction === "east") {
        location = { x: location.x + 2, y: location.y, z: location.z + 2 };
    }
    // Take the normalized matrix and translate it to the location
    const normalizedMatrix = posMatrix.map((row) => row.map((vec) => Rt(vec[0], vec[1], vec[2])));
    return normalizedMatrix.map((row) => row.map((vec) => Rt(vec.x + location.x, vec.y + location.y, vec.z + location.z)));
}
function calculateDirectionFromVec2(rotation) {
    const y = rotation.y;
    // Y rotation is between -180 and 180
    // SOUTH -45 -> 45
    // WEST 45 -> 135
    // NORTH 135 -> -135
    // EAST -135 -> -45
    if (y >= -45 && y < 45) {
        return "south";
    }
    else if (y >= 45 && y < 135) {
        return "west";
    }
    else if (y >= 135 || y < -135) {
        return "north";
    }
    else {
        return "east";
    }
}
function findBlockInSmeltery(block, wantedIds) {
    const direction = block.permutation.getState("minecraft:cardinal_direction");
    const dimension = block.dimension;
    const translatedMatrix = createMatrix(direction, block.location);
    const foundBlocks = [];
    for (const row of translatedMatrix) {
        for (const vec of row) {
            const block = dimension.getBlock(vec);
            if (!block)
                continue;
            const hasId = wantedIds.length > 0 ? wantedIds.includes(block?.typeId) : true;
            if (hasId) {
                foundBlocks.push(block);
            }
        }
    }
    return foundBlocks;
}
function isBlockPartOfSmeltery(block, wantedLocation) {
    const direction = block.permutation.getState("minecraft:cardinal_direction");
    const dimension = block.dimension;
    const translatedMatrix = createMatrix(direction, block.location);
    for (const row of translatedMatrix) {
        for (const vec of row) {
            const block = dimension.getBlock(vec);
            if (!block)
                continue;
            if (I.equals(wantedLocation, block.location)) {
                return true;
            }
        }
    }
    return false;
}

export { findBlockInSmeltery, getMissingBlocks, isBlockPartOfSmeltery };
