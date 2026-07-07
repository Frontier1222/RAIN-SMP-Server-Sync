import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { updateBucket } from './utils.js';
import { CanInteractComponent } from './cans.js';
import { ModifierComponent } from './modifiers/modifiers.js';
import { DryingRackComponent } from './blocks/dryingRack.js';
import { CastingTableComponent } from './blocks/castingTable.js';
import { CastingBasinComponent } from './blocks/castingBasin.js';
import { MelterComponent } from './blocks/melter.js';
import { MelterProxyComponent } from './blocks/melter_dummy.js';
import { IronBerryBushComponent } from './blocks/iron_berry_bush.js';
import { GoldBerryBushComponent } from './blocks/gold_berry_bush.js';
import { CopperBerryBushComponent } from './blocks/copper_berry_bush.js';
import { DiamondBerryBushComponent } from './blocks/diamond_berry_bush.js';
import { EmeraldBerryBushComponent } from './blocks/emerald_berry_bush.js';
import { XpBerryBushComponent } from './blocks/xp_berry_bush.js';
import { FullBerryBushComponent } from './blocks/full_bush.js';
import './blocks/melterStructure.js';
import './food.js';
import { StrippingAxes } from './stripping_axes.js';
import { SmelteryBlockComponent } from './blocks/smeltery_controller.js';
import { SearedTankBlockComponent } from './blocks/seared_tank.js';
import { SearedDrainBlockComponent } from './blocks/drain.js';
import { FaucetBlockComponent } from './blocks/faucet.js';
import { tc as Ot, PlayerUtils as R, ItemUtils as y } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { MinecraftEntityTypes, MinecraftBlockTypes, MinecraftItemTypes } from './minecraft_vanilla_data.js';

// Define the loot table command
const lootTableCommand = 'loot spawn ~ ~ ~ loot "ftb/tinkers/wither"';
world.afterEvents.entityDie.subscribe((eventData) => {
    const deadEntity = eventData.deadEntity;
    if (!deadEntity?.isValid || deadEntity.typeId !== "minecraft:wither_skeleton") return;

    const { x, y, z } = deadEntity.location;
    const dim = deadEntity.dimension;
    if (!dim) return;

    dim.runCommand(`execute positioned ${x} ${y} ${z} run ${lootTableCommand}`);
});
system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent(Ot("empty_can_interact"), new CanInteractComponent());
    event.itemComponentRegistry.registerCustomComponent(Ot("axe_stripping"), new StrippingAxes());
    event.itemComponentRegistry.registerCustomComponent(Ot("fluid_storage"), new class {
    });
    event.itemComponentRegistry.registerCustomComponent(Ot("fluid_holder"), new class {
    });
    event.blockComponentRegistry.registerCustomComponent(Ot("modifier_worktable"), new ModifierComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("drying_rack_interact"), new DryingRackComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("casting_table_interaction"), new CastingTableComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("casting_basin_interaction"), new CastingBasinComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("melter_interaction"), new MelterComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("melter_proxy_logic"), new MelterProxyComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("basic_iron_berry_bush_interact"), new IronBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("basic_gold_berry_bush_interact"), new GoldBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("basic_copper_berry_bush_interact"), new CopperBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("basic_diamond_berry_bush_interact"), new DiamondBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("basic_emerald_berry_bush_interact"), new EmeraldBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("basic_xp_berry_bush_interact"), new XpBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("full_berry_bush_interact"), new FullBerryBushComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("smeltery_controller"), new SmelteryBlockComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("seared_tank"), new SearedTankBlockComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("seared_drain"), new SearedDrainBlockComponent());
    event.blockComponentRegistry.registerCustomComponent(Ot("faucet"), new FaucetBlockComponent());
});
import('./materials_book.js');
import('./encyclopedia.js');
import('./template.js');
import('./vanilla_item_use.js');
import('./block_break.js');
import('./tool_effects.js');
import('./durability.js');
import('./slingshot.js');
import('./update_book.js');
import('./player_controller.js');
import('./smeltery.js');
import('./projectiles.js');
import('./table.js');
import('./bows.js');
import('./villager_convert.js');
import('./compact/storge_drawers.js');
import('./compact/sieves.js');
world.beforeEvents.playerInteractWithEntity.subscribe((data) => {
    const player = data.player;
    const itemStack = data.itemStack;
    if (itemStack?.typeId !== "ftb_tc:copper_can_empty") {
        return;
    }
    if (data.target.typeId !== MinecraftEntityTypes.Cow) {
        return;
    }
    system.run(() => {
        player.playSound("mob.cow.milk");
        updateBucket(player, itemStack, new ItemStack("ftb_tc:copper_can_milk", 1));
    });
});
world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;
    if (!item || !player)
        return;
    const blockHit = player.dimension.getBlockFromRay(player.getHeadLocation(), player.getViewDirection(), {
        maxDistance: 9,
        includeLiquidBlocks: true,
        includePassableBlocks: false,
    });
    const block = blockHit?.block;
    if (block?.typeId === "minecraft:mob_spawner" && item.typeId.includes("ftb")) {
        event.cancel = true;
        player.sendMessage("§6[!]§r Unable to perform that action.");
    }
});
world.afterEvents.playerSpawn.subscribe((data) => {
    const player = data.player;
    if (data.initialSpawn && !player.hasTag("ftb_tinkers_joined")) {
        player.sendMessage("§eTinkers' Construct 3.0§r has successfully loaded!");
        player.sendMessage("§dA forgotten book whispers into existence at your feet. Curiosity draws you closer...§r");
        player.runCommand("scoreboard objectives add ftb_tc:jig_computer.addon_stats dummy");
        player.runCommand('loot spawn ^ ^ ^1 loot "ftb/tinkers/materials"');
        player.runCommand("gamerule recipesunlock false");
        player.addTag("ftb_tinkers_joined");
    }
    if (data.initialSpawn && !player.hasTag("ftb_tinkers_update_9")) {
        player.sendMessage("§eTinkers' Construct Add-on Update 9§r has successfully loaded!");
        player.sendMessage("§dA Changelog Book drops at your feet.§r");
        player.runCommand('loot spawn ^ ^ ^1 loot "ftb/tinkers/changelog_1"');
        player.addTag("ftb_tinkers_update_9");
    }
    if (data.initialSpawn && player.hasTag("ftb_tinkers_joined")) {
        player.runCommand("scoreboard objectives add ftb_tc:jig_computer.addon_stats dummy");
    }
});
system.afterEvents.scriptEventReceive.subscribe((eventData) => {
    const { id, sourceEntity } = eventData;
    if (id === "ftb_tc:smeltery_remove_event") {
        if (!sourceEntity) {
            return;
        }
        smeltery_remove(sourceEntity);
    }
    if (id === "ftb_tc:seared_tank_remove_event") {
        if (!sourceEntity) {
            return;
        }
        seared_tank_remove(sourceEntity);
    }
    if (id === "ftb_tc:seared_drain_remove_event") {
        if (!sourceEntity) {
            return;
        }
        seared_drain_remove(sourceEntity);
    }
});
function smeltery_remove(player) {
    const form = new ActionFormData()
        .title("Warning: Removing Smeltery Controller")
        .body("Are you absolutely sure you want to remove the Smeltery Controller?\n\n§sImportant:§r\n§b - Removing the controller will permanently destroy any materials currently stored within the smeltery.§r\n\n§b - Removing the Smeltery Controller will also remove the Seared Drain.§r\n\nPlease double-check your decision before proceeding.\n\nIf you are certain, click 'Remove' to confirm.\n\nOtherwise, click 'Cancel' to return.")
        .button("§l§qRemove")
        .button("§l§mCancel.");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            player.runCommand(`playsound block.false_permissions @s ~ ~ ~ 1 1`);
            player.runCommand(`execute at @e[type=ftb_tc:smeltery_controller,r=5,family=remove_check] run execute as @e[type=ftb_tc:seared_drain,r=2] run setblock ~ ~ ~ air`);
            player.runCommand(`execute at @e[type=ftb_tc:smeltery_controller,r=5,family=remove_check] run event entity @e[type=ftb_tc:seared_drain,r=1] ftb_tc:remove`);
            player.runCommand(`execute at @e[type=ftb_tc:smeltery_controller,r=5,family=remove_check] run setblock ~ ~ ~ air`);
            player.runCommand(`execute at @e[type=ftb_tc:smeltery_controller,r=5,family=remove_check] run setblock ^1 ^ ^ air`);
            player.runCommand(`event entity @e[type=ftb_tc:smeltery_controller,r=5,family=remove_check] ftb_tc:remove`);
        }
        if (r.selection == 1) {
            player.runCommand(`playsound random.orb @s ~ ~ ~ 1 0.1`);
            player.runCommand(`event entity @e[type=ftb_tc:smeltery_controller,r=5] ftb_tc:remove_check_clear`);
        }
        if (r.canceled) {
            player.runCommand(`playsound random.orb @s ~ ~ ~ 1 0.1`);
            player.runCommand(`event entity @e[type=ftb_tc:smeltery_controller,r=5,c=1] ftb_tc:remove_check_clear`);
        }
    });
}
function seared_tank_remove(player) {
    const form = new ActionFormData()
        .title("Warning: Removing Seared Tank")
        .body("Are you absolutely sure you want to remove the Seared Tank?\n\n§sImportant:§r §bRemoving the Seared Tank will permanently destroy any materials currently stored within the Seared Tank.§r\n\nPlease double-check your decision before proceeding.\n\nIf you are certain, click 'Remove' to confirm.\n\nOtherwise, click 'Cancel' to return.")
        .button("§l§qRemove")
        .button("§l§mCancel.");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            player.runCommand(`playsound block.false_permissions @s ~ ~ ~ 1 1`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_tank,r=5] run setblock ~ ~ ~ air`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_tank,r=5] run event entity @e[type=ftb_tc:smeltery_controller,r=1] ftb_tc:remove_fuel`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_tank,r=5] run event entity @e[type=ftb_tc:smeltery_controller,r=1] ftb_tc:remove_fuel_blaze`);
            player.runCommand(`event entity @e[type=ftb_tc:seared_tank,r=5,family=remove_check] ftb_tc:remove`);
        }
        if (r.selection == 1) {
            player.runCommand(`playsound random.orb @s ~ ~ ~ 1 0.1`);
            player.runCommand(`event entity @e[type=ftb_tc:seared_tank,r=5,c=1] ftb_tc:remove_check_clear`);
        }
        if (r.canceled) {
            player.runCommand(`playsound random.orb @s ~ ~ ~ 1 0.1`);
            player.runCommand(`event entity @e[type=ftb_tc:seared_tank,r=5,c=1] ftb_tc:remove_check_clear`);
        }
    });
}
function seared_drain_remove(player) {
    const form = new ActionFormData()
        .title("Warning: Removing Seared Drain")
        .body("Are you absolutely sure you want to remove the Seared Drain?\n\n§sImportant:§r\n§b - Removing the Seared Drain will permanently destroy any materials currently stored within the Seared Drain.§r\n\n§b - Removing the Seared Drain will also remove the Smeltery Controller. This is because the Smeltery Controller is dependent on the Seared Drain for functionality.§r\n\nPlease double-check your decision before proceeding.\n\nIf you are certain, click 'Remove' to confirm.\n\nOtherwise, click 'Cancel' to return.")
        .button("§l§qRemove")
        .button("§l§mCancel.");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            player.runCommand(`playsound block.false_permissions @s ~ ~ ~ 1 1`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_drain,r=5,family=remove_check] run setblock ~ ~ ~ air`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_drain,r=5,family=remove_check] run event entity @e[type=ftb_tc:smeltery_controller,r=1] ftb_tc:remove`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_drain,r=5,family=remove_check] run setblock ~ ~ ~ air`);
            player.runCommand(`execute at @e[type=ftb_tc:seared_drain,r=5,family=remove_check] run setblock ^-1 ^ ^ air`);
            player.runCommand(`event entity @e[type=ftb_tc:seared_drain,r=5,family=remove_check] ftb_tc:remove`);
        }
        if (r.selection == 1) {
            player.runCommand(`playsound random.orb @s ~ ~ ~ 1 0.1`);
            player.runCommand(`event entity @e[type=ftb_tc:seared_drain,r=5,c=1] ftb_tc:remove_check_clear`);
        }
        if (r.canceled) {
            player.runCommand(`playsound random.orb @s ~ ~ ~ 1 0.1`);
            player.runCommand(`event entity @e[type=ftb_tc:seared_drain,r=5,c=1] ftb_tc:remove_check_clear`);
        }
    });
}
const entityToBlockMap = new Map([
    ["ftb_tc:casting_table", "ftb_tc:casting_table"],
    ["ftb_tc:casting_basin", "ftb_tc:casting_basin"],
    ["ftb_tc:melter", "ftb_tc:melter"],
    ["ftb_tc:seared_drain", "ftb_tc:seared_drain"]
]);
const dimensionTypes = ["overworld", "nether", "the_end"];
system.runInterval(() => {
    dimensionTypes.forEach(dimension => {
        const dim = world.getDimension(dimension);
        for (const entity of dim.getEntities()) {
            const entityType = entity.typeId;
            if (entityToBlockMap.has(entityType)) {
                const blockType = entityToBlockMap.get(entityType);
                const location = entity.location;
                if (location) {
                    const block = dim.getBlock(location);
                    if (block) {
                        block.setPermutation(BlockPermutation.resolve(blockType));
                    }
                }
                entity.remove();
            }
        }
    });
}, 20);
world.afterEvents.playerBreakBlock.subscribe(event => {
    const block = event.brokenBlockPermutation;
    if (block?.type.id === MinecraftBlockTypes.TallGrass || block?.type.id === MinecraftBlockTypes.ShortGrass) {
        if (Math.random() < 0.4) {
            event.block.dimension.spawnItem(new ItemStack(Ot("plant_fibre"), 1), event.block.location);
        }
    }
});
const mapping = new Map();
mapping.set(Ot("earth_grass"), Ot("earth_tall_grass"));
mapping.set(Ot("ender_grass"), Ot("ender_tall_grass"));
mapping.set(Ot("sky_grass"), Ot("sky_tall_grass"));
mapping.set(Ot("scarlet__grass"), Ot("scarlet_tall_grass"));
const lastClickTimes = new Map();
world.beforeEvents.playerInteractWithBlock.subscribe(event => {
    const item = event.itemStack;
    const block = event.block;
    const playerId = event.player.id;
    const currentTick = system.currentTick;
    // For some reason interact with block keeps getting called
    // And other events don't work for bonemeal
    if (lastClickTimes.has(playerId)) {
        const lastTick = lastClickTimes.get(playerId);
        if (lastTick && (currentTick - lastTick) < 5) {
            return;
        }
    }
    lastClickTimes.set(playerId, currentTick);
    if (item?.typeId === MinecraftItemTypes.BoneMeal) {
        if (block && mapping.has(block.type.id)) {
            const blockAbove = block.above(1);
            if (!blockAbove || !blockAbove.isAir) {
                return;
            }
            const blockToPlace = mapping.get(block.type.id);
            system.runTimeout(() => {
                blockAbove.setType(blockToPlace);
                R.overrideHeldItem(event.player, y.shrinkItemStack(item));
            }, 0);
        }
    }
});
