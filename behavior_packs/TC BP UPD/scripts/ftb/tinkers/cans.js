import { ItemStack } from '@minecraft/server';
import { isEntityPlayer, exchangeMainHandItem } from './utils.js';

class CanInteractComponent {
    
    // THE FIX: Define this as a class method, not inside a constructor!
    onUseOn(arg) {
        const source = arg.source;
        if (!isEntityPlayer(source)) {
            return;
        }
        
        const blockInFront = source.getBlockFromViewDirection({
            includeLiquidBlocks: true
        });
        if (!blockInFront) {
            return;
        }
        
        // Calculate the block at the position and see if it's too far away
        const playerLocation = source.location;
        const targetLocation = blockInFront.block.location;
        const distanceAway = computeDistanceBetweenTwoPoints(playerLocation, targetLocation);
        
        if (distanceAway > 8) {
            return;
        }
        
        if (!blockInFront.block.isLiquid) {
            return;
        }
        
        // Check if it's lava
        if (!blockInFront.block.permutation.matches("minecraft:lava")) {
            return;
        }
        
        exchangeMainHandItem(source, new ItemStack("ftb_tc:copper_can_lava", 1));
        source.playSound("bucket.fill_lava");
    }
}

/**
 * Compute the 3d distance between two points using the Euclidean distance formula
 */
function computeDistanceBetweenTwoPoints(locationOne, locationTwo) {
    const x = locationOne.x - locationTwo.x;
    const y = locationOne.y - locationTwo.y;
    const z = locationOne.z - locationTwo.z;
    return Math.sqrt(x * x + y * y + z * z);
}

export { CanInteractComponent };