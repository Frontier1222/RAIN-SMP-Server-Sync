import { world, EquipmentSlot } from "@minecraft/server"
import { toast, toastInfo } from "../utils/realmPerf.js"

function isValidEntity(entity) {
    try {
        return entity?.isValid === true;
    } catch (e) {
        return false;
    }
}

// ==========================================
// HIT EFFECTS (Wither, Weakness, Fire)
// ==========================================
world.afterEvents.entityHurt.subscribe((data) => {
    const damager = data.damageSource.damagingEntity;
    const damageCause = data.damageSource.cause;
    const entity = data.hurtEntity;

    if (!isValidEntity(entity)) return;
    if (!damager || !isValidEntity(damager)) return;
    if (damageCause === "selfDestruct") return;
    if (damager.typeId !== "minecraft:player") return;

    let itemStack;
    try {
        const equippable = damager.getComponent("minecraft:equippable");
        itemStack = equippable?.getEquipment(EquipmentSlot.Mainhand);
    } catch (e) {
        return;
    }

    if (!itemStack) return;

    if (itemStack.typeId === "viberater:christmas_sword") {
        try {
            entity.addEffect("weakness", 160, { amplifier: 3 });
            entity.addEffect("slowness", 160, { amplifier: 0 });
        } catch (e) {}
    }

    if (itemStack.typeId === "viberater:epic_wither_sword") {
        try {
            entity.addEffect("wither", 200, { amplifier: 1 });
        } catch (e) {}
    }

    if (itemStack.typeId === "viberater:legendary_wildfire_sword") {
        try {
            entity.runCommand("fill ~-2~-2~-2 ~2~2~2 fire replace air");
        } catch (e) {}
    }

    if (itemStack.typeId === "viberater:rare_wildfire_sword") {
        try {
            entity.runCommand("fill ~-1~-1~-1 ~1~1~1 fire replace air");
        } catch (e) {}
    }
});

// ==========================================
// RIGHT CLICK EFFECTS (Murasame Toggle)
// ==========================================
world.afterEvents.itemUse.subscribe(data => {
    const player = data.source;
    const itemStack = data.itemStack;

    if (itemStack.typeId === "viberater:epic_wither_sword") {
        
        // 1. Ensure the item is kept on death
        if (!itemStack.keepOnDeath) {
            itemStack.keepOnDeath = true;
        }

        // 2. Check the current toggle state of the sword
        const isActive = itemStack.getDynamicProperty("murasame_active");

        if (!isActive) {
            // TURN ON BUFFS (20,000,000 ticks = basically infinite)
            toast(player, "§cMurasame Power Unleashed!", "murasame_on");
            player.addEffect("speed", 20000000, { amplifier: 1, showParticles: false }); // Speed 2
            player.addEffect("strength", 20000000, { amplifier: 1, showParticles: false }); // Strength 2
            player.addEffect("invisibility", 20000000, { amplifier: 0, showParticles: false });
            player.addEffect("fire_resistance", 20000000, { amplifier: 0, showParticles: false });
            player.addEffect("regeneration", 20000000, { amplifier: 0, showParticles: false }); // Resistance 1
            player.playSound("ender_dragon_growl", { volume: 1, pitch: 1 });
            
            // Mark the sword as active
            itemStack.setDynamicProperty("murasame_active", true);
        } else {
            // TURN OFF BUFFS
            toastInfo(player, "Murasame Power Sealed.", "murasame_off");
            player.removeEffect("speed");
            player.removeEffect("strength");
            player.removeEffect("invisibility");
            player.removeEffect("fire_resistance");
            player.removeEffect("regeneration");
            // Mark the sword as inactive
            itemStack.setDynamicProperty("murasame_active", false);
        }
        
        // 3. Save the updated item (with keepOnDeath and the new toggle state) back to the player's hand
        const equipment = player.getComponent("minecraft:equippable");
        if (equipment) {
            equipment.setEquipment(EquipmentSlot.Mainhand, itemStack);
            
            
        }
    }
});