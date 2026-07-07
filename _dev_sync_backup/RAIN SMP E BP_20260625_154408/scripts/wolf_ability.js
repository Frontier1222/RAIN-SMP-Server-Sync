import { world, system } from "@minecraft/server"

world.afterEvents.dataDrivenEntityTrigger.subscribe(data => {
    const entity = data.entity
    const event = data.eventId
    if (entity.typeId == "minecraft:wolf") {
        if (event == "instant_despawn") {
            if (entity.getDynamicProperty('invulnerableInterval') != undefined) system.clearRun(entity.getDynamicProperty('invulnerableInterval'))
            entity.triggerEvent('instant_despawn_prepped')
        }
        if (event == "viberater:invulnerable") {
            entity.setDynamicProperty('invulnerable', true)
        }
    }
})

system.afterEvents.scriptEventReceive.subscribe(data => {
    const entity = data.sourceEntity ?? undefined
    const id = data.id
    if (entity == undefined) return
    if (id == 'viberater:reset_golden_dog') {
        entity.setProperty('viberater:has_golden_dog', false)
    }
})

world.afterEvents.entityHealthChanged.subscribe(data => {
    const entity = data.entity
    if (entity.getDynamicProperty('invulnerable')) {
        const newValue = data.newValue
        if (newValue <= 960 && entity.getDynamicProperty('invulnerableInterval') == undefined) {
            entity.getComponent('movement').setCurrentValue(0)
            entity.setProperty('viberater:sitting', true)
            const sound_variant = entity.getProperty('minecraft:sound_variant') == 'default' ? "" : ("." + entity.getProperty('minecraft:sound_variant'))
            entity.dimension.playSound(`mob.wolf${sound_variant}.death`, entity.location)
            entity.setDynamicProperty('invulnerableInterval', system.runInterval(() => {
                const health = entity.getComponent('health')
                if (health.currentValue > 960) {
                    entity.dimension.playSound(`mob.wolf${sound_variant}.bark`, entity.location)
                    entity.setProperty('viberater:sitting', false)
                    entity.getComponent('movement').resetToDefaultValue()
                    system.clearRun(entity.getDynamicProperty('invulnerableInterval'))
                    entity.setDynamicProperty('invulnerableInterval', undefined)
                } else {
                    health.setCurrentValue(health.currentValue + 1)
                    entity.dimension.spawnParticle('minecraft:heart_particle', { x: entity.location.x + (Math.random() - 0.5), y: entity.location.y + 1.25, z: entity.location.z + (Math.random() - 0.5) })
                    if (Math.random() < 0.333) { entity.dimension.playSound(`mob.wolf${sound_variant}.whine`, entity.location) }
                }
            }, 60))
        }
    }
})