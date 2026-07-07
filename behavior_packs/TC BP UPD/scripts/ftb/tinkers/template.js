import { world, system } from '@minecraft/server';

const itemToCommand = {
    venom_potion: "ftb/tinkers/potions/venom",
    magma_potion: "ftb/tinkers/potions/magma",
    sky_slime_potion: "ftb/tinkers/potions/sky",
    earth_slime_potion: "ftb/tinkers/potions/earth",
    scarlet_slime_potion: "ftb/tinkers/potions/scarlet",
    ender_slime_potion: "ftb/tinkers/potions/ender",
    scarlet_essence_potion: "ftb/tinkers/potions/scarlet"
};
world.afterEvents.itemCompleteUse.subscribe((data) => {
    const player = data.source;
    const itemFullName = data.itemStack?.typeId;
    if (!player?.isValid || !itemFullName) {
        return;
    }
    const itemName = itemFullName.split(":")[1];
    const functionPath = itemToCommand[itemName];
    if (functionPath) {
        system.run(() => {
            if (player.isValid) {
                player.runCommand("function " + functionPath);
            }
        });
    }
});
