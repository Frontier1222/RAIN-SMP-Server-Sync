import { DimensionType, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui"
import { debugDrawer, DebugBox, DebugLine, DebugArrow } from "@minecraft/debug-utilities"
import { important_blocks_and_entities } from "./utils/data/data.js";

world.beforeEvents.playerInteractWithBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    const v = drawChunkBounds(b, 0)
    const lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (checkIfAllowed(p, lcc, "pib")) {
        data.cancel = true
        p.sendMessage(`§4You may not interact with this block as it is within protected chunks that you are not allowed to access`)
        drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
    }
})

world.beforeEvents.playerBreakBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    const v = drawChunkBounds(b, 0)
    const lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (checkIfAllowed(p, lcc, "pbb")) {
        data.cancel = true
        p.sendMessage(`§4You may not break this block as it is within protected chunks that you are not allowed to access`)
        drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
    }
})

world.beforeEvents.playerPlaceBlock.subscribe(data => {
    const p = data.player
    const b = data.block
    let v = drawChunkBounds(b, 0)
    let lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (checkIfAllowed(p, lcc, "pbb")) {
        data.cancel = true
        p.sendMessage(`§4You may not place this block as it is within protected chunks that you are not allowed to access`)
        drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
        return
    }
    const item = data.permutationToPlace.getItemStack()
    if (item.typeId == 'minecraft:piston' || item.typeId == 'minecraft:sticky_piston') {
        v = drawChunkBounds({
            location: {
                x: b.location.x + 16,
                y: b.location.y,
                z: b.location.z
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x - 16,
                y: b.location.y,
                z: b.location.z
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x,
                y: b.location.y,
                z: b.location.z + 16
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x,
                y: b.location.y,
                z: b.location.z - 16
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x + 16,
                y: b.location.y,
                z: b.location.z + 16
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x - 16,
                y: b.location.y,
                z: b.location.z + 16
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x + 16,
                y: b.location.y,
                z: b.location.z - 16
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
        v = drawChunkBounds({
            location: {
                x: b.location.x - 16,
                y: b.location.y,
                z: b.location.z - 16
            }
        }, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (checkIfAllowed(p, lcc, "pbb")) {
            data.cancel = true
            p.sendMessage(`§4You may not place this item close to protected chunks that you do not have access to`)
            drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
            return
        }
    }
})

world.beforeEvents.playerInteractWithEntity.subscribe(data => {
    const p = data.player
    const e = data.target
    const v = drawChunkBounds(e, 0)
    const lcc = e.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (checkIfAllowed(p, lcc, "pie")) {
        data.cancel = true
        p.sendMessage(`§4You may not interact with this entity as it is within protected chunks that you are not allowed to access`)
        drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
    }
})

world.beforeEvents.explosion.subscribe(data => {
    const blocks = data.getImpactedBlocks()
    let affectsBounds = false
    let lcc = undefined
    blocks.forEach(b => {
        if (affectsBounds) return
        const v = drawChunkBounds(b, 0)
        lcc = b.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
        if (lcc) {
            affectsBounds = true
        }
    })
    if (affectsBounds) {
        data.cancel = true
        drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 })
    }
})

world.beforeEvents.entityHurt.subscribe(data => {
    /** @type {import('@minecraft/server').Player} */
    const p = data.damageSource.damagingEntity
    if (!p) return
    if (p.typeId != "minecraft:player") return
    /** @type {import('@minecraft/server').Entity} */
    const e = data.hurtEntity
    const v = drawChunkBounds(e, 0)
    const lcc = e.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    const families = e.getComponent('type_family').getTypeFamilies()
    if (checkIfAllowed(p, lcc, "phe")) {
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
    const v = drawChunkBounds(i, 0)
    const lcc = i.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1 })[0]
    if (checkIfAllowed(p, lcc, "pui")) {
        data.cancel = true
        if ((Date.now() % 3000) <= 50) {
            p.sendMessage(`§4You may not pick up this item as it is within protected chunks that you are not allowed to access`)
        }
        drawChunkBounds(lcc, 5, { "red": 1, "green": 0, "blue": 0, "alpha": 1 }, [p])
    }
})

/** @param {string[]} allowList @param {import('@minecraft/server').Player} p @param {import('@minecraft/server').Entity} lcc */
function checkIfAllowed(p, lcc, ppc) {
    if (p == undefined || lcc == undefined) return false
    const allowList = JSON.parse(lcc.getDynamicProperty('allowList') ?? [])
    let allowed = false
    if (lcc.getDynamicProperty('allowListEnabled')) {
        const allowList = JSON.parse(lcc.getDynamicProperty('allowList') ?? [])
        allowList.forEach(n => {
            if (n === p.name && (lcc.getDynamicProperty(ppc + p.id) ?? true)) {
                allowed = true
            }
        })
    }
    if ((lcc?.getDynamicProperty('owner') ?? 0) == p.id) allowed = true
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
    if (e.typeId == "viberater:land_claim_cube") {
        const owner = e.getDynamicProperty('owner')
        if (p.id == owner) {
            showMainMenu(e, p)
        }
    }
})

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showMainMenu(e, p) {
    let form = new ActionFormData()
    const owner = e.getDynamicProperty('owner')
    form.title(`bd.action:Land Claim Cube Main Menu`)
    form.body(`Protection time left: ${Math.ceil(Math.max(0, (e.getDynamicProperty('time') - Date.now()) / 3600000))} hour(s)`)
    form.button(`Reset protection time to ${10 * 24} hours for all loaded cubes`)
    form.button(`Adjust allow list`)
    form.button(`Adjust visitor permissions`)
    form.button(`Show all loaded Land Claim Cube borders`)
    form.button(`Pick up this Land Claim Cube`)
    form.button(`Pick up all loaded Land Claim Cubes`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    oc.setProperty('viberater:active', 1)
                    oc.setDynamicProperty('time', Date.now() + (86400000 * oc.getDynamicProperty('days')))
                    oc.dimension.playSound('beacon.activate', e.location)
                }
            })
            showMainMenu(e, p)
        }
        if (dv == 1) {
            showAdjustAllowListMenu(e, p)
        }
        if (dv == 2) {
            showSelectPlayerMenu(e, p)
        }
        if (dv == 3) {
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    drawChunkBounds(oc, undefined, { "red": 0, "green": 1, "blue": 0, "alpha": 1 }, [p])
                }
            })
        } else {
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    removeChunkBounds(oc)
                }
            })
        }
        if (dv == 4) {
            const item = new ItemStack('viberater:land_claim_cube')
            e.triggerEvent('instant_despawn')
            const placedCount = (p.getDynamicProperty('land_claim_cubes') ?? 0)
            p.setDynamicProperty('land_claim_cubes', placedCount-1)
            p.getComponent('inventory').container.addItem(item)
        }
        if (dv == 5) {
            const owner = e.getDynamicProperty('owner')
            let form = new ActionFormData()
            form.title(`bd.action:Confirmation`)
            let allowList = JSON.parse(e.getDynamicProperty('allowList'))
            form.body(`Do you really want to pick up all loaded land claim cubes?`)
            form.button(`Yes`)
            form.button(`No`)
            form.show(p).then( data => {
                const dv = data.selection
                if (dv == 0) {
                    e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                        if (owner == p.id) {
                            const item = new ItemStack('viberater:land_claim_cube')
                            oc.triggerEvent('instant_despawn')
                            const placedCount = (p.getDynamicProperty('land_claim_cubes') ?? 0)
                            p.setDynamicProperty('land_claim_cubes', placedCount - 1)
                            p.getComponent('inventory').container.addItem(item)
                        }
                    })
                } else {
                    showMainMenu(e, p)
                }
            })
            
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showAdjustAllowListMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Adjust Allow List Menu`)
    let allowList = JSON.parse(e.getDynamicProperty('allowList'))
    form.body(`Allow list: ${allowList.toLocaleString()}`)
    const aLE = e.getDynamicProperty('allowListEnabled')
    form.button(`${aLE ? 'Disable' : 'Enable'} allow list on all loaded cubes`)
    form.button(`Add online players to allow list`)
    form.button(`Manually add players to allow list`)
    form.button(`Remove players from allow list`)
    form.button(`Back to main menu`)
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    oc.setDynamicProperty('allowListEnabled', !aLE)
                }
            })
            showAdjustAllowListMenu(e, p)
        }
        if (dv == 1) {
            showAddOnlinePlayersMenu(e, p)
        }
        if (dv == 2) {
            showManuallyAddPlayersMenu(e, p)
        }
        if (dv == 3) {
            showRemovePlayersMenu(e, p)
        }
        if (dv == 4) {
            showMainMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showAddOnlinePlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Add Online Players to Allow List`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.body(`Allow list: ${aL.toLocaleString()}\nPlayers will be added to all loaded land claim cube allow lists`)
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
            showAdjustAllowListMenu(e, p)
        } else if (dv) {
            aL.push(aPN[dv - 1])
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    oc.setDynamicProperty('allowList', JSON.stringify(aL))
                }
            })
            showAddOnlinePlayersMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showManuallyAddPlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ModalFormData()
    form.title(`bd.modal:Manually Add Players to Allow List`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.textField(`Allow List: ${aL.toLocaleString()}\nNames will be added to all loaded land claim cube allow lists\nName: `, 'Type name here - must be exact')
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
                e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                    if (owner == p.id) {
                        oc.setDynamicProperty('allowList', JSON.stringify(aL))
                    }
                })
            }
            showAdjustAllowListMenu(e, p)
        } catch { }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showRemovePlayersMenu(e, p) {
    const owner = e.getDynamicProperty('owner')
    let form = new ActionFormData()
    form.title(`bd.action:Remove Players from Allow List`)
    let aL = JSON.parse(e.getDynamicProperty('allowList'))
    form.body(`Allow list: ${aL.toLocaleString()}`)
    form.button(`Back to allow list menu`)
    aL.forEach(pN => {
        form.button(`Remove ${pN} from all loaded land claim cube allow lists`)
    })
    form.show(p).then(data => {
        const dv = data.selection
        if (dv == 0) {
            showAdjustAllowListMenu(e, p)
        } else if (dv) {
            aL.splice(dv - 1, 1)
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    oc.setDynamicProperty('allowList', JSON.stringify(aL))
                }
            })
            showRemovePlayersMenu(e, p)
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showSelectPlayerMenu(e, p) {
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
            showMainMenu(e, p)
        } else if (dv) {
            if (e.getDynamicProperty("pib" + p.id) == undefined) e.setDynamicProperty("pib"+p.id, true)
            if (e.getDynamicProperty("pbb" + p.id) == undefined) e.setDynamicProperty("pbb"+p.id, true)
            if (e.getDynamicProperty("ppb" + p.id) == undefined) e.setDynamicProperty("ppb"+p.id, true)
            if (e.getDynamicProperty("pie" + p.id) == undefined) e.setDynamicProperty("pie"+p.id, true)
            if (e.getDynamicProperty("phe" + p.id) == undefined) e.setDynamicProperty("phe"+p.id, true)
            if (e.getDynamicProperty("pui" + p.id) == undefined) e.setDynamicProperty("pui"+p.id, true)
            showPermissionsMenu(e, p, aL[dv-1])
        }
    })
}

/** @param {import('@minecraft/server').Entity} e @param {import('@minecraft/server').Player} p */
function showPermissionsMenu(e, p, pN) {
    const owner = e.getDynamicProperty('owner')
    let form = new ModalFormData()
    form.title(`bd.modal:Adjust ${pN}'s Permissions`)
    form.toggle('Can interact with blocks', { defaultValue: e.getDynamicProperty("pib" + p.id) })
    form.toggle('Can break blocks', { defaultValue: e.getDynamicProperty("pbb" + p.id) })
    form.toggle('Can place blocks', { defaultValue: e.getDynamicProperty("ppb" + p.id) })
    form.toggle('Can interact with entities', { defaultValue: e.getDynamicProperty("pie" + p.id) })
    form.toggle('Can hurt entities', { defaultValue: e.getDynamicProperty("phe" + p.id) })
    form.toggle('Can pick up items', { defaultValue: e.getDynamicProperty("pui" + p.id) })
    form.submitButton('Apply permissions to all land claim cubes and go back')
    form.show(p).then( data => {
        const dv = data.formValues
        if (dv == 0) {
            showSelectPlayerMenu(e, p)
        } else if (dv) {
            e.dimension.getEntities({ 'type': 'viberater:land_claim_cube', 'location': e.location }).forEach(oc => {
                if (owner == p.id) {
                    oc.setDynamicProperty("pib" + p.id, dv[0])
                    oc.setDynamicProperty("pbb" + p.id, dv[1])
                    oc.setDynamicProperty("ppb" + p.id, dv[2])
                    oc.setDynamicProperty("pie" + p.id, dv[3])
                    oc.setDynamicProperty("phe" + p.id, dv[4])
                    oc.setDynamicProperty("pui" + p.id, dv[5])
                }
            })
            showSelectPlayerMenu(e, p)
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

world.afterEvents.entitySpawn.subscribe(data => {
    const e = data.entity
    const cause = data.cause
    if (e.typeId == "viberater:land_claim_cube") {
        const v = drawChunkBounds(e, 0)
        let inBounds = false
        const owner = e.dimension.getPlayers({ "closest": 1, "location": e.location })[0]
        const placedCount = (owner.getDynamicProperty('land_claim_cubes') ?? 0) + 1
        if (placedCount > 16) {
            const item = new ItemStack('viberater:land_claim_cube')
            owner.getComponent('inventory').container.addItem(item)
            owner.sendMessage(`§4You may not place more than 16 Land Claim Cubes`)
            e.triggerEvent('instant_despawn')
            inBounds = true
        } else {
            e.addTag('exempt')
            const lcc = e.dimension.getEntities({ "location": { x: v.vf.x + 0.5, y: v.vf.y, z: v.vf.z + 0.5 }, "volume": { x: 14, y: 488, z: 14 }, "type": "viberater:land_claim_cube", "closest": 1, "excludeTags": ["exempt"] })[0]
            e.removeTag('exempt')
            if (lcc) {
                const item = new ItemStack('viberater:land_claim_cube')
                owner.getComponent('inventory').container.addItem(item)
                owner.sendMessage(`§4You may not place a land claim cube within bounds of another cube`)
                drawChunkBounds(lcc, 5, { "red": 1, "green": 1, "blue": 0, "alpha": 1 })
                e.triggerEvent('instant_despawn')
                inBounds = true
            }
        }
        if (!inBounds) {
            drawChunkBounds(e, 10, { red: 0, green: 1, blue: 0, alpha: 1 })
            owner.setDynamicProperty('land_claim_cubes', placedCount)
            e.setDynamicProperty('time', 0)
            e.setDynamicProperty('days', 10)
            e.setDynamicProperty('allowListEnabled', false)
            e.setDynamicProperty('allowList', JSON.stringify([]))
            owner.sendMessage(`§aYou've linked a Land Claim Cube ${placedCount}/16`)
            e.setDynamicProperty('owner', owner.id)
            e.setDynamicProperty('bvb1', v.vf)
            e.setDynamicProperty('bvb2', v.vc)
        }
    }
})

function vec2BoundsCheck(p, a, b) {
    return (
        p.x >= Math.min(a.x, b.x) &&
        p.x <= Math.max(a.x, b.x) &&
        p.z >= Math.min(a.z, b.z) &&
        p.z <= Math.max(a.z, b.z)
    )
}

const lines = new Map()

/** @param {import('@minecraft/server').Entity} e */
function removeChunkBounds(e) {
    try {
        debugDrawer.removeShape(lines.get(e.id.toString() + "a"))
        debugDrawer.removeShape(lines.get(e.id.toString() + "b"))
        debugDrawer.removeShape(lines.get(e.id.toString() + "c"))
        debugDrawer.removeShape(lines.get(e.id.toString() + "d"))
        lines.delete(e.id.toString() + "a")
        lines.delete(e.id.toString() + "b")
        lines.delete(e.id.toString() + "c")
        lines.delete(e.id.toString() + "d")
    } catch { }
}

/** @param {import('@minecraft/server').Player[]} p @param {import('@minecraft/server').Entity} e @param {Number} t */
function drawChunkBounds(e, t = undefined, c = { red: 1, green: 1, blue: 1, alpha: 1 }, p = undefined) {
    const vf = {
        x: Math.floor(e.location.x / 16) * 16,
        y: -104,
        z: Math.floor(e.location.z / 16) * 16
    }
    const vc = {
        x: Math.ceil(e.location.x / 16) * 16,
        y: 320,
        z: Math.ceil(e.location.z / 16) * 16
    }
    if (t != 0) {
        if (!t) removeChunkBounds(e)
        let db = new DebugArrow(
            { x: vf.x, y: -104, z: vf.z },
            { x: vf.x, y: 320, z: vf.z }
        )
        db.color = { "red": c.red, "green": c.green, "blue": c.blue, "alpha": c.alpha }
        db.maximumRenderDistance = 488
        if (t) db.timeLeft = t
        if (p) db.visibleTo = p
        lines.set(e.id.toString() + "a", db)
        debugDrawer.addShape(db, e.dimension)
        db = new DebugArrow(
            { x: vc.x, y: -104, z: vc.z },
            { x: vc.x, y: 320, z: vc.z }
        )
        db.color = { "red": c.red, "green": c.green, "blue": c.blue, "alpha": c.alpha }
        db.maximumRenderDistance = 488
        if (t) db.timeLeft = t
        if (p) db.visibleTo = p
        lines.set(e.id.toString() + "b", db)
        debugDrawer.addShape(db, e.dimension)
        db = new DebugArrow(
            { x: vf.x, y: -104, z: vc.z },
            { x: vf.x, y: 320, z: vc.z }
        )
        db.color = { "red": c.red, "green": c.green, "blue": c.blue, "alpha": c.alpha }
        db.maximumRenderDistance = 488
        if (t) db.timeLeft = t
        if (p) db.visibleTo = p
        lines.set(e.id.toString() + "c", db)
        debugDrawer.addShape(db, e.dimension)
        db = new DebugArrow(
            { x: vc.x, y: -104, z: vf.z },
            { x: vc.x, y: 320, z: vf.z }
        )
        db.color = { "red": c.red, "green": c.green, "blue": c.blue, "alpha": c.alpha }
        db.maximumRenderDistance = 488
        if (t) db.timeLeft = t
        if (p) db.visibleTo = p
        lines.set(e.id.toString() + "d", db)
        debugDrawer.addShape(db, e.dimension)
    }
    return { vf: vf, vc: vc }
}
