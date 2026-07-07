import { world, system } from '@minecraft/server';

world.beforeEvents.itemUse.subscribe((data) => {
    let player = data.source;
    data.itemStack.typeId;
    if (data.itemStack.typeId == "minecraft:bone_meal") {
        system.runTimeout(() => {
            player.runCommand("execute at @s anchored eyes run function ftb/tinkers/slime/loop");
        }, 0);
    }
});
