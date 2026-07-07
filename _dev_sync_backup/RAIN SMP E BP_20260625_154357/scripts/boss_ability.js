import { system } from "@minecraft/server";

// ==========================================
// CUSTOM BOSS & MOB ABILITIES
// ==========================================
system.afterEvents.scriptEventReceive.subscribe(data => {
    const entity = data.sourceEntity;
    const id = data.id;

    if (!entity || !entity.dimension) return; // Safety check

    if (id == 'viberater:wither_skeleton_decay') {
        entity.dimension.getPlayers({maxDistance:32, location:entity.location}).forEach( player => {
            player.removeEffect('regeneration');
            player.removeEffect('absorption');
            player.addEffect('weakness', 320, {amplifier:1});
            
            if (player.getEffect('wither')) {
                player.applyDamage(12, {damagingEntity:entity, cause:'entityExplosion'});
                const a = player.getComponent('equippable');
                if (!a) return;
                
                const armorSlots = ['Head', 'Chest', 'Legs', 'Feet'];
                armorSlots.forEach( slot => {
                    const itemStack = a.getEquipment(slot);
                    if (!itemStack || !itemStack.getComponent('durability')) return;
                    
                    const durabilityComp = itemStack.getComponent('durability');
                    const itemDamage = Math.round((durabilityComp.maxDurability - durabilityComp.damage) / (10 + 5*Math.random()));
                    
                    if (durabilityComp.damage + (itemDamage + 10) > durabilityComp.maxDurability) {
                        player.playSound('random.break');
                        a.setEquipment(slot, undefined);
                    } else {
                        durabilityComp.damage += (itemDamage + 10);
                        a.setEquipment(slot, itemStack);
                    }
                });
            } else {
                player.addEffect('wither', 160, {amplifier:3});
            }
        });
    }

    if (id == 'viberater:wither_skeleton_decimate') {
        entity.dimension.getPlayers({maxDistance:32, location:entity.location}).forEach( player => {
            const health = player.getComponent('health');
            if (!health) return;
            
            const pH = health.currentValue / health.effectiveMax;
            if (pH > 0.5) return;
            
            if (player.getEffect('wither')) {
                player.applyDamage(24, {damagingEntity:entity, cause:'entityExplosion'});
            } else {
                player.addEffect('wither', 160, {amplifier:3});
            }
        });
    }

    if (id == 'viberater:wither_skeleton_pull') {
        entity.dimension.getPlayers({maxDistance:32, location:entity.location}).forEach( player => {
            const e = entity.location;
            const p = player.location;
            const dist = Math.sqrt((e.x-p.x) ** 2 + (e.z-p.z) ** 2 + (e.y-p.y) ** 2);
            
            player.applyKnockback(e.x-p.x, e.z-p.z, Math.sqrt(dist)*1.75, Math.sqrt(dist)/5);
            
            if (player.getEffect('wither')) {
                player.applyDamage(16, {damagingEntity:entity, cause:'entityExplosion'});
            } else {
                player.addEffect('wither', 160, {amplifier:0});
            }
        });
    }

    if (id == "viberater:ravager_vexplode") {
        entity.dimension.getEntities({ type: "minecraft:vex", location: entity.location, maxDistance: 32 }).forEach(vex => {
            vex.addTag('vexplode');
        });
        system.runTimeout(() => {
            if (!entity || !entity.isValid()) return; 
            entity.runCommandAsync('tag @e remove vexplode');
        }, 400);
    }

    if (id == "viberater:ravager_worldbreaker") {
        entity.dimension.getPlayers({ maxDistance: 32, location: entity.location }).forEach(player => {
            const equippable = player.getComponent('equippable');
            if (!equippable) return;
            
            const itemStack = equippable.getEquipment("Mainhand");
            if (!itemStack || !itemStack.getComponent('durability')) return;

            const durabilityComp = itemStack.getComponent('durability');
            const itemDamage = Math.round((durabilityComp.maxDurability - durabilityComp.damage) / (3 + Math.random()));
            
            if (durabilityComp.damage + (itemDamage + 10) > durabilityComp.maxDurability) {
                player.playSound('random.break');
                equippable.setEquipment('Mainhand', undefined);
            } else {
                durabilityComp.damage += (itemDamage + 10);
                equippable.setEquipment('Mainhand', itemStack);
            }
        });
    }

    if (id == "viberater:ravager_brigade") {
        const illagers = ["minecraft:vindicator", "minecraft:pillager", "minecraft:witch", "minecraft:evocation_illager", "minecraft:vex"];
        entity.runCommandAsync(`summon ${illagers[Math.floor(Math.random() * illagers.length)]} ^-2^1^1`);
        entity.runCommandAsync(`summon ${illagers[Math.floor(Math.random() * illagers.length)]} ^-4^1^2`);
        entity.runCommandAsync(`summon ${illagers[Math.floor(Math.random() * illagers.length)]} ^2^1^1`);
        entity.runCommandAsync(`summon ${illagers[Math.floor(Math.random() * illagers.length)]} ^4^1^2`);
        entity.runCommandAsync('event entity @e[type=evocation_illager, r=32] minecraft:spawn_for_raid');
    }

    if (id == "viberater:ravager_pillager_rider") {
        const rideable = entity.getComponent('rideable');
        if (!rideable) return;
        
        const rider = rideable.getRiders()[0];
        const newRider = entity.dimension.spawnEntity('minecraft:pillager', entity.location);
        
        if (rider) rideable.ejectRider(rider);
        rideable.addRider(newRider);
    }

    if (id == "viberater:ravager_evoker_rider") {
        const rideable = entity.getComponent('rideable');
        if (!rideable) return;
        
        const rider = rideable.getRiders()[0];
        const newRider = entity.dimension.spawnEntity('minecraft:evocation_illager', entity.location);
        newRider.triggerEvent("minecraft:spawn_for_raid");
        
        if (rider) rideable.ejectRider(rider);
        rideable.addRider(newRider);
    }

    if (id == "viberater:ravager_witch_rider") {
        const rideable = entity.getComponent('rideable');
        if (!rideable) return;
        
        const rider = rideable.getRiders()[0];
        const newRider = entity.dimension.spawnEntity('minecraft:witch', entity.location);
        
        if (rider) rideable.ejectRider(rider);
        rideable.addRider(newRider);
    }

    if (id == "viberater:skeleton_debilitate") {
        entity.dimension.getPlayers({ maxDistance: 32, location: entity.location }).forEach(player => {
            const poisonEffect = player.getEffect('poison');
            // Only apply weakness/slowness if the player ACTUALLY has poison
            if (poisonEffect) { 
                player.addEffect("weakness", 600, { amplifier: 2 });
                player.addEffect("slowness", 600, { amplifier: 2 });
            }
        });
    }

    if (id == "viberater:skeleton_ranger") {
        const rangedWeapons = [
            "minecraft:bow",
            "minecraft:trident",
            "minecraft:crossbow",
            "minecraft:snowball",
            "viberater:legendary_dart_gun",
            "viberater:rare_dart_gun",
            "viberater:flintlock_pistol",
            "viberater:fireball",
            "viberater:splash_potion",
            "viberater:lingering_potion",
            "viberater:snowball"
        ];
        
        entity.dimension.getPlayers({ maxDistance: 32, location: entity.location }).forEach(player => {
            const equippable = player.getComponent('equippable');
            if (!equippable) return;
            
            const itemStack = equippable.getEquipment("Mainhand");
            
            if (itemStack && rangedWeapons.includes(itemStack.typeId)) {
                player.addEffect("poison", 400, { amplifier: 1 });
                
                const durabilityComp = itemStack.getComponent('durability');
                if (!durabilityComp) return; 
                
                const itemDamage = (durabilityComp.maxDurability - durabilityComp.damage) / 2;
                
                if (durabilityComp.damage + (itemDamage + 10) > durabilityComp.maxDurability) {
                    player.playSound('random.break');
                    equippable.setEquipment('Mainhand', undefined);
                } else {
                    durabilityComp.damage += (itemDamage + 10);
                    equippable.setEquipment('Mainhand', itemStack);
                }
            }
        });
    }

    if (id == "viberater:skeleton_iron") {
        entity.addTag("iron_bone");
        system.runTimeout(() => {
            if (!entity || !entity.isValid()) return;
            entity.removeTag("iron_bone");
        }, 100);
    }
});

world.afterEvents.entityHurt.subscribe(data => {
    const damager = data.damageSource.damagingEntity ?? "self_destruct"
    const entity = data.hurtEntity
    const damage = data.damage
    if (damager == "self_destruct") return
    if (entity.hasTag("iron_bone")) {
        const health = entity.getComponent('health').currentValue
        entity.getComponent('health').setCurrentValue(health + damage)
        damager.applyDamage(damage, { damagingEntity: entity, cause: "thorns" })
    }
    if (damager.hasTag('vexplode')) {
        damager.dimension.createExplosion(damager.location, 2, { breaksBlocks: false})
        damager.kill()
    }
})