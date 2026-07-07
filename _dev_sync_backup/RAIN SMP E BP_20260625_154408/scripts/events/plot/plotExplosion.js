// @ts-ignore
import { world } from '@minecraft/server';
import { getAllGlobalClaims } from './plotHelpers.js';

export default {
    name: 'explosion',
    type: 0,
    run: async (ev) => {
        const impactedBlocks = ev.getImpactedBlocks();
        if (!impactedBlocks || impactedBlocks.length === 0) return;

        const dimensionId = ev.dimension?.id || 'minecraft:overworld';

        const claimed = getAllGlobalClaims();
        if (claimed && claimed.length) {
            const filteredBlocks = impactedBlocks.filter(block => {
                for (const plot of claimed) {
                    const plotDim = plot.dimension || 'minecraft:overworld';
                    if (plotDim !== dimensionId) continue;
                    if (block.x >= plot.minX && block.x <= plot.maxX && block.z >= plot.minZ && block.z <= plot.maxZ) {
                        const perms = (plot.permissions && plot.permissions.default) || plot.permissions || { protectBreak: true, protectPlace: true, protectExplosion: true, protectFireSpread: true, protectEnter: true, protectContainer: true, protectDoors: true };
                        if (perms.protectExplosion) {
                            return false;
                        }
                    }
                }
                return true;
            });
            ev.setImpactedBlocks(filteredBlocks);
        }
    }
}