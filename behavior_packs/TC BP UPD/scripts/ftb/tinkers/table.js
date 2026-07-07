import { world, EntityComponentTypes, system } from '@minecraft/server';

function isSmelteryController(block) {
    return block?.hasTag("ftb_tc:smeltery_controller");
}
function isModifierTable(block) {
    return block?.hasTag("modifier_table");
}
function isTinkersChest(block) {
    return block?.hasTag("tinkers_chest");
}
function isFakeBarrier(block) {
    return block?.hasTag("fake_barrier");
}
function getRotationFromState(state) {
    switch (state) {
        case "north":
            return 0;
        case "south":
            return 180;
        case "west":
            return 270;
        case "east":
            return 90;
    }
}
world.afterEvents.playerPlaceBlock.subscribe((eventData) => {
    if (isSmelteryController(eventData.block)) {
        const entity = eventData.block.dimension.spawnEntity("ftb_tc:smeltery_controller", {
            x: eventData.block.x + 0.5,
            y: eventData.block.y,
            z: eventData.block.z + 0.5,
        });
        entity.setRotation({
            x: 0,
            y: getRotationFromState(eventData.block.permutation.getState("minecraft:cardinal_direction")),
        });
    }
    if (isModifierTable(eventData.block)) {
        const entity = eventData.block.dimension.spawnEntity("ftb_tc:modifier_worktable", {
            x: eventData.block.x + 0.5,
            y: eventData.block.y,
            z: eventData.block.z + 0.5,
        });
        entity.setRotation({
            x: 0,
            y: getRotationFromState(eventData.block.permutation.getState("minecraft:cardinal_direction")),
        });
    }
    if (isTinkersChest(eventData.block)) {
        const entity = eventData.block.dimension.spawnEntity("ftb_tc:chest_entity", {
            x: eventData.block.x + 0.5,
            y: eventData.block.y,
            z: eventData.block.z + 0.5,
        });
        entity.setRotation({
            x: 0,
            y: getRotationFromState(eventData.block.permutation.getState("minecraft:cardinal_direction")),
        });
    }
});
world.beforeEvents.playerBreakBlock.subscribe((eventData) => {
    if (isModifierTable(eventData.block)) {
        const entities = eventData.dimension.getEntities({
            type: "ftb_tc:modifier_worktable",
            location: eventData.block.location,
            maxDistance: 1,
            closest: 1,
        });
        if (entities.length === 0) {
            return;
        }
        const entity = entities[0];
        // Get the entities inventory and drop all items
        const inventory = entity.getComponent(EntityComponentTypes.Inventory);
        if (!inventory) {
            system.run(() => {
                entity.remove();
            });
            return;
        }
        system.run(() => {
            for (let i = 0; i < inventory.inventorySize; i++) {
                const item = inventory.container.getItem(i);
                if (!item) {
                    continue;
                }
                entity.dimension.spawnItem(item, {
                    x: entity.location.x,
                    y: entity.location.y + 1,
                    z: entity.location.z,
                });
            }
            entity.remove();
        });
    }
    if (isTinkersChest(eventData.block)) {
        const entities = eventData.dimension.getEntities({
            type: "ftb_tc:chest_entity",
            location: eventData.block.location,
            maxDistance: 1,
            closest: 1,
        });
        if (entities.length === 0) {
            return;
        }
        const entity = entities[0];
        // Get the entities inventory and drop all items
        const inventory = entity.getComponent(EntityComponentTypes.Inventory);
        if (!inventory) {
            system.run(() => {
                entity.remove();
            });
            return;
        }
        system.run(() => {
            for (let i = 0; i < inventory.inventorySize; i++) {
                const item = inventory.container.getItem(i);
                if (!item) {
                    continue;
                }
                entity.dimension.spawnItem(item, {
                    x: entity.location.x,
                    y: entity.location.y + 1,
                    z: entity.location.z,
                });
            }
            entity.remove();
        });
    }
    if (isFakeBarrier(eventData.block)) {
        const entities = eventData.dimension.getEntities({
            location: eventData.block.location,
            maxDistance: 1,
            closest: 1,
        });
        if (entities.length === 0) {
            return;
        }
        const entity = entities[0];
        system.run(() => {
            // entity.remove();
            entity.triggerEvent("ftb_tc:remove_check");
        });
    }
});

export { isTinkersChest };
