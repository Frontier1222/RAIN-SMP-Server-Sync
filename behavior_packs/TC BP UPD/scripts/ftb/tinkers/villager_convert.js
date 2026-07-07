import { world } from '@minecraft/server';

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const placedBlock = event.block;
    const blockId = placedBlock.typeId;
    // Match any wood variant of Tinkers Station
    if (!blockId.startsWith("ftb_tc:tinkers_station_"))
        return;
    const blockLoc = placedBlock.location;
    const dimension = placedBlock.dimension;
    const villagers = dimension.getEntities({
        families: ["villager"],
        location: {
            x: blockLoc.x + 0.5,
            y: blockLoc.y,
            z: blockLoc.z + 0.5
        },
        maxDistance: 2
    });
    const firstVillager = villagers[0];
    if (!firstVillager) {
        return;
    }
    if (firstVillager?.typeId === "ftb_tc:wandering_tinker") {
        return;
    }
    dimension.spawnEntity("ftb_tc:wandering_tinker", firstVillager.location);
    for (let i = 0; i < 5; i++) {
        dimension.spawnParticle("minecraft:villager_happy", {
            x: firstVillager.location.x + (Math.random() - 0.5) * 2,
            y: firstVillager.location.y + Math.random() * 2,
            z: firstVillager.location.z + (Math.random() - 0.5) * 2
        });
    }
    firstVillager.remove();
});
