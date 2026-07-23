import { DimensionType, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData, ActionFormResponse } from "@minecraft/server-ui"
import { important_blocks_and_entities } from "./data.js";
import { getChunkLines, addLine, removeLine } from "./line_drawing.js"
import { allowsBountyPvp, blocksBountyHunterPvp, isBountyHunterActive } from "./systems/bounty.js";
import { notify, toastDeny, toastError, toastInfo, toastSuccess } from "./utils/realmPerf.js";

const chunksToDraw = new Map()
const wandStates = new Map()
const claimPresence = new Map()

const MAX_CHUNKS_PER_CLAIM = 128
const MAX_MULTI_CHUNK_SELECTION = MAX_CHUNKS_PER_CLAIM
const CLAIM_ALLOW_SOUND = "ui.toast.challenge_complete"
const CLAIM_DENY_SOUND = "ui.toast.woosh"
const CLAIM_NOTICE_SOUND = "ui.toast.woosh"

function isBountyDoorLikeInteraction(blockId) {
    const id = String(blockId || "").toLowerCase();
    return id.includes("door") ||
        id.includes("trapdoor") ||
        id.includes("fence_gate") ||
        id.includes("button") ||
        id.includes("lever");
}

function formatNameList(list) {
    if (!Array.isArray(list) || list.length === 0) return "§7None"
    return list.map((name) => `§f${name}`).join("§7, ")
}

function formatClaimStatusLine(player, selectedCount = 1) {
    return `§7Selected: §f${selectedCount}§7 chunk${selectedCount === 1 ? "" : "s"}\n§7Per Claim: §f${MAX_CHUNKS_PER_CLAIM}§7 max`
}

function notifyClaim(player, key, title, body, sound = CLAIM_NOTICE_SOUND, cooldownMs = 2500) {
    notify(player, key, title, body, sound, cooldownMs)
}

function denyClaimAction(player, message, key = "land_claim_deny") {
    toastDeny(player, message, key, CLAIM_DENY_SOUND)
}

function successClaimAction(player, message, key = "land_claim_success") {
    toastSuccess(player, message, key)
    try {
        player.playSound(CLAIM_ALLOW_SOUND)
    } catch (e) {}
}

function getChunkClaimAt(entityOrBlock) {
    if (!entityOrBlock?.dimension) return undefined
    const gCL = getChunkLines(entityOrBlock)
    return entityOrBlock.dimension.getEntities({
        location: { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 },
        volume: { x: 14, y: 488, z: 14 },
        type: "viberater:land_claim_cube",
        closest: 1
    })[0]
}

function drawClaimBorder(entityOrLines, player, rgba = { r: 0, g: 1, b: 0, a: 1 }, permanent = true) {
    const lines = Array.isArray(entityOrLines) ? entityOrLines : getChunkLines(entityOrLines)
    lines.forEach((line, index) => {
        const id = permanent && player?.id && entityOrLines?.id
            ? `claim_border_${player.id}_${entityOrLines.id}_${index}`
            : undefined
        addLine(line, permanent ? undefined : 5, rgba, player.dimension, id, [player], 396)
    })
}

function drawChunkSelection(gCL, player, idPrefix, rgba = { r: 1, g: 1, b: 1, a: 1 }, permanent = true) {
    gCL.forEach((line, index) => {
        addLine(line, permanent ? undefined : 5, rgba, player.dimension, `${idPrefix}_${index}`, [player], 396)
    })
}

function canEditClaim(player, claim) {
    if (!player || !claim) return false
    return claim.getDynamicProperty('owner') == player.id || player.getGameMode() == "Creative"
}

function resetLegacyClaimMemory(player) {
    try {
        player.setDynamicProperty('land_claim_cubes', 0)
    } catch (e) {}
}

function showLoadedClaimBorders(player) {
    let shown = 0
    player.dimension.getEntities({
        location: player.location,
        maxDistance: 512,
        type: "viberater:land_claim_cube"
    }).forEach(claim => {
        if (canEditClaim(player, claim)) {
            drawClaimBorder(claim, player)
            shown += 1
        }
    })
    toastInfo(player, `Showing ${shown} claimed chunk(s).`, "claim_show_loaded")
}

function getClaimOwnerName(claim) {
    const ownerName = claim?.getDynamicProperty('ownerName')
    if (ownerName) return String(ownerName)
    const owner = claim?.getDynamicProperty('owner')
    if (owner === "Server") return "Server"
    return "Unknown"
}

function isSneakingPlayer(player) {
    try {
        if (typeof player?.isSneaking === "function") return player.isSneaking()
        return !!player?.isSneaking
    } catch (e) {
        return false
    }
}

function getWandTargetBlock(player) {
    try {
        if (!player?.isValid) return undefined
        const inWater = !!player.isInWater
        return player.getBlockFromViewDirection({
            maxDistance: 64,
            includePassableBlocks: !inWater,
            includeLiquidBlocks: !inWater,
        })?.block
    } catch (e) {
        return undefined
    }
}

function claimSingleChunkNow(p, gCL, pncm = p.getGameMode() != "Creative") {
    const e = p.dimension.spawnEntity('viberater:land_claim_cube', { x: gCL[0].floor.x + 0.5, y: -64, z: gCL[0].floor.z + 0.5 })
    e.setDynamicProperty('time', pncm ? Date.now() + (86400000 * 10) : -1)
    e.setDynamicProperty('initialTime', Date.now())
    e.setDynamicProperty('allowListEnabled', false)
    e.setDynamicProperty('allowList', JSON.stringify([]))
    e.setDynamicProperty('owner', pncm ? p.id : 'Server')
    e.setDynamicProperty('ownerName', pncm ? p.name : 'Server')
    drawClaimBorder(e, p)
    successClaimAction(p, pncm ? "Chunk claimed." : "Chunk claimed for the server.", "claim_single_claimed")
    return e
}

function removeSelectedChunkLines(p, gCLs) {
    gCLs?.forEach((gCL, index1) => {
        gCL.forEach((line, index2) => {
            removeLine(p.id.toString() + "_" + "gCLs" + "_" + index1.toString() + "_" + index2.toString())
        })
    })
}

function getSelectedAreaFromBlocks(firstBlock, secondBlock) {
    const gCL0 = getChunkLines({
        "location": {
            x: Math.min(firstBlock.location.x, secondBlock.location.x),
            z: Math.min(firstBlock.location.z, secondBlock.location.z)
        }
    })
    const gCL1 = getChunkLines({
        "location": {
            x: Math.max(firstBlock.location.x, secondBlock.location.x),
            z: Math.max(firstBlock.location.z, secondBlock.location.z)
        }
    })
    const gCLs = []
    for (let i = 0; gCL0[0].floor.x + i <= gCL1[0].floor.x; i += 16) {
        for (let j = 0; gCL0[0].floor.z + j <= gCL1[0].floor.z; j += 16) {
            gCLs.push(getChunkLines({
                "location": {
                    x: gCL0[0].floor.x + i + 0.5,
                    z: gCL0[0].floor.z + j + 0.5
                }
            }))
        }
    }
    return { gCL0, gCL1, gCLs }
}

function getSelectedChunkArea(selectedChunks) {
    const chunks = Array.isArray(selectedChunks) ? selectedChunks : []
    if (!chunks.length) return { gCL0: [], gCL1: [], gCLs: [] }

    const points = chunks.map(chunk => chunk.location)
    const minX = Math.min(...points.map(point => point.x))
    const minZ = Math.min(...points.map(point => point.z))
    const maxX = Math.max(...points.map(point => point.x))
    const maxZ = Math.max(...points.map(point => point.z))
    const gCL0 = getChunkLines({ location: { x: minX, z: minZ } })
    const gCL1 = getChunkLines({ location: { x: maxX, z: maxZ } })
    const gCLs = chunks.map(chunk => getChunkLines(chunk))
    return { gCL0, gCL1, gCLs }
}

function getChunkSelectionKey(block) {
    const lines = getChunkLines(block)
    return `${lines[0].floor.x}:${lines[0].floor.z}`
}

function claimSelectedChunks(p, gCL0, gCL1, gCLs) {
    return claimSelectedChunksBatched(p, gCLs)
    /* Legacy rectangular claim path kept below for compatibility. */
    const pncm = p.getGameMode() != "Creative"
    getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
        const cCC = lccs.filter(item => item === undefined).length
        if (cCC > MAX_CHUNKS_PER_CLAIM && pncm) {
            toastError(p, `Select ${MAX_CHUNKS_PER_CLAIM} chunks or fewer per claim.`, "claim_selection_too_large")
            return
        }
        if (cCC == 0) {
            toastError(p, "There are no unclaimed chunks in the selected area.", "claim_none_available")
            return
        }
        world.tickingAreaManager.createTickingArea('tempTech', { dimension: p.dimension, from: gCL0[0].floor, to: gCL1[1].ceiling }).then(() => {
            lccs.forEach((lcc, index) => {
                if (!lcc) {
                    const e = p.dimension.spawnEntity('viberater:land_claim_cube', { x: gCLs[index][0].floor.x + 0.5, y: -64, z: gCLs[index][0].floor.z + 0.5 })
                    e.setDynamicProperty('time', pncm ? Date.now() + (86400000 * 10) : -1)
                    e.setDynamicProperty('initialTime', Date.now())
                    e.setDynamicProperty('allowListEnabled', false)
                    e.setDynamicProperty('allowList', JSON.stringify([]))
                    e.setDynamicProperty('owner', pncm ? p.id : 'Server')
                    e.setDynamicProperty('ownerName', pncm ? p.name : 'Server')
                    drawClaimBorder(e, p)
                }
            })
            world.tickingAreaManager.removeTickingArea('tempTech')
            resetLegacyClaimMemory(p)
            successClaimAction(p, pncm ? `Claimed ${cCC} chunk(s).` : `Claimed ${cCC} server chunk(s).`, "claim_multi_claimed")
            removeSelectedChunkLines(p, gCLs)
            stopWand(p)
        }).catch(() => {
            try {
                world.tickingAreaManager.removeTickingArea('tempTech')
            } catch (e) {}
            toastError(p, "The selected chunks could not be claimed. Try again.", "claim_multi_failed")
        })
    })
}

async function claimSelectedChunksBatched(p, gCLs) {
    const pncm = p.getGameMode() != "Creative"
    if (!Array.isArray(gCLs) || gCLs.length === 0) {
        toastError(p, "Select at least one chunk first.", "claim_none_selected")
        return
    }
    if (gCLs.length > MAX_CHUNKS_PER_CLAIM) {
        toastError(p, `A claim can include up to ${MAX_CHUNKS_PER_CLAIM} chunks.`, "claim_selection_too_large")
        return
    }

    const dimension = p.dimension
    let claimed = 0
    const batchSize = 8

    try {
        for (let start = 0; start < gCLs.length; start += batchSize) {
            const batch = gCLs.slice(start, start + batchSize)
            const minX = Math.min(...batch.map(gCL => gCL[0].floor.x))
            const minZ = Math.min(...batch.map(gCL => gCL[0].floor.z))
            const maxX = Math.max(...batch.map(gCL => gCL[1].floor.x))
            const maxZ = Math.max(...batch.map(gCL => gCL[1].floor.z))
            const areaName = `rain_claim_${p.id}_${Date.now()}_${start}`

            await world.tickingAreaManager.createTickingArea(areaName, {
                dimension,
                from: { x: minX, y: -64, z: minZ },
                to: { x: maxX + 16, y: 320, z: maxZ + 16 },
            })

            try {
                for (const gCL of batch) {
                    const existing = dimension.getEntities({
                        location: { x: gCL[0].floor.x + 0.5, y: -64, z: gCL[0].floor.z + 0.5 },
                        volume: { x: 14, y: 488, z: 14 },
                        type: "viberater:land_claim_cube",
                        closest: 1,
                    })[0]
                    if (existing) continue

                    const e = dimension.spawnEntity('viberater:land_claim_cube', {
                        x: gCL[0].floor.x + 0.5,
                        y: -64,
                        z: gCL[0].floor.z + 0.5,
                    })
                    e.setDynamicProperty('time', pncm ? Date.now() + (86400000 * 10) : -1)
                    e.setDynamicProperty('initialTime', Date.now())
                    e.setDynamicProperty('allowListEnabled', false)
                    e.setDynamicProperty('allowList', JSON.stringify([]))
                    e.setDynamicProperty('owner', pncm ? p.id : 'Server')
                    e.setDynamicProperty('ownerName', pncm ? p.name : 'Server')
                    drawClaimBorder(e, p)
                    claimed += 1
                }
            } finally {
                try {
                    world.tickingAreaManager.removeTickingArea(areaName)
                } catch (e) {}
            }
        }
    } catch (e) {
        toastError(p, "The selected chunks could not be claimed. Try again.", "claim_multi_failed")
        return
    }

    if (claimed === 0) {
        toastError(p, "There are no unclaimed chunks in the selection.", "claim_none_available")
        return
    }
    resetLegacyClaimMemory(p)
    successClaimAction(p, pncm ? `Claimed ${claimed} chunk(s).` : `Claimed ${claimed} server chunk(s).`, "claim_multi_claimed")
    removeSelectedChunkLines(p, gCLs)
    stopWand(p)
}

world.beforeEvents.playerInteractWithBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    if (isBountyHunterActive(p) && isBountyDoorLikeInteraction(b?.typeId)) return
    const gCL = getChunkLines(b)
    const lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) if (checkIfAllowed(p, lcc, "pib", p.name)) {
        data.cancel = true
        denyClaimAction(p, "You cannot interact with blocks in this protected chunk.", "claim_block_interact_deny")
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p], 396)
        })
    }
})

world.beforeEvents.playerBreakBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    const gCL = getChunkLines(b)
    const lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) if (checkIfAllowed(p, lcc, "pbb", p.name)) {
        data.cancel = true
        denyClaimAction(p, "You cannot break blocks in this protected chunk.", "claim_block_break_deny")
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p], 396)
        })
    }
})

world.beforeEvents.playerPlaceBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    let gCL = getChunkLines(b)
    let lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
        data.cancel = true
        denyClaimAction(p, "You cannot place blocks in this protected chunk.", "claim_block_place_deny")
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p], 396)
        })
        return
    }
    const item = data.permutationToPlace.getItemStack()
    if (item.typeId == 'minecraft:piston' || item.typeId == 'minecraft:sticky_piston') {
        gCL = getChunkLines({
            location: {
                x: b.location.x + 16,
                y: b.location.y,
                z: b.location.z
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x - 16,
                y: b.location.y,
                z: b.location.z
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x,
                y: b.location.y,
                z: b.location.z + 16
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x,
                y: b.location.y,
                z: b.location.z - 16
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x + 16,
                y: b.location.y,
                z: b.location.z + 16
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x - 16,
                y: b.location.y,
                z: b.location.z + 16
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x + 16,
                y: b.location.y,
                z: b.location.z - 16
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
        gCL = getChunkLines({
            location: {
                x: b.location.x - 16,
                y: b.location.y,
                z: b.location.z - 16
            }
        })
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) if (checkIfAllowed(p, lcc, "ppb", p.name)) {
            data.cancel = true
            denyClaimAction(p, "Pistons cannot push into protected chunks.", "claim_piston_deny")
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p], 396)
            })
            return
        }
    }
})

world.beforeEvents.playerInteractWithEntity.subscribe(data => {
    const p = data.player
    const e = data.target
    const gCL = getChunkLines(e)
    const lcc = e.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) if (checkIfAllowed(p, lcc, "pie", p.name)) {
        data.cancel = true
        denyClaimAction(p, "You cannot interact with entities in this protected chunk.", "claim_entity_interact_deny")
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p], 396)
        })
    }
})

world.beforeEvents.explosion.subscribe(data => {
    const blocks = data.getImpactedBlocks()
    let affectsBounds = false
    let lcc = undefined
    blocks.forEach(b => {
        if (affectsBounds) return
        const gCL = getChunkLines(b)
        lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) {
            affectsBounds = true
        }
    })
    if (affectsBounds) {
        data.cancel = true
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, data.dimension, undefined, [], 396)
        })
    }
})

world.beforeEvents.entityHurt.subscribe(data => {
    /** @type {import('@minecraft/server').Player} */
    const p = data.damageSource.damagingEntity
    if (!p) return
    if (p.typeId != "minecraft:player") return
    /** @type {import('@minecraft/server').Entity} */
    const e = data.hurtEntity
    if (allowsBountyPvp(e, p)) return
    if (blocksBountyHunterPvp(e, p)) {
        data.cancel = true
        p.sendMessage(`§4Bounty mode only allows attacks against your accepted contract target`)
        return
    }
    const gCL = getChunkLines(e)
    const lcc = e.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    const families = e.getComponent('type_family').getTypeFamilies()
    if (lcc) if (checkIfAllowed(p, lcc, "phe", p.name)) {
        denyClaimAction(p, "You cannot hurt entities in this protected chunk.", "claim_entity_hurt_deny")
        data.cancel = true
    }
})

world.beforeEvents.entityItemPickup.subscribe(data => {
    /** @type {import('@minecraft/server').Player} */
    const p = data.entity
    if (p.typeId != "minecraft:player") return
    /** @type {import('@minecraft/server').Entity} */
    const i = data.item
    const gCL = getChunkLines(p)
    const lcc = p.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) if (checkIfAllowed(p, lcc, "pui", p.name)) {
        data.cancel = true
        if ((Date.now() % 3000) <= 50) {
            denyClaimAction(p, "You cannot pick up items in this protected chunk.", "claim_item_pickup_deny")
        }
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p], 396)
        })
    }
})

/** @param {string[]} allowList @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Entity} lcc */
function checkIfAllowed(p, lcc, ppc, pN) {
    if (p == undefined || lcc == undefined) return false
    const pncm = p.getGameMode() != "Creative"
    const allowList = JSON.parse(lcc.getDynamicProperty('allowList') ?? "[]")
    let allowed = false
    if (lcc.getDynamicProperty('allowListEnabled')) {
        const allowList = JSON.parse(lcc.getDynamicProperty('allowList') ?? "[]")
        allowList.forEach(n => {
            if (n === p.name && (lcc.getDynamicProperty(ppc + "_" + pN) ?? true)) {
                allowed = true
            }
        })
    }
    if ((lcc?.getDynamicProperty('owner') ?? 0) == p.id || !pncm) allowed = true
    return (!allowed && (Date.now() <= lcc.getDynamicProperty('time') || lcc.getDynamicProperty('time') == -1))
}

world.afterEvents.entityLoad.subscribe(data => {
    const e = data.entity
    if (e.typeId == 'viberater:land_claim_cube') {
        if (e.getDynamicProperty('time') < Date.now()) {
            e.setProperty('viberater:active', 0)
        } else {
            e.setProperty('viberater:active', 1)
        }
    }
})

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            const claim = getChunkClaimAt(player)
            const nextKey = claim ? "claim" : "wilderness"
            const prevKey = claimPresence.get(player.id)
            if (prevKey === undefined) {
                claimPresence.set(player.id, { state: nextKey, claimId: claim?.id })
                continue
            }
            const prevState = typeof prevKey === "string" ? prevKey : prevKey.state
            if (prevState === nextKey) {
                if (claim) claimPresence.set(player.id, { state: nextKey, claimId: claim.id })
                continue
            }

            claimPresence.set(player.id, { state: nextKey, claimId: claim?.id })
            if (claim) {
                const owner = getClaimOwnerName(claim)
                notifyClaim(player, "claim_enter", "§d§l[CLAIM]§r", `§7Entered protected chunk\n§7Owner: §f${owner}`, CLAIM_NOTICE_SOUND, 1500)
            } else {
                notifyClaim(player, "claim_exit", "§7§l[WILDERNESS]§r", "§7Exited protected chunk", CLAIM_NOTICE_SOUND, 1500)
            }
        } catch (e) {}
    }
}, 20)

world.afterEvents.playerInteractWithEntity.subscribe(data => {
    const p = data.player
    const e = data.target
    return
    if (e.typeId == "viberater:land_claim_cube") {
        const owner = e.getDynamicProperty('owner')
        if (p.id == owner) {
            showSingleMainMenu(e, p)
        }
    }
})

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleMainMenu(e, p) {
    let form = new ActionFormData()
    const pncm = p.getGameMode() != "Creative"
    const owner = e.getDynamicProperty('owner')
    form.title(`bd.action:Chunk Claim`)
    const time = e.getDynamicProperty('time')
    const protection = time != -1
        ? `§7Protection: §f${Math.ceil(Math.max(0, (time - Date.now()) / 3600000))} hour(s) left`
        : `§7Protection: §aPermanent`
    const allowList = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    const allowState = e.getDynamicProperty('allowListEnabled') ? "Enabled" : "Disabled"
    form.body(`§dClaim Management\n${protection}\n§7Allow List: §f${allowState}\n§7Players: ${formatNameList(allowList)}`)
    form.button(`§aRefresh Protection §7(${(10 + Math.min(20, Math.floor((Date.now() - e.getDynamicProperty('initialTime')) / 86400000))) * 24}h)`)
    form.button(`§dAccess & Permissions`)
    form.button(`§eShow Borders`)
    form.button(`§cRemove Claim`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            e.setProperty('viberater:active', 1)
            e.setDynamicProperty('time', pncm ? (Date.now() + (86400000 * (10 + Math.min(20, Math.floor((Date.now() - e.getDynamicProperty('initialTime')) / 86400000))))) : -1)
            e.dimension.playSound('beacon.activate', e.location)
            successClaimAction(p, "Protection time refreshed.", "claim_time_refresh")
            showSingleMainMenu(e, p)
        }
        if (dv == 1) {
            showSingleAccessMenu(e, p)
        }
        if (dv == 2) {
            drawClaimBorder(e, p)
        } else if (dv !== 1) {
            const gCL = getChunkLines(e)
            gCL.forEach((line, index) => {
                removeLine(e.id.toString() + "_" + index.toString())
            })
        }
        if (dv == 3) {
            e.triggerEvent('instant_despawn')
            resetLegacyClaimMemory(p)
            successClaimAction(p, `Chunk unclaimed.`, "claim_unclaimed")
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleAccessMenu(e, p) {
    const allowList = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    const aLE = e.getDynamicProperty('allowListEnabled')
    const form = new ActionFormData()
    form.title(`bd.action:Claim Access`)
    form.body(`§dAccess & Permissions\n§7Allow List: ${aLE ? "§aEnabled" : "§cDisabled"}\n§7Players: ${formatNameList(allowList)}`)
    form.button(`§dAllow List`)
    form.button(`§bPlayer Permissions`)
    form.button(`§7Back`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) showSingleAdjustAllowListMenu(e, p)
        if (dv == 1) showSingleSelectPlayerMenu(e, p)
        if (dv == 2) showSingleMainMenu(e, p)
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleAdjustAllowListMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Allow List`)
    let allowList = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    const aLE = e.getDynamicProperty('allowListEnabled')
    form.body(`§dAccess Control\n§7Status: ${aLE ? "§aEnabled" : "§cDisabled"}\n§7Players: ${formatNameList(allowList)}`)
    form.button(`${aLE ? '§cDisable' : '§aEnable'} Allow List`)
    form.button(`§aAdd Online Player`)
    form.button(`§aAdd By Name`)
    form.button(`§cRemove Player`)
    form.button(`§7Back`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            e.setDynamicProperty('allowListEnabled', !aLE)
            toastInfo(p, `Allow list ${!aLE ? "enabled" : "disabled"}.`, "claim_allow_toggle")
            showSingleAdjustAllowListMenu(e, p)
        }
        if (dv == 1) {
            showSingleAddOnlinePlayersMenu(e, p)
        }
        if (dv == 2) {
            showSingleManuallyAddPlayersMenu(e, p)
        }
        if (dv == 3) {
            showSingleRemovePlayersMenu(e, p)
        }
        if (dv == 4) {
            showSingleAccessMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleAddOnlinePlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Add Player`)
    let aL = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    form.body(`§dAdd Online Player\n§7Players: ${formatNameList(aL)}`)
    const aP = world.getAllPlayers()
    let aPN = []
    aP.forEach(player => {
        const pN = player.name
        if (p.name != pN && !aL.includes(pN)) aPN.push(pN)
    })
    form.button(`§7Back`)
    aPN.forEach(pN => {
        form.button(`§aAdd ${pN}`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showSingleAdjustAllowListMenu(e, p)
        } else if (dv) {
            aL.push(aPN[dv - 1])
            e.setDynamicProperty('allowList', JSON.stringify(aL))
            successClaimAction(p, `${aPN[dv - 1]} added to this claim.`, "claim_allow_add")
            showSingleAddOnlinePlayersMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleManuallyAddPlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ModalFormData()
    form.title(`bd.modal:Add Players by Name`)
    let aL = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    form.textField(`Current: ${aL.join(", ") || "None"}\nPlayer name`, 'Exact name')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.submitButton('Add players')
    form.show(p).then(data => {
        const dv = data.formValues
        try {
            if (dv[0] || dv[1] || dv[2] || dv[3]) {
                if (dv[0]) aL.push(dv[0])
                if (dv[1]) aL.push(dv[1])
                if (dv[2]) aL.push(dv[2])
                if (dv[3]) aL.push(dv[3])
                e.setDynamicProperty('allowList', JSON.stringify(aL))
                successClaimAction(p, "Allow list updated.", "claim_allow_manual_add")
            }
            showSingleAdjustAllowListMenu(e, p)
        } catch { }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleRemovePlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Remove Player`)
    let aL = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    form.body(`§dRemove Player\n§7Players: ${formatNameList(aL)}`)
    form.button(`§7Back`)
    aL.forEach(pN => {
        form.button(`§cRemove ${pN}`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showSingleAdjustAllowListMenu(e, p)
        } else if (dv) {
            aL.splice(dv - 1, 1)
            e.setDynamicProperty('allowList', JSON.stringify(aL))
            toastInfo(p, "Player removed from this claim.", "claim_allow_remove")
            showSingleRemovePlayersMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleSelectPlayerMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Permissions`)
    let aL = JSON.parse(e.getDynamicProperty('allowList') ?? "[]")
    form.body(`§dPlayer Permissions\n§7Players: ${formatNameList(aL)}`)
    form.button(`§7Back`)
    aL.forEach(pN => {
        form.button(`§b${pN}`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showSingleAccessMenu(e, p)
        } else if (dv) {
            if (e.getDynamicProperty("pib" + "_" + aL[dv - 1]) == undefined) e.setDynamicProperty("pib" + "_" + aL[dv - 1], true)
            if (e.getDynamicProperty("pbb" + "_" + aL[dv - 1]) == undefined) e.setDynamicProperty("pbb" + "_" + aL[dv - 1], true)
            if (e.getDynamicProperty("ppb" + "_" + aL[dv - 1]) == undefined) e.setDynamicProperty("ppb" + "_" + aL[dv - 1], true)
            if (e.getDynamicProperty("pie" + "_" + aL[dv - 1]) == undefined) e.setDynamicProperty("pie" + "_" + aL[dv - 1], true)
            if (e.getDynamicProperty("phe" + "_" + aL[dv - 1]) == undefined) e.setDynamicProperty("phe" + "_" + aL[dv - 1], true)
            if (e.getDynamicProperty("pui" + "_" + aL[dv - 1]) == undefined) e.setDynamicProperty("pui" + "_" + aL[dv - 1], true)
            showSinglePermissionsMenu(e, p, aL, dv)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSinglePermissionsMenu(e, p, aL, dv) {
    const owner = e.getDynamicProperty('owner')
    let form = new ModalFormData()
    form.title(`bd.modal:Permissions: ${aL[dv - 1]}`)
    form.toggle('Interact with blocks', { defaultValue: e.getDynamicProperty("pib" + "_" + aL[dv - 1]) })
    form.toggle('Break blocks', { defaultValue: e.getDynamicProperty("pbb" + "_" + aL[dv - 1]) })
    form.toggle('Place blocks', { defaultValue: e.getDynamicProperty("ppb" + "_" + aL[dv - 1]) })
    form.toggle('Interact with entities', { defaultValue: e.getDynamicProperty("pie" + "_" + aL[dv - 1]) })
    form.toggle('Damage entities', { defaultValue: e.getDynamicProperty("phe" + "_" + aL[dv - 1]) })
    form.toggle('Pick up items', { defaultValue: e.getDynamicProperty("pui" + "_" + aL[dv - 1]) })
    form.submitButton('Save permissions')
    form.show(p).then(data => {
        const d = data.formValues
        if (d == 0) {
            showSingleSelectPlayerMenu(e, p)
        } else if (d) {
            e.setDynamicProperty("pib" + "_" + aL[dv - 1], d[0])
            e.setDynamicProperty("pbb" + "_" + aL[dv - 1], d[1])
            e.setDynamicProperty("ppb" + "_" + aL[dv - 1], d[2])
            e.setDynamicProperty("pie" + "_" + aL[dv - 1], d[3])
            e.setDynamicProperty("phe" + "_" + aL[dv - 1], d[4])
            e.setDynamicProperty("pui" + "_" + aL[dv - 1], d[5])
            successClaimAction(p, "Permissions saved.", "claim_perms_saved")
            showSingleSelectPlayerMenu(e, p)
        }
    })
    /*
playerInteractWithBlock
playerBreakBlock
playerPlaceBlock
playerInteractWithEntity
explosion
entityHurt
entityItemPickup
*/
}

world.afterEvents.itemUse.subscribe(data => {
    const p = data.source
    const i = data.itemStack
    if (i.typeId == "viberater:wand") handleWandAction(p, false)
})

function handleWandAction(p, directClaim = false) {
    try {
        if (!p?.isValid) return
    } catch (e) {
        return
    }
    const wsg = wandStates.get(p.id)
    const sneaking = isSneakingPlayer(p)
    if (sneaking && wsg?.state === "selectMultipleChunks" && wsg.selectedChunks?.length) {
        const { gCL0, gCL1, gCLs } = getSelectedChunkArea(wsg.selectedChunks)
        claimSelectedChunks(p, gCL0, gCL1, gCLs)
        return
    }
    if (sneaking && wsg?.state === "chunksSelected") {
        const { gCL0, gCL1, gCLs } = getSelectedAreaFromBlocks(wsg.bo, wsg.b)
        claimSelectedChunks(p, gCL0, gCL1, gCLs)
        return
    }
    if (!wsg) {
        const b = getWandTargetBlock(p)
        if (b) {
            const claim = getChunkClaimAt(b)
            if (claim && canEditClaim(p, claim)) {
                showSingleMainMenu(claim, p)
                return
            }
            showSingleChunkMenu(p, b)
        } else {
            showWandMainMenu(p)
        }
        return
    }
    if (wsg.state == "selectSingleChunk") {
            const b = getWandTargetBlock(p)
            if (!b) {
            toastError(p, "Look at a chunk within 64 blocks.", "claim_no_target")
                return
            }
            const claim = getChunkClaimAt(b)
            if (claim && canEditClaim(p, claim)) {
                showSingleMainMenu(claim, p)
                return
            }
            if (claim) {
                denyClaimAction(p, "This chunk is already claimed.", "claim_already_claimed")
                return
            }
            const gCLs = [getChunkLines(b)]
            drawChunkSelection(gCLs[0], p, `claim_selected_first_${p.id}`, { r: 1, g: 1, b: 1, a: 1 })
            if (wsg.interval) system.clearRun(wsg.interval)
            wandStates.set(p.id, {
                state: 'chunksSelected',
                bo: b,
                b,
                gCL0: getChunkLines(b),
                gCL1: getChunkLines(b),
                saved_gCLs: gCLs,
            })
            toastInfo(p, "Chunk selected. Sneak-use to claim it.", "claim_chunk_selected")
    }
    if (wsg.state == "selectMultipleChunks") {
            const target = getWandTargetBlock(p)
            if (!target) {
                toastError(p, "Look at a chunk within 64 blocks.", "claim_no_target")
                return
            }
            const selectedChunks = Array.isArray(wsg.selectedChunks) ? [...wsg.selectedChunks] : []
            const key = getChunkSelectionKey(target)
            if (selectedChunks.some(chunk => getChunkSelectionKey(chunk) === key)) {
                toastInfo(p, "That chunk is already selected.", "claim_chunk_duplicate")
                return
            }
            if (selectedChunks.length >= MAX_MULTI_CHUNK_SELECTION) {
                toastError(p, `A claim can include up to ${MAX_CHUNKS_PER_CLAIM} chunks.`, "claim_selection_too_large")
                return
            }
            selectedChunks.push({
                location: { x: target.location.x, y: target.location.y, z: target.location.z },
                dimension: p.dimension,
            })
            const lineId = `claim_multi_selected_${p.id}_${key}`
            drawChunkSelection(getChunkLines(target), p, lineId, { r: 1, g: 1, b: 1, a: 1 })
            wandStates.set(p.id, {
                ...wsg,
                state: "selectMultipleChunks",
                selectedChunks,
                selectedLineIds: [...(wsg.selectedLineIds || []), lineId],
            })
            toastInfo(p, `${selectedChunks.length} chunk(s) selected. Use another chunk or sneak-use to claim.`, "claim_multi_selected")
            return
    }
    if (wsg.state == 'chunksSelected') {
            const gCL0 = wsg.gCL0
            const gCL1 = wsg.gCL1
            const gCLs = wsg.saved_gCLs
            if (!gCL0 || !gCL1 || !gCLs?.length) {
                toastError(p, "The chunk selection expired. Select it again.", "claim_selection_expired")
                stopWand(p)
                return
            }
            if (gCLs.length === 1) {
                showSingleChunkMenu(p, { location: gCLs[0][0].floor, dimension: p.dimension })
                return
            }
            showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
    }
}

/** @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Block} bo @param {import('@minecraft/server').Block} b */
function showMultipleChunksMenu(p, gCL0, gCL1, gCLs, body) {
    let form = new ActionFormData()
    form.title('bd.action:Multi-Chunk Claims')
    if (body) {
        form.body(`${body}\n${formatClaimStatusLine(p, gCLs.length)}`)
    } else {
        form.body(`§dSelected Area\n${formatClaimStatusLine(p, gCLs.length)}`)
    }
    form.button(`§aConfirm Selection`)
    form.button(`§eRefresh Protection`)
    form.button(`§dAllow Lists`)
    form.button(`§bPlayer Permissions`)
    form.button(`§eShow Claimed Land`)
    form.button(`§cUnclaim Owned`)
    form.button(`§7Exit Selection`)
    form.show(p).then(data => {
        const dv = data.selection
        const pncm = p.getGameMode() != "Creative"
        if (dv == 0) {
            toastInfo(p, "Sneak-use the wand to claim the selected chunks.", "claim_multi_sneak_confirm")
            return
        }
        if (dv == 0) {
            let sC = 0
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                const cCC = lccs.filter(item => item === undefined).length
                if (cCC > MAX_CHUNKS_PER_CLAIM && pncm) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§cEach claim can include up to ${MAX_CHUNKS_PER_CLAIM} chunk(s).`)
                    return
                }
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§cThere are no unclaimed chunks in the selected area.`)
                    return
                }
                world.tickingAreaManager.createTickingArea('tempTech', { dimension: p.dimension, from: gCL0[0].floor, to: gCL1[1].ceiling }).then(() => {
                    lccs.forEach((lcc, index) => {
                        if (!lcc) {
                            const e = p.dimension.spawnEntity('viberater:land_claim_cube', { x: gCLs[index][0].floor.x + 0.5, y: -64, z: gCLs[index][0].floor.z + 0.5 })
                            e.setDynamicProperty('time', pncm ? Date.now() + (86400000 * 10) : -1)
                            e.setDynamicProperty('initialTime', Date.now())
                            e.setDynamicProperty('allowListEnabled', false)
                            e.setDynamicProperty('allowList', JSON.stringify([]))
                            e.setDynamicProperty('owner', pncm ? p.id : 'Server')
                            drawClaimBorder(e, p)
                        }
                    })
                    world.tickingAreaManager.removeTickingArea('tempTech')
                })
                if (pncm) {
                    resetLegacyClaimMemory(p)
                    successClaimAction(p, `Claimed ${cCC} chunk(s).`, "claim_multi_claimed")
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aClaimed ${cCC} chunk(s).`)
                } else {
                    successClaimAction(p, `Claimed ${cCC} server chunk(s).`, "claim_multi_server_claimed")
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aClaimed ${cCC} chunk(s) for the server.`)
                }
            })
        }
        if (dv == 1) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id).length
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§cYou do not own any chunks in the selected area.`)
                    return
                }
                lccs.forEach(lcc => {
                    if (lcc && (lcc.getDynamicProperty('owner') == p.id || !pncm)) {
                        if (lcc.getDynamicProperty('time') == -1) return
                        lcc.setProperty('viberater:active', 1)
                        lcc.setDynamicProperty('time', Date.now() + (86400000 * (10 + Math.min(20, Math.floor((Date.now() - lcc.getDynamicProperty('initialTime')) / 86400000)))))
                        sC += 1
                    }
                })
                successClaimAction(p, `Refreshed ${sC} chunk(s).`, "claim_multi_refresh")
                showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aRefreshed protection in ${sC} chunk(s).`)
            })
        }
        if (dv == 2) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id || !pncm).length
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§cYou do not own any chunks in the selected area.`)
                    return
                }
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p)
            })
        }
        if (dv == 3) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id || !pncm).length
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§cYou do not own any chunks in the selected area.`)
                    return
                }
                showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p)
            })
        }
        if (dv == 4) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let shown = 0
                lccs.forEach(lcc => {
                    if (lcc && canEditClaim(p, lcc)) {
                        drawClaimBorder(lcc, p)
                        shown += 1
                    }
                })
                toastInfo(p, `Showing ${shown} claimed chunk(s).`, "claim_show_selected")
                showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
            })
        }
        if (dv == 5) {
            form = new ActionFormData()
            form.title(`bd.action:Confirm Unclaim`)
            form.body(`§cUnclaim Selected Chunks?\n§7This removes protection.`)
            form.button(`§cConfirm Unclaim`)
            form.button(`§7Cancel`)
            form.show(p).then(data => {
                const dv = data.selection
                if (dv == 0) {
                    getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                        let sc = 0
                        lccs.forEach(lcc => {
                            if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) {
                                lcc.triggerEvent('instant_despawn')
                                sc += 1
                            }
                        })
                        resetLegacyClaimMemory(p)
                        successClaimAction(p, `Unclaimed ${sc} chunk(s).`, "claim_multi_unclaimed")
                        showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aUnclaimed ${sc} chunk(s).`)
                    })
                }
                if (dv == 1) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
                }
            })
        }
        if (dv == 6) {
            stopWand(p)
            toastInfo(p, "Claim selection closed.", "claim_selection_exit")
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ActionFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.action:Player Permissions`)
    if (body) {
        form.body(body)
    } else {
        form.body("§dPermission Manager\n§7Choose a listed player.")
    }
    let aL = []
    getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
        lccs.forEach(lcc => {
            if (lcc && (lcc.getDynamicProperty('owner') == p.id || !pncm)) {
                const aLO = JSON.parse(lcc.getDynamicProperty('allowList'))
                aL = [...new Set([...aL, ...aLO])]
            }
        })
        form.button(`§7Back`)
        aL.forEach(pN => {
            form.button(`§b${pN}`)
        })
        form.show(p).then(data => {
            const dv = data.selection
            if (dv == 0) {
                showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
            } else if (dv) {
                showMultiplePermissionsMenu(gCL0, gCL1, gCLs, p, aL[dv - 1])
            }
        })
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showMultiplePermissionsMenu(gCL0, gCL1, gCLs, p, pN) {
    let form = new ModalFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.modal:Permissions: ${pN}`)
    form.toggle('Interact with blocks', { defaultValue: true })
    form.toggle('Break blocks', { defaultValue: true })
    form.toggle('Place blocks', { defaultValue: true })
    form.toggle('Interact with entities', { defaultValue: true })
    form.toggle('Damage entities', { defaultValue: true })
    form.toggle('Pick up items', { defaultValue: true })
    form.submitButton('Save permissions')
    form.show(p).then(data => {
        const d = data.formValues
        if (d == 0) {
            showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p)
        } else if (d) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                lccs.forEach(lcc => {
                    if (lcc && (lcc.getDynamicProperty('owner') == p.id || !pncm)) {
                        lcc.setDynamicProperty("pib" + "_" + pN, d[0])
                        lcc.setDynamicProperty("pbb" + "_" + pN, d[1])
                        lcc.setDynamicProperty("ppb" + "_" + pN, d[2])
                        lcc.setDynamicProperty("pie" + "_" + pN, d[3])
                        lcc.setDynamicProperty("phe" + "_" + pN, d[4])
                        lcc.setDynamicProperty("pui" + "_" + pN, d[5])
                    }
                })
                successClaimAction(p, `Permissions saved for ${pN}.`, "claim_multi_perms_saved")
                showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p)
            })
        }
    })
    /*
playerInteractWithBlock
playerBreakBlock
playerPlaceBlock
playerInteractWithEntity
explosion
entityHurt
entityItemPickup
*/
}

function showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ActionFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.action:Allow Lists`)
    if (body) {
        form.body(`${body}\n${formatClaimStatusLine(p, gCLs.length)}`)
    } else {
        form.body(`§dBulk Access Control\n${formatClaimStatusLine(p, gCLs.length)}`)
    }
    form.button(`§aEnable Allow Lists`)
    form.button(`§cDisable Allow Lists`)
    form.button(`§aAdd Online Player`)
    form.button(`§aAdd By Name`)
    form.button(`§cRemove Online Player`)
    form.button(`§cRemove By Name`)
    form.button(`§7Back`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id).length
                lccs.forEach(lcc => {
                    if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) lcc.setDynamicProperty('allowListEnabled', true)
                })
                successClaimAction(p, `Enabled allow lists in ${cCC} chunk(s).`, "claim_multi_allow_enable")
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aEnabled allow lists in ${cCC} chunk(s).`)
            })
        }
        if (dv == 1) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id).length
                lccs.forEach(lcc => {
                    if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) lcc.setDynamicProperty('allowListEnabled', false)
                })
                toastInfo(p, `Disabled allow lists in ${cCC} chunk(s).`, "claim_multi_allow_disable")
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aDisabled allow lists in ${cCC} chunk(s).`)
            })
        }
        if (dv == 2) {
            showMultipleAddOnlinePlayersMenu(gCL0, gCL1, gCLs, p)
        }
        if (dv == 3) {
            showMultipleManuallyAddPlayersMenu(gCL0, gCL1, gCLs, p)
        }
        if (dv == 4) {
            showMultipleRemoveOnlinePlayersMenu(gCL0, gCL1, gCLs, p)
        }
        if (dv == 5) {
            showMultipleManuallyRemovePlayersMenu(gCL0, gCL1, gCLs, p)
        }
        if (dv == 6) {
            showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showMultipleManuallyRemovePlayersMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ModalFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.modal:Remove By Name`)
    form.textField(`Name`, 'Exact name')
    form.textField(`Name`, 'Exact name')
    form.textField(`Name`, 'Exact name')
    form.textField(`Name`, 'Exact name')
    form.submitButton('Remove Players')
    form.show(p).then(data => {
        const dv = data.formValues
        getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
            let sc = 0
            let ap = 'nobody'
            lccs.forEach(lcc => {
                if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) {
                    let aL = JSON.parse(lcc.getDynamicProperty('allowList'))
                    if (dv[0] || dv[1] || dv[2] || dv[3]) {
                        ap = ``
                        if (dv[0] && aL.includes(dv[0])) { aL.splice(aL.indexOf(dv[0]), 1); ap = ap.concat(dv[0]) }
                        if (dv[1] && aL.includes(dv[1])) { aL.splice(aL.indexOf(dv[1]), 1); ap = ap.concat(ap == `` ? dv[1] : (`, ` + dv[1])) }
                        if (dv[2] && aL.includes(dv[2])) { aL.splice(aL.indexOf(dv[2]), 1); ap = ap.concat(ap == `` ? dv[2] : (`, ` + dv[2])) }
                        if (dv[3] && aL.includes(dv[3])) { aL.splice(aL.indexOf(dv[3]), 1); ap = ap.concat(ap == `` ? dv[3] : (`, ` + dv[3])) }
                        lcc.setDynamicProperty('allowList', JSON.stringify(aL))
                        sc += 1
                    }
                }
            })
            if (ap == ``) ap = 'nobody'
            showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aRemoved ${ap} from allow lists in ${sc} chunks`)
        })
    })
}

function showMultipleRemoveOnlinePlayersMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ActionFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.action:Remove Online Player`)
    if (body) form.body(body)
    const aP = world.getAllPlayers()
    let aPN = []
    aP.forEach(player => {
        const pN = player.name
        if (p.name != pN) aPN.push(pN)
    })
    form.button(`§7Back`)
    aPN.forEach(pN => {
        form.button(`§cRemove ${pN}`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p)
        } else if (dv) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sc = 0
                lccs.forEach(lcc => {
                    if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) {
                        let aL = JSON.parse(lcc.getDynamicProperty('allowList'))
                        const pN = aPN[dv - 1]
                        if (aL.includes(pN)) {
                            aL.splice(aL.indexOf(pN), 1)
                            lcc.setDynamicProperty('allowList', JSON.stringify(aL))
                            sc += 1
                        }
                    }
                })
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aRemoved ${aPN[dv - 1]} from allow lists in ${sc} chunks`)
            })
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showMultipleManuallyAddPlayersMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ModalFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.modal:Add By Name`)
    form.textField(`Name`, 'Exact name')
    form.textField(`Name`, 'Exact name')
    form.textField(`Name`, 'Exact name')
    form.textField(`Name`, 'Exact name')
    form.submitButton('Add Players')
    form.show(p).then(data => {
        const dv = data.formValues
        getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
            let sc = 0
            let ap = 'nobody'
            lccs.forEach(lcc => {
                if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) {
                    let aL = JSON.parse(lcc.getDynamicProperty('allowList'))
                    if (dv[0] || dv[1] || dv[2] || dv[3]) {
                        ap = ``
                        if (dv[0] && !aL.includes(dv[0])) { aL.push(dv[0]); ap = ap.concat(dv[0]) }
                        if (dv[1] && !aL.includes(dv[1])) { aL.push(dv[1]); ap = ap.concat(ap == `` ? dv[1] : (`, ` + dv[1])) }
                        if (dv[2] && !aL.includes(dv[2])) { aL.push(dv[2]); ap = ap.concat(ap == `` ? dv[2] : (`, ` + dv[2])) }
                        if (dv[3] && !aL.includes(dv[3])) { aL.push(dv[3]); ap = ap.concat(ap == `` ? dv[3] : (`, ` + dv[3])) }
                        lcc.setDynamicProperty('allowList', JSON.stringify(aL))
                        sc += 1
                    }
                }
            })
            if (ap == ``) ap = 'nobody'
            showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aAdded ${ap} to allow lists in ${sc} chunks`)
        })
    })
}

/** @param {import('@minecraft/server').Player} p */
function showMultipleAddOnlinePlayersMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ActionFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.action:Add Online Player`)
    if (body) form.body(body)
    const aP = world.getAllPlayers()
    let aPN = []
    aP.forEach(player => {
        const pN = player.name
        if (p.name != pN) aPN.push(pN)
    })
    form.button(`§7Back`)
    aPN.forEach(pN => {
        form.button(`§aAdd ${pN}`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p)
        } else if (dv) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sc = 0
                lccs.forEach(lcc => {
                    if (lcc && (lcc.getDynamicProperty('owner') === p.id || !pncm)) {
                        let aL = JSON.parse(lcc.getDynamicProperty('allowList'))
                        const pN = aPN[dv - 1]
                        if (!aL.includes(pN)) {
                            aL.push(pN)
                            lcc.setDynamicProperty('allowList', JSON.stringify(aL))
                            sc += 1
                        }
                    }
                })
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aAdded ${aPN[dv - 1]} to allow lists in ${sc} chunks`)
            })
        }
    })
}

/** @param {import('@minecraft/server').Block} b */
async function getLCCs(gCL0, gCL1, gCLs, b) {
    /** @type {import('@minecraft/server').Entity[]} */
    let lccs = []
    await world.tickingAreaManager.createTickingArea('tempTech', { dimension: b.dimension, from: gCL0[0].floor, to: gCL1[1].ceiling }).then(() => {
        gCLs.forEach((gCL, index1) => {
            const e = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
            lccs.push(e)
        })
    })
    world.tickingAreaManager.removeTickingArea('tempTech')
    return lccs
}

/** @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Block} b */
function showSingleChunkMenu(p, b) {
    const gCL = getChunkLines(b)
    const pncm = p.getGameMode() != "Creative"
    const lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) {
        if (lcc.getDynamicProperty('owner') == p.id || !pncm) {
            showSingleMainMenu(lcc, p)
        } else {
            denyClaimAction(p, "This chunk is already claimed.", "claim_already_claimed")
        }
    } else {
        showUSCMainMenu(p, gCL)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe(data => {
    const p = data.entity
    const event = data.eventId
    if (p.typeId == 'minecraft:player' && event == 'attack_start') {
        const i = p.getComponent('equippable').getEquipment('Mainhand')
        if (!i) return
        if (i.typeId != "viberater:wand") return
        handleWandAction(p, true)
    }
})

world.afterEvents.playerHotbarSelectedSlotChange.subscribe(data => {
    const p = data.player
    stopWand(p)
})

world.afterEvents.playerDimensionChange.subscribe(data => {
    const p = data.player
    stopWand(p)
})

/** @param {import('@minecraft/server').Player} p */
function stopWand(p) {
    const wSG = wandStates.get(p.id)
    if (wSG) {
        if (wSG.state == "chunksSelected") {
            wSG.saved_gCLs.forEach((gCL, index1) => {
                gCL.forEach((line, index2) => {
                    removeLine(p.id.toString() + "_" + "gCLs" + "_" + index1.toString() + "_" + index2.toString())
                })
            })
        }
        if (wSG.interval) {
            system.clearRun(wSG.interval)
        }
        for (const lineId of wSG.selectedLineIds || []) {
            for (let i = 0; i < 4; i++) {
                removeLine(`${lineId}_${i}`)
            }
        }
        for (let i = 0; i < 4; i++) {
            removeLine(`claim_selected_first_${p.id}_${i}`)
        }
        wandStates.delete(p.id)
    }
}

/** @param {import('@minecraft/server').Player} p */
function showUSCMainMenu(p, gCL = getChunkLines()) {
    let form = new ActionFormData()
    form.title('bd.action:Unclaimed Chunk')
    form.body(`§dAvailable Chunk\n§7Not protected.\n§7Choose the claim size:\n${formatClaimStatusLine(p, 1)}`)
    form.button('§aClaim One Chunk')
    form.button('§dClaim Multiple Chunks')
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            drawChunkSelection(gCL, p, `claim_selected_first_${p.id}`, { r: 1, g: 1, b: 1, a: 1 })
            wandStates.set(p.id, {
                state: 'chunksSelected',
                bo: { location: gCL[0].floor, dimension: p.dimension },
                b: { location: gCL[0].floor, dimension: p.dimension },
                saved_gCLs: [gCL],
            })
            toastInfo(p, "Chunk selected. Sneak-use to claim it.", "claim_chunk_selected")
        }
        if (dv == 1) {
            drawChunkSelection(gCL, p, `claim_selected_first_${p.id}`, { r: 1, g: 1, b: 1, a: 1 })
            wandStates.set(p.id, {
                state: 'selectMultipleChunks',
                selectedChunks: [{ location: gCL[0].floor, dimension: p.dimension }],
                selectedLineIds: [`claim_selected_first_${p.id}`],
            })
            toastInfo(p, "1 chunk selected. Use another chunk or sneak-use to claim.", "claim_multi_first_selected")
        }
    })
}

/** @param {import('@minecraft/server').Player} p */
function showWandMainMenu(p) {
    resetLegacyClaimMemory(p)
    let form = new ActionFormData()
    form.title('bd.action:Claim Wand')
    form.body(`§dChunk Claim Tool\n${formatClaimStatusLine(p, 1)}`)
    form.button('§aClaim One Chunk')
    form.button('§dClaim Multiple Chunks')
    form.button('§eShow Claimed Land')
    form.button('§7Exit')
    form.show(p).then(data => {
        const dv = data.selection
        if (dv <= 1) {
            const wandPlayerId = p.id
            wandStates.set(p.id, {
                state: dv == 0 ? 'selectSingleChunk' : 'selectMultipleChunks',
                interval: system.runInterval(() => {
                    try {
                        if (!p?.isValid) throw new Error("invalid wand player")
                        const b = getWandTargetBlock(p)
                        if (!b) return
                        p.dimension.getEntities({ "location": p.location, "type": "viberater:land_claim_cube" }).forEach(oc => {
                            let rgba = undefined
                            if (oc.getDynamicProperty('owner') == p.id) {
                                rgba = { r: 0, g: 0.2, b: 1, a: 1 }
                            } else if (oc.getDynamicProperty('owner') == "Server") {
                                rgba = { r: 0.5, g: 0, b: 1, a: 1 }
                            } else {
                                rgba = { r: 1, g: 0, b: 0, a: 1 }
                            }
                            getChunkLines(oc).forEach((fc, index) => {
                                addLine(fc, 0.3, rgba, p.dimension, undefined, [p], 396)
                            })
                        })
                        getChunkLines(b).forEach((fc, index) => {
                            addLine(fc, 0.3, { r: 1, g: 1, b: 1, a: 1 }, p.dimension, undefined, [p], 396)
                        })
                    } catch (e) {
                        const staleState = wandStates.get(wandPlayerId)
                        if (staleState?.interval) system.clearRun(staleState.interval)
                        wandStates.delete(wandPlayerId)
                    }
                }, 5)
            })
            toastInfo(p, "Look at a chunk and press Use to select.", "claim_select_start")
        }
        if (dv == 2) {
            showLoadedClaimBorders(p)
            showWandMainMenu(p)
        }
        if (dv == 3) {
            stopWand(p)
            toastInfo(p, "Claim wand closed.", "claim_wand_exit")
        }
    })
}

function vec2BoundsCheck(p, a, b) {
    return (
        p.x >= Math.min(a.x, b.x) &&
        p.x <= Math.max(a.x, b.x) &&
        p.z >= Math.min(a.z, b.z) &&
        p.z <= Math.max(a.z, b.z)
    )
}
