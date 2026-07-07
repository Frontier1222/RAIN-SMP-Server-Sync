import { world, BlockPermutation } from '@minecraft/server';
import { getOppositeFace } from './slingshot.js';

world.afterEvents.projectileHitBlock.subscribe((event) => {
    if (event.projectile.typeId === "ftb_tc:glowball_entity") {
        // Compute the face of the block that was hit
        const hit = event.getBlockHit();
        
        // Set the block at the location of the opposite face
        const dir = fixDirectionNaming(hit.face);
        let blockOpposite = hit.block[dir]();
        
        if (!blockOpposite.isAir) {
            return;
        }
        if (!event.projectile) {
            return;
        }
        
        try {
            event.projectile?.remove();
        }
        catch {
            // I don't care
        }
        
        if (hit.face === "Up") {
            const blockBelow = event.dimension.getBlock({
                x: blockOpposite.location.x,
                y: blockOpposite.location.y - 1,
                z: blockOpposite.location.z
            });
            if (blockBelow?.isAir) {
                blockOpposite = blockBelow;
            }
        }
        
        let newBlock = BlockPermutation.resolve("ftb_tc:glow");
        // Mutate the permutation to have the correct state
        newBlock = newBlock.withState("minecraft:facing_direction", getOppositeFace(hit.face, true));
        blockOpposite.setPermutation(newBlock);
    }
});

function fixDirectionNaming(direction) {
    if (direction === "Up") {
        return "above";
    }
    if (direction === "Down") {
        return "below";
    }
    return direction.toLowerCase();
}