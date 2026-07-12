import { DimensionType, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData, ActionFormResponse } from "@minecraft/server-ui"
import { important_blocks_and_entities } from "./data";
import { getChunkLines, addLine, removeLine } from "./line_drawing"

const chunksToDraw = new Map()
const wandStates = new Map()

world.beforeEvents.playerInteractWithBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    const gCL = getChunkLines(b)
    const lcc = b.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (lcc) if (checkIfAllowed(p, lcc, "pib", p.name)) {
        data.cancel = true
        p.sendMessage(`§4You may not interact with this block as it is within protected chunks that you are not allowed to access`)
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p])
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
        p.sendMessage(`§4You may not break this block as it is within protected chunks that you are not allowed to access`)
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p])
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
        p.sendMessage(`§4You may not place this block as it is within protected chunks that you are not allowed to access`)
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            gCL.forEach(line => {
                addLine(line, 5, { r: 1, g: 0, b: 0, a: 1 }, lcc.dimension, undefined, [p])
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
        p.sendMessage(`§4You may not interact with this entity as it is within protected chunks that you are not allowed to access`)
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p])
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
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p])
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
    const gCL = getChunkLines(e)
    const lcc = e.dimension.getEntities({ "location": { x: gCL[0].floor.x + 0.5, y: gCL[0].floor.y, z: gCL[0].floor.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    const families = e.getComponent('type_family').getTypeFamilies()
    if (lcc) if (checkIfAllowed(p, lcc, "phe", p.name)) {
        p.sendMessage(`§4You may not hurt this entity as it is within protected chunks that you are not allowed to access`)
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
            p.sendMessage(`§4You may not pick up this item as it is within protected chunks that you are not allowed to access`)
        }
        gCL.forEach(line => {
            addLine(line, 5, { "r": 1, "g": 0, "b": 0, "a": 1 }, lcc.dimension, undefined, [p])
        })
    }
})

/** @param {string[]} allowList @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Entity} lcc */
function checkIfAllowed(p, lcc, ppc, pN) {
    if (p == undefined || lcc == undefined) return false
    const allowList = JSON.parse(lcc.getDynamicProperty('allowList') ?? [])
    let allowed = false
    if (lcc.getDynamicProperty('allowListEnabled')) {
        const allowList = JSON.parse(lcc.getDynamicProperty('allowList') ?? [])
        allowList.forEach(n => {
            world.sendMessage(`list ${lcc.getDynamicPropertyIds()}`)
            world.sendMessage(`value ${lcc.getDynamicProperty(ppc + "_" + pN)}`)
            world.sendMessage(`ppc ${ppc}`)
            world.sendMessage(`pN ${pN}`)
            if (n === p.name && (lcc.getDynamicProperty(ppc + "_" + pN) ?? true)) {
                allowed = true
            }
        })
    }
    //if ((lcc?.getDynamicProperty('owner') ?? 0) == p.id) allowed = true
    return (!allowed && (Date.now() <= lcc.getDynamicProperty('time')))
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
    form.title(`bd.action:Claimed Chunk Owner Main Menu`)
    form.body(`Protection time left: ${Math.ceil(Math.max(0, (e.getDynamicProperty('time') - Date.now()) / 3600000))} hour(s)`)
    form.button(`Reset protection time to ${(10 + Math.min(20, Math.floor((Date.now() - e.getDynamicProperty('initialTime')) / 86400000))) * 24} hours for this chunk`)
    form.button(`Adjust allow list`)
    form.button(`Adjust visitor permissions`)
    form.button(`Show this chunk's borders`)
    form.button(`Remove this claim`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            e.setProperty('viberater:active', 1)
            e.setDynamicProperty('time', pncm ? (Date.now() + (86400000 * (10 + Math.min(20, Math.floor((Date.now() - e.getDynamicProperty('initialTime')) / 86400000))))) : Infinity)
            e.dimension.playSound('beacon.activate', e.location)
            showSingleMainMenu(e, p)
        }
        if (dv == 1) {
            showSingleAdjustAllowListMenu(e, p)
        }
        if (dv == 2) {
            showSingleSelectPlayerMenu(e, p)
        }
        if (dv == 3) {
            const gCL = getChunkLines(e)
            gCL.forEach((line, index) => {
                addLine(line, undefined, { r: 0, g: 1, b: 0, a: 1 }, e.dimension, e.id.toString() + "_" + index.toString(), [p])
            })
        } else {
            const gCL = getChunkLines(e)
            gCL.forEach((line, index) => {
                removeLine(e.id.toString() + "_" + index.toString())
            })
        }
        if (dv == 4) {
            e.triggerEvent('instant_despawn')
            const placedCount = (p.getDynamicProperty('land_claim_cubes') ?? 0)
            p.sendMessage(`§aChunk unclaimed. You may claim up to ${16 - (placedCount - 1)} more chunks.`)
            p.setDynamicProperty('land_claim_cubes', placedCount - 1)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleAdjustAllowListMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Adjust Allow List Menu`)
    let allowList = JSON.parse(e.getDynamicProperty('allowList'))
    form.body(`Allow list: ${allowList.toLocaleString()}`)
    const aLE = e.getDynamicProperty('allowListEnabled')
    form.button(`${aLE ? 'Disable' : 'Enable'} allow list in this chunk`)
    form.button(`Add online players to allow list`)
    form.button(`Manually add players to allow list`)
    form.button(`Remove players from allow list`)
    form.button(`Back to main menu`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            e.setDynamicProperty('allowListEnabled', !aLE)
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
            showSingleMainMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleAddOnlinePlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Add Online Players to Allow List`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.body(`Allow list: ${aL.toLocaleString()}\nPlayers will be added to this chunk's allow list`)
    const aP = world.getAllPlayers()
    let aPN = []
    aP.forEach(player => {
        const pN = player.name
        if (p.name != pN && !aL.includes(pN)) aPN.push(pN)
    })
    form.button(`Back to allow list menu`)
    aPN.forEach(pN => {
        form.button(`Add ${pN} to allow lists `)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showSingleAdjustAllowListMenu(e, p)
        } else if (dv) {
            aL.push(aPN[dv - 1])
            e.setDynamicProperty('allowList', JSON.stringify(aL))
            showSingleAddOnlinePlayersMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleManuallyAddPlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ModalFormData()
    form.title(`bd.modal:Manually Add Players to Allow List`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.textField(`Allow List: ${aL.toLocaleString()}\nNames will be added to this chunk''s allow list\nName: `, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.submitButton('Submit names and go back to allow list menu')
    form.show(p).then(data => {
        const dv = data.formValues
        try {
            if (dv[0] || dv[1] || dv[2] || dv[3]) {
                if (dv[0]) aL.push(dv[0])
                if (dv[1]) aL.push(dv[1])
                if (dv[2]) aL.push(dv[2])
                if (dv[3]) aL.push(dv[3])
                e.setDynamicProperty('allowList', JSON.stringify(aL))
            }
            showSingleAdjustAllowListMenu(e, p)
        } catch { }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleRemovePlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Remove Players from Allow List`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.body(`Allow list: ${aL.toLocaleString()}`)
    form.button(`Back to allow list menu`)
    aL.forEach(pN => {
        form.button(`Remove ${pN} from this chunk's allow list`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showSingleAdjustAllowListMenu(e, p)
        } else if (dv) {
            aL.splice(dv - 1, 1)
            e.setDynamicProperty('allowList', JSON.stringify(aL))
            showSingleRemovePlayersMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSingleSelectPlayerMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Select Player to Adjust Permissions`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.button(`Back to allow list menu`)
    aL.forEach(pN => {
        form.button(`Adjust ${pN}'s permission`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showSingleMainMenu(e, p)
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
    form.title(`bd.modal:Adjust ${aL[dv - 1]}'s permissions`)
    form.toggle('Can interact with blocks', { defaultValue: e.getDynamicProperty("pib" + "_" + aL[dv - 1]) })
    form.toggle('Can break blocks', { defaultValue: e.getDynamicProperty("pbb" + "_" + aL[dv - 1]) })
    form.toggle('Can place blocks', { defaultValue: e.getDynamicProperty("ppb" + "_" + aL[dv - 1]) })
    form.toggle('Can interact with entities', { defaultValue: e.getDynamicProperty("pie" + "_" + aL[dv - 1]) })
    form.toggle('Can hurt entities', { defaultValue: e.getDynamicProperty("phe" + "_" + aL[dv - 1]) })
    form.toggle('Can pick up items', { defaultValue: e.getDynamicProperty("pui" + "_" + aL[dv - 1]) })
    form.submitButton('Apply permissions to this chunk and go back')
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
    if (i.typeId == "viberater:wand") {
        const wsg = wandStates.get(p.id)
        if (!wsg) return
        if (wsg.state == "selectSingleChunk") {
            const b = p.getBlockFromViewDirection({ "maxDistance": 64, "includePassableBlocks": !p.isInWater, "includeLiquidBlocks": !p.isInWater })?.block
            if (!b) {
                p.sendMessage(`§4Failed to get chunk. Look at a chunk within a 64 block distance.`)
                return
            }
            showSingleChunkMenu(p, b)
        }
        if (wsg.state == "selectMultipleChunks") {
            const bo = p.getBlockFromViewDirection({ "maxDistance": 64, "includePassableBlocks": !p.isInWater, "includeLiquidBlocks": !p.isInWater })?.block
            if (!bo) {
                p.sendMessage(`§4Failed to get chunk. Look at a chunk within a 64 block distance.`)
                return
            }
            system.clearRun(wsg.interval)
            wandStates.set(p.id, {
                state: 'selectSecondChunk',
                bo: bo,
                interval: system.runInterval(() => {
                    const b = p.getBlockFromViewDirection({ "maxDistance": 64, "includePassableBlocks": !p.isInWater, "includeLiquidBlocks": !p.isInWater })?.block
                    p.dimension.getEntities({ "location": p.location, "type": "viberater:land_claim_cube" }).forEach(oc => {
                        let rgba = undefined
                        if (oc.getDynamicProperty('owner') == p.id) {
                            rgba = { r: 0, g: 0.2, b: 1, a: 1 }
                        } else if (oc.getDynamicProperty('owner') == "Server") {
                            rgba = { r: 1, g: 0, b: 1, a: 1 }
                        } else {
                            rgba = { r: 1, g: 0, b: 0, a: 1 }
                        }
                        getChunkLines(oc).forEach((fc, index) => {
                            addLine(fc, 0.3, rgba, p.dimension, undefined, [p])
                        })
                    })
                    if (!b) return
                    getChunkLines(b).forEach((fc, index) => {
                        addLine(fc, 0.3, { r: 1, g: 1, b: 1, a: 1 }, undefined, [p])
                    })
                    getChunkLines(bo).forEach((fc, index) => {
                        addLine(fc, 0.3, { r: 1, g: 1, b: 1, a: 1 }, undefined, [p])
                    })
                }, 5)
            })
            p.sendMessage(`§aLook at a block within a chunk and press 'Use' to select.`)
        }
        if (wsg.state == 'selectSecondChunk') {
            const b = p.getBlockFromViewDirection({ "maxDistance": 64, "includePassableBlocks": !p.isInWater, "includeLiquidBlocks": !p.isInWater })?.block
            if (!b) {
                p.sendMessage(`§4Failed to get chunk. Look at a chunk within a 64 block distance.`)
                return
            }
            system.clearRun(wsg.interval)
            const gCL0 = getChunkLines({
                "location": {
                    x: Math.min(wsg.bo.location.x, b.location.x),
                    z: Math.min(wsg.bo.location.z, b.location.z)
                }
            })
            const gCL1 = getChunkLines({
                "location": {
                    x: Math.max(wsg.bo.location.x, b.location.x),
                    z: Math.max(wsg.bo.location.z, b.location.z)
                }
            })
            let gCLs = []
            let iSC = [false, false, false, false]
            gCL0.forEach((line, index) => {
                iSC[index] = (gCL0[index].floor.x == gCL1[index].floor.x) && (gCL0[index].floor.y == gCL1[index].floor.y) && (gCL0[index].floor.z == gCL1[index].floor.z)
            })
            if (iSC.indexOf(false) == -1) {
                showSingleChunkMenu(p, b)
                return
            }
            for (let i = 0; gCL0[0].floor.x + i <= gCL1[0].floor.x; i += 16) {
                for (let j = 0; gCL0[0].floor.z + j <= gCL1[0].floor.z; j += 16) {
                    gCLs.push(getChunkLines(
                        {
                            "location": {
                                x: gCL0[0].floor.x + i + 0.5,
                                z: gCL0[0].floor.z + j + 0.5
                            }
                        }
                    ))
                }
            }
            if (gCLs.length > 100) {
                p.sendMessage(`§4You may only select up to 100 chunks at a time.`)
            }
            gCLs.forEach((gCL, index1) => {
                gCL.forEach((line, index2) => {
                    addLine(line, undefined, { r: 1, g: 1, b: 1, a: 1 }, p.dimension, p.id.toString() + "_" + "gCLs" + "_" + index1.toString() + "_" + index2.toString(), [p])
                })
            })
            wandStates.set(p.id, {
                state: 'chunksSelected',
                bo: wsg.bo,
                b: b,
                saved_gCLs: gCLs,
                interval: system.runInterval(() => {
                    const b = p.getBlockFromViewDirection({ "maxDistance": 64, "includePassableBlocks": !p.isInWater, "includeLiquidBlocks": !p.isInWater })?.block
                    if (!b) return
                    getChunkLines(wsg.bo).forEach((fc, index) => {
                        addLine(fc, 0.3, { r: 1, g: 1, b: 1, a: 1 }, undefined, [p])
                    })
                }, 5)
            })
            showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
        }
        if (wsg.state == 'chunksSelected') {
            const gCL0 = getChunkLines({
                "location": {
                    x: Math.min(wsg.bo.location.x, wsg.b.location.x),
                    z: Math.min(wsg.bo.location.z, wsg.b.location.z)
                }
            })
            const gCL1 = getChunkLines({
                "location": {
                    x: Math.max(wsg.bo.location.x, wsg.b.location.x),
                    z: Math.max(wsg.bo.location.z, wsg.b.location.z)
                }
            })
            let gCLs = []
            let iSC = [false, false, false, false]
            gCL0.forEach((line, index) => {
                iSC[index] = (gCL0[index].floor.x == gCL1[index].floor.x) && (gCL0[index].floor.y == gCL1[index].floor.y) && (gCL0[index].floor.z == gCL1[index].floor.z)
            })
            if (iSC.indexOf(false) == -1) {
                showSingleChunkMenu(p, b)
                return
            }
            for (let i = 0; gCL0[0].floor.x + i <= gCL1[0].floor.x; i += 16) {
                for (let j = 0; gCL0[0].floor.z + j <= gCL1[0].floor.z; j += 16) {
                    gCLs.push(getChunkLines(
                        {
                            "location": {
                                x: gCL0[0].floor.x + i + 0.5,
                                z: gCL0[0].floor.z + j + 0.5
                            }
                        }
                    ))
                }
            }
            if (gCLs.length > 100) {
                p.sendMessage(`§4You may only select up to 100 chunks at a time.`)
            }
            showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
        }
    }
})

/** @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Block} bo @param {import('@minecraft/server').Block} b */
function showMultipleChunksMenu(p, gCL0, gCL1, gCLs, body) {
    let form = new ActionFormData()
    form.title('bd.action:Multi-chunk options menu')
    if (body) {
        form.body(body)
    } else {
        form.body(`${gCLs.length} chunks selected`)
    }
    form.button(`Claim available chunks`)
    form.button(`Reset protection times for selected chunks`)
    form.button(`Adjust allow lists for selected chunks`)
    form.button(`Adjust visitor permissions for selected chunks`)
    form.button(`Unclaim all selected and owned chunks`)
    form.show(p).then(data => {
        const dv = data.selection
        const pncm = p.getGameMode() != "Creative"
        if (dv == 0) {
            let sC = 0
            const placedCount = (p.getDynamicProperty('land_claim_cubes') ?? 0)
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                const cCC = lccs.filter(item => item === undefined).length
                if (cCC + placedCount > 16 && pncm) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§4You are only allowed to claim up to 16 chunks`)
                    return
                }
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§4There are no unclaimed chunks in selected area`)
                    return
                }
                world.tickingAreaManager.createTickingArea('tempTech', { dimension: p.dimension, from: gCL0[0].floor, to: gCL1[1].ceiling }).then(() => {
                    lccs.forEach((lcc, index) => {
                        if (!lcc) {
                            const e = p.dimension.spawnEntity('viberater:land_claim_cube', { x: gCLs[index][0].floor.x + 0.5, y: -64, z: gCLs[index][0].floor.z + 0.5 })
                            e.setDynamicProperty('time', pncm ? Date.now() + (86400000 * 10) : Infinity)
                            e.setDynamicProperty('initialTime', Date.now())
                            e.setDynamicProperty('allowListEnabled', false)
                            e.setDynamicProperty('allowList', JSON.stringify([]))
                            e.setDynamicProperty('owner', pncm ? p.id : 'Server')
                            getChunkLines(e).forEach((fc, index) => {
                                addLine(fc, 5, { r: 0, g: 1, b: 0, a: 1 }, undefined, [p])
                            })
                        }
                    })
                    world.tickingAreaManager.removeTickingArea('tempTech')
                })
                if (pncm) {
                    p.setDynamicProperty('land_claim_cubes', placedCount + cCC)
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aYou just claimed ${cCC} chunks. You may claim ${16 - (placedCount + cCC)} more chunks.`)
                } else {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aYou just claimed ${cCC} chunks for the server.`)
                }
            })
        }
        if (dv == 1) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id).length
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§4You do not own any chunks in selected region`)
                    return
                }
                lccs.forEach(lcc => {
                    if (lcc?.getDynamicProperty('owner') == p.id || !pncm) {
                        if (lcc.setDynamicProperty('time') == Infinity) return
                        lcc.setProperty('viberater:active', 1)
                        lcc.setDynamicProperty('time', Date.now() + (86400000 * (10 + Math.min(20, Math.floor((Date.now() - lcc.getDynamicProperty('initialTime')) / 86400000)))))
                        sC += 1
                    }
                })
                showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aReset protection time in ${sC} chunks`)
            })
        }
        if (dv == 2) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id || !pncm).length
                if (cCC == 0) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§4You do not own any chunks in selected region`)
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
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§4You do not own any chunks in selected region`)
                    return
                }
                showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p)
            })
        }
        if (dv == 4) {
            form = new ActionFormData()
            form.title(`Area Unclaim Confirmation`)
            form.body('Are you sure you want to unclaim the entire selected area?')
            form.button(`Yes`)
            form.button(`No`)
            form.show(p).then(data => {
                const dv = data.selection
                if (dv == 0) {
                    getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                        let sc = 0
                        lccs.forEach(lcc => {
                            if (lcc?.getDynamicProperty('owner') === p.id || !pncm) {
                                lcc.triggerEvent('instant_despawn')
                                const placedCount = (p.getDynamicProperty('land_claim_cubes') ?? 0)
                                p.setDynamicProperty('land_claim_cubes', placedCount - 1)
                                sc += 1
                            }
                        })
                        showMultipleChunksMenu(p, gCL0, gCL1, gCLs, `§aUnclaimed ${sc} chunks. You may claim ${16 - p.getDynamicProperty('land_claim_cubes')} more chunks`)
                    })
                }
                if (dv == 1) {
                    showMultipleChunksMenu(p, gCL0, gCL1, gCLs)
                }
            })
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p, body) {
    let form = new ActionFormData()
    const pncm = p.getGameMode() != "Creative"
    form.title(`bd.action:Select Player to Adjust Permissions`)
    if (body) {
        form.body(body)
    } else {
        form.body("§ePermissions won't apply until that chunk has selected player added to its allow list.")
    }
    let aL = []
    getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
        lccs.forEach(lcc => {
            if (lcc?.getDynamicProperty('owner') == p.id || !pncm) {
                const aLO = JSON.parse(lcc.getDynamicProperty('allowList'))
                aL = [...new Set([...aL, ...aLO])]
            }
        })
        form.button(`Back to allow list menu`)
        aL.forEach(pN => {
            form.button(`Adjust ${pN}'s permissions`)
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
    form.title(`bd.modal:Adjust ${pN}'s permissions`)
    form.toggle('Can interact with blocks', { defaultValue: true })
    form.toggle('Can break blocks', { defaultValue: true })
    form.toggle('Can place blocks', { defaultValue: true })
    form.toggle('Can interact with entities', { defaultValue: true })
    form.toggle('Can hurt entities', { defaultValue: true })
    form.toggle('Can pick up items', { defaultValue: true })
    form.submitButton('Apply permissions to chunks and go back')
    form.show(p).then(data => {
        const d = data.formValues
        if (d == 0) {
            showMultipleSelectPlayerMenu(gCL0, gCL1, gCLs, p)
        } else if (d) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sC = 0
                lccs.forEach(lcc => {
                    if (lcc?.getDynamicProperty('owner') == p.id || !pncm) {
                        lcc.setDynamicProperty("pib" + "_" + pN, d[0])
                        lcc.setDynamicProperty("pbb" + "_" + pN, d[1])
                        lcc.setDynamicProperty("ppb" + "_" + pN, d[2])
                        lcc.setDynamicProperty("pie" + "_" + pN, d[3])
                        lcc.setDynamicProperty("phe" + "_" + pN, d[4])
                        lcc.setDynamicProperty("pui" + "_" + pN, d[5])
                    }
                })
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
    form.title(`bd.action:Adjust Allow Lists Menu`)
    if (body) form.body(body)
    form.button(`Enable allow lists in these chunks`)
    form.button(`Disable allow lists in these chunks`)
    form.button(`Add online players to allow lists`)
    form.button(`Manually add players to allow lists`)
    form.button(`Remove online players from allow lists`)
    form.button(`Manually remove players from allow lists`)
    form.button(`Back to main menu`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id).length
                lccs.forEach(lcc => {
                    if (lcc?.getDynamicProperty('owner') === p.id || !pncm) lcc.setDynamicProperty('allowListEnabled', false)
                })
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aEnabled allow lists in ${cCC} chunks`)
            })
        }
        if (dv == 1) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                const cCC = lccs.filter(lcc => lcc?.getDynamicProperty('owner') === p.id).length
                lccs.forEach(lcc => {
                    if (lcc?.getDynamicProperty('owner') === p.id || !pncm) lcc.setDynamicProperty('allowListEnabled', false)
                })
                showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p, `§aDisabled allow lists in ${cCC} chunks`)
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
    form.title(`bd.modal:Manually Remove Players from Allow Lists`)
    form.textField(`Name: `, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.submitButton('Submit names and go back to allow lists menu')
    form.show(p).then(data => {
        const dv = data.formValues
        getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
            let sc = 0
            let ap = 'nobody'
            lccs.forEach(lcc => {
                if (lcc?.getDynamicProperty('owner') === p.id || !pncm) {
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
    form.title(`bd.action:Remove Online Players from Allow Lists`)
    if (body) form.body(body)
    const aP = world.getAllPlayers()
    let aPN = []
    aP.forEach(player => {
        const pN = player.name
        if (p.name != pN) aPN.push(pN)
    })
    form.button(`Back to allow lists menu`)
    aPN.forEach(pN => {
        form.button(`Remove ${pN} from allow lists `)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p)
        } else if (dv) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sc = 0
                lccs.forEach(lcc => {
                    if (lcc?.getDynamicProperty('owner') === p.id || !pncm) {
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
    form.title(`bd.modal:Manually Add Players to Allow Lists`)
    form.textField(`Name: `, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.textField(`Name:`, 'Type name here - must be exact')
    form.submitButton('Submit names and go back to allow lists menu')
    form.show(p).then(data => {
        const dv = data.formValues
        getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
            let sc = 0
            let ap = 'nobody'
            lccs.forEach(lcc => {
                if (lcc?.getDynamicProperty('owner') === p.id || !pncm) {
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
    form.title(`bd.action:Add Online Players to Allow Lists`)
    if (body) form.body(body)
    const aP = world.getAllPlayers()
    let aPN = []
    aP.forEach(player => {
        const pN = player.name
        if (p.name != pN) aPN.push(pN)
    })
    form.button(`Back to allow lists menu`)
    aPN.forEach(pN => {
        form.button(`Add ${pN} to allow lists `)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showMultipleAdjustAllowListMenu(gCL0, gCL1, gCLs, p)
        } else if (dv) {
            getLCCs(gCL0, gCL1, gCLs, p).then(lccs => {
                let sc = 0
                lccs.forEach(lcc => {
                    if (lcc?.getDynamicProperty('owner') === p.id || !pncm) {
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
            p.sendMessage(`§4This chunk is already claimed`)
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
        stopWand(p)
        showWandMainMenu(p)
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
        wandStates.delete(p.id)
    }
}

/** @param {import('@minecraft/server').Player} p */
function showUSCMainMenu(p, gCL = getChunkLines()) {
    let form = new ActionFormData()
    form.title('bd.action:Unclaimed Single Chunk Menu')
    form.button('Claim Chunk')
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            const placedCount = (p.getDynamicProperty('land_claim_cubes') ?? 0) + 1
            if (placedCount > 16) {
                p.sendMessage(`§4You may not claim more than 16 chunks.`)
            } else {
                const e = p.dimension.spawnEntity('viberater:land_claim_cube', { x: gCL[0].floor.x + 0.5, y: -64, z: gCL[0].floor.z + 0.5 })
                p.setDynamicProperty('land_claim_cubes', placedCount)
                e.setDynamicProperty('time', Date.now() + (86400000 * 10))
                e.setDynamicProperty('initialTime', Date.now())
                e.setDynamicProperty('allowListEnabled', false)
                e.setDynamicProperty('allowList', JSON.stringify([]))
                p.sendMessage(`§aYou've claimed a chunk ${placedCount}/16`)
                e.setDynamicProperty('owner', p.id)
            }
        }
    })
}

/** @param {import('@minecraft/server').Player} p */
function showWandMainMenu(p) {
    let form = new ActionFormData()
    form.title('bd.action:Wand Main Menu')
    form.button('Select single chunk')
    form.button('Select multiple chunks')
    form.show(p).then(data => {
        const dv = data.selection
        if (dv <= 1) {
            wandStates.set(p.id, {
                state: dv == 0 ? 'selectSingleChunk' : 'selectMultipleChunks',
                interval: system.runInterval(() => {
                    const b = p.getBlockFromViewDirection({ "maxDistance": 64, "includePassableBlocks": !p.isInWater, "includeLiquidBlocks": !p.isInWater })?.block
                    p.dimension.getEntities({ "location": p.location, "type": "viberater:land_claim_cube" }).forEach(oc => {
                        let rgba = undefined
                        if (oc.getDynamicProperty('owner') == p.id) {
                            rgba = { r: 0, g: 0.2, b: 1, a: 1 }
                        } else if (oc.getDynamicProperty('owner') == "Server") {
                            rgba = { r: 1, g: 0, b: 1, a: 1 }
                        } else {
                            rgba = { r: 1, g: 0, b: 0, a: 1 }
                        }
                        getChunkLines(oc).forEach((fc, index) => {
                            addLine(fc, 0.3, rgba, p.dimension, undefined, [p])
                        })
                    })
                    if (!b) return
                    getChunkLines(b).forEach((fc, index) => {
                        addLine(fc, 0.3, { r: 1, g: 1, b: 1, a: 1 }, undefined, [p])
                    })
                }, 5)
            })
            p.sendMessage(`§aLook at a block within a chunk and press 'Use' to select.`)
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