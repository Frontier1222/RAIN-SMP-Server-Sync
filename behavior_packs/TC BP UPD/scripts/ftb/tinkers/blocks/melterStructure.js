import { world, BlockPermutation, ItemStack } from '@minecraft/server';

const MELTER_ID = "ftb_tc:melter";
const PROXY_ID = "ftb_tc:melter_proxy";
// === Placement: auto-place proxy above melter ===
world.afterEvents.playerPlaceBlock.subscribe(event => {
    const block = event.block;
    const dimension = block.dimension;
    if (block.typeId !== MELTER_ID)
        return;
    const above = dimension.getBlock({
        x: block.location.x,
        y: block.location.y + 1,
        z: block.location.z
    });
    // If blocked, cancel placement and drop item
    if (!above || !above.permutation.matches("minecraft:air")) {
        block.setPermutation(BlockPermutation.resolve("minecraft:air"));
        dimension.spawnItem(new ItemStack(MELTER_ID, 1), block.location);
        return;
    }
    above.setPermutation(BlockPermutation.resolve(PROXY_ID));
});
// === Break: clean up the other block ===
world.afterEvents.playerBreakBlock.subscribe(event => {
    const { block, brokenBlockPermutation } = event;
    const dimension = block.dimension;
    if (brokenBlockPermutation.type.id === MELTER_ID) {
        const above = dimension.getBlock({
            x: block.location.x,
            y: block.location.y + 1,
            z: block.location.z
        });
        if (above?.typeId === PROXY_ID) {
            above.setPermutation(BlockPermutation.resolve("minecraft:air"));
        }
    }
    if (brokenBlockPermutation.type.id === PROXY_ID) {
        const below = dimension.getBlock({
            x: block.location.x,
            y: block.location.y - 1,
            z: block.location.z
        });
        if (below?.typeId === MELTER_ID) {
            below.setPermutation(BlockPermutation.resolve("minecraft:air"));
        }
    }
});
