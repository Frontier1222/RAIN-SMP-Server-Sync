import { melterLogic } from './melter.js';

class MelterProxyComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            const { block, player, dimension } = event;
            if (!block || !player)
                return;
            const below = dimension.getBlock({
                x: block.location.x,
                y: block.location.y - 1,
                z: block.location.z,
            });
            if (!below || below.typeId !== "ftb_tc:melter")
                return;
            // Call Melter logic directly
            melterLogic.handleInteraction(player, below, dimension);
        };
    }
}

export { MelterProxyComponent };
