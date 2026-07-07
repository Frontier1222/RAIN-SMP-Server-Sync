import { Entity, world } from "@minecraft/server"
import { toastError } from "../utils/realmPerf.js";

world.afterEvents.itemUse.subscribe( data => {
    const itemStack = data.itemStack ?? "hand"
    const player = data.source
    if (itemStack.typeId == "hand") return
    if (itemStack.typeId == "viberater:loot_growable_plants") {
        player.runCommand('loot give @s loot \"chests/christmas_seed.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_hmob_egg") {
        player.runCommand('loot give @s loot \"chests/specialist_spawn_egg.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_music_disc") {
        player.runCommand('loot give @s loot \"chests/music_disc.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_power_orb") {
        player.runCommand('loot give @s loot \"chests/orbs.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_christmas_netherite_armor_piece") {
        player.runCommand('loot give @s loot \"chests/christmas_armor.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_christmas_netherite_tool") {
        player.runCommand('loot give @s loot \"chests/christmas_tool.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_random_dyes") {
        player.runCommand('loot give @s loot \"chests/christmas_dye.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_random_flowers") {
        player.runCommand('loot give @s loot \"chests/christmas_flower.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_smithing_template") {
        player.runCommand('loot give @s loot \"chests/smithing_template.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_wandering_trader") {
        player.runCommand('loot give @s loot \"chests/wandering_trader.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_random_skull") {
        player.runCommand('loot give @s loot \"chests/skulls.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_common_trim") {
        player.runCommand('loot give @s loot \"chests/common_trim.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_rare_trim") {
        player.runCommand('loot give @s loot \"chests/rare_trim.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_random_wool") {
        player.runCommand('loot give @s loot \"chests/random_wool.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_random_terracotta") {
        player.runCommand('loot give @s loot \"chests/random_terracotta.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:loot_random_concrete") {
        player.runCommand('loot give @s loot \"chests/random_concrete.loot_table\"')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:bundle_8_totems") {
        player.runCommand('give @s totem 8')
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:snowball") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        itemStack.getComponent('cooldown').startCooldown(player)
        const projectile = player.dimension.spawnEntity('viberater:snowball', player.getHeadLocation())
        projectile.getComponent('projectile').shoot(player.getViewDirection())
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:legendary_dart_gun") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        itemStack.getComponent('cooldown').startCooldown(player)
        const hl = player.getHeadLocation()
        const vd = player.getViewDirection()
        const projectile = player.dimension.spawnEntity('viberater:legendary_dart_gun', {x:hl.x+vd.x, y:hl.y+vd.y, z:hl.z+vd.z})
        projectile.getComponent('projectile').shoot({x:4*vd.x, y:4*vd.y, z:4*vd.z})
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:rare_dart_gun") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        const hl = player.getHeadLocation()
        const vd = player.getViewDirection()
        const projectile = player.dimension.spawnEntity('viberater:legendary_dart_gun', {x:hl.x+vd.x, y:hl.y+vd.y, z:hl.z+vd.z})
        projectile.getComponent('projectile').shoot({x:4*vd.x, y:4*vd.y, z:4*vd.z})
        itemStack.getComponent('durability').damage += 3
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:reroll_trades") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function reroll_trades')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:zombie_potion") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function zombie_potion')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_affliction") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_affliction')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_agility") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_agility')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_aviation") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_aviation')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_divine_intervention") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_divine_intervention')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_excavation") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('execute as @s[m=!a] at @s unless block ~ -64 ~ deny run function orbs/orb_of_excavation')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_fecundation") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_fecundation')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_gelidity") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_gelidity')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_infinite_fuel") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_infinite_fuel')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_nullification") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_nullification')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_piglin_rapacity") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_piglin_rapacity')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_respite") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_respite')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_seclusion") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_seclusion')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_strigiformity") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_strigiformity')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
    if (itemStack.typeId == "viberater:orb_of_subaquatics") {
        if (itemStack.getComponent('cooldown').getCooldownTicksRemaining(player) > 0) return
        if (itemStack.getComponent('durability').damage == itemStack.getComponent('durability').maxDurability) {
            toastError(player, "Repairs required to use this item.", "item_repair");
            return
        }
        itemStack.getComponent('cooldown').startCooldown(player)
        player.runCommand('function orbs/orb_of_subaquatics')
        itemStack.getComponent('durability').damage += 1
        player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
    }
})

world.afterEvents.itemStartUseOn.subscribe( data => {
    const faceLocation = data.blockFace
    const block = data.block
    const player = data.source
    const itemStack = data.itemStack ?? "hand"
    if (itemStack == "hand") return
    if (itemStack.typeId == "viberater:christmas_coin_2023") {
        player.dimension.spawnEntity('viberater:christmas_coin_2023', faceLocation)
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:event_coin") {
        player.dimension.spawnEntity('viberater:event_coin', faceLocation)
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:lockable_chest") {
        if (blockFace != "Up") return
        player.dimension.spawnEntity('viberater:locked_chest', faceLocation)
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:nether_reactor_core") {
        if (blockFace != "Up") return
        player.dimension.spawnEntity('viberater:nether_reactor_core', faceLocation)
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
    if (itemStack.typeId == "viberater:frontier_coin") {
        if (blockFace != "Up") return
        player.dimension.spawnEntity('viberater:frontier_coin', faceLocation)
        if (itemStack.amount == 1 ) {
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(null)
        } else {
            itemStack.amount -= 1
            player.getComponent("equippable").getEquipmentSlot('Mainhand').setItem(itemStack)
        }
    }
})