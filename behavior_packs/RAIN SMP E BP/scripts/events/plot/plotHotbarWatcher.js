import { world, ItemStack } from '@minecraft/server';
import { toastWarning } from '../../utils/realmPerf.js';
import { clearPlotClaimWandState } from './plotHelpers.js';

export default {
    name: 'playerHotbarSelectedSlotChange',
    type: 1,
    run: async (ev) => {
        try {
            const { player, newSlotSelected, previousSlotSelected } = ev;
            if (!player) return;
            if (!player.hasTag('plot_making')) return;

            const inv = player.getComponent('minecraft:inventory');
            if (!inv || !inv.container) return;

            let prevItemType = null;

            if (typeof previousSlotSelected === 'number') {
                try {
                    const previousItem = inv.container.getItem(previousSlotSelected);
                    if (previousItem) prevItemType = previousItem.typeId;
                } catch (e) {}
            }

            let newItemType = null;

            if (typeof newSlotSelected === 'number') {
                try {
                    const newItem = inv.container.getItem(newSlotSelected);
                    if (newItem) newItemType = newItem.typeId;
                } catch (e) {}
            }

            if (prevItemType === 'minecraft:wooden_axe' && newItemType !== 'minecraft:wooden_axe') {
                player.removeTag('plot_making');
                player.removeTag('plot_subclaim_making');

                player.setDynamicProperty('plot_pos1', undefined);
                player.setDynamicProperty('plot_pos2', undefined);
                player.setDynamicProperty('claim_for_faction', undefined);
                player.setDynamicProperty('subclaim_parent_id', undefined);
                clearPlotClaimWandState(player);

                const original = player.getDynamicProperty('original_item');

                if (typeof previousSlotSelected === 'number') {
                    if (original) {
                        try {
                            const orig = JSON.parse(original);

                            if (orig && orig.typeId) {
                                inv.container.setItem(
                                    previousSlotSelected,
                                    new ItemStack(orig.typeId, orig.amount || 1)
                                );
                            } else {
                                inv.container.setItem(previousSlotSelected, undefined);
                            }
                        } catch (e) {
                            inv.container.setItem(previousSlotSelected, undefined);
                        }
                    } else {
                        inv.container.setItem(previousSlotSelected, undefined);
                    }
                }

                // Important: prevents stale bd:gui / Rain UI data from being restored later.
                player.setDynamicProperty('original_item', undefined);

                toastWarning(player, 'Plot selection cancelled.', 'plot_cancel');
            } else {
                player.setDynamicProperty('plot_prev_slot', newSlotSelected);
            }
        } catch (e) {}
    }
};
