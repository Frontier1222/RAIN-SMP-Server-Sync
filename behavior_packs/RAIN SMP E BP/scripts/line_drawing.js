import { debugDrawer, DebugArrow } from "@minecraft/debug-utilities"
import { system, world } from "@minecraft/server"

const lines = new Map()

/**@param {{"floor":{x:Number,y:Number,z:Number},"ceiling":{x:Number,y:Number,z:Number}}}l@param {Number}t@param {{r:Number,g:Number,b:Number,a:Number}}rgb@param {import('@minecraft/server').Player[]}p*/
export function addLine(l, t, rgba = { r: 1, g: 1, b: 1, a: 1 }, dimension = world.getDimension('minecraft:overworld'), id, p, render_distance = 488) {
    if (id && lines.has(id)) {
        try {
            debugDrawer.removeShape(lines.get(id))
        } catch {}
    }
    let db = new DebugArrow(
        { x: l.floor.x, y: l.floor.y, z: l.floor.z },
        { x: l.ceiling.x, y: l.ceiling.y, z: l.ceiling.z }
    )
    db.color = { "red": rgba.r, "green": rgba.g, "blue": rgba.b, "alpha": rgba.a }
    db.maximumRenderDistance = render_distance
    if (t) db.timeLeft = t
    if (p) db.visibleTo = p
    if (id) lines.set(id, db)
    debugDrawer.addShape(db, dimension)
}

export function removeLine(id) {
    if (!id || !lines.has(id)) return
    const line = lines.get(id)
    lines.delete(id)
    try {
        debugDrawer.removeShape(line)
    } catch {}
}

/** @param {import('@minecraft/server').Entity} e */
export function getChunkLines(e) {
    const vf = {
        x: Math.floor(e.location.x / 16) * 16,
        y: -64,
        z: Math.floor(e.location.z / 16) * 16
    }
    const vc = {
        x: Math.ceil(e.location.x / 16) * 16,
        y: 320,
        z: Math.ceil(e.location.z / 16) * 16
    }
    return [
        {
            "floor": {
                x: vf.x,
                y: -64,
                z: vf.z
            },
            "ceiling": {
                x: vf.x,
                y: 320,
                z: vf.z
            }
        },
        {
            "floor": {
                x: vc.x,
                y: -64,
                z: vc.z
            },
            "ceiling": {
                x: vc.x,
                y: 320,
                z: vc.z
            }
        },
        {
            "floor": {
                x: vc.x,
                y: -64,
                z: vf.z
            },
            "ceiling": {
                x: vc.x,
                y: 320,
                z: vf.z
            }
        },
        {
            "floor": {
                x: vf.x,
                y: -64,
                z: vc.z
            },
            "ceiling": {
                x: vf.x,
                y: 320,
                z: vc.z
            }
        }
    ]
}
