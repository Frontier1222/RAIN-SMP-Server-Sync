import { Command } from '../extensions/command.js';
import { world, ItemStack, system } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';
import { addToGlobalClaims, rebuildGlobalClaimChunkCache } from '../events/plot/plotHelpers.js';
import { toastError, toastSuccess, toastWarning } from '../utils/realmPerf.js';

const MAX_CLAIM_AREA = 2000; // Normal players cannot claim a plot larger than 2,000 total blocks

export default {
    data: new Command()
    .setName('claim')
    .setDescription('Confirm plot creation'),
    run: (system, origin, args) => {
        // Wait 15 ticks so the Chat Window closes before popping the UI!
        system.runTimeout(() => {
            const player = origin.source;
            if (!player) return;

            const pos1Str = player.getDynamicProperty('plot_pos1');
            const pos2Str = player.getDynamicProperty('plot_pos2');
            if (!pos1Str || !pos2Str) {
                toastError(player, 'You must set both Pos1 and Pos2 before confirming.', 'claim_pos_missing');
                return;
            }

            const pos1 = JSON.parse(pos1Str);
            const pos2 = JSON.parse(pos2Str);
            const dimensionId = pos1.dimension || pos2.dimension || player.dimension.id;
            
            const isStaff = player.hasTag('staff');

            if ((pos1.dimension && pos1.dimension !== dimensionId) || (pos2.dimension && pos2.dimension !== dimensionId)) {
                toastError(player, 'Pos1 and Pos2 must be in the same dimension.', 'claim_dimension');
                return;
            }

            const minX = Math.floor(Math.min(pos1.x, pos2.x));
            const maxX = Math.floor(Math.max(pos1.x, pos2.x));
            const minZ = Math.floor(Math.min(pos1.z, pos2.z));
            const maxZ = Math.floor(Math.max(pos1.z, pos2.z));
            const y = Math.floor(Math.max(pos1.y ?? 0, pos2.y ?? 0) + 1);
            
            // Calculate the total surface area of the claim
            const area = (maxX - minX + 1) * (maxZ - minZ + 1);

            // --- CLAIM SIZE RESTRICTION ---
            if (!isStaff && area > MAX_CLAIM_AREA) {
                toastError(player, `Your claim is too large! The maximum allowed area is ${MAX_CLAIM_AREA} blocks. Yours is ${area} blocks.`, 'claim_too_large');
                return;
            }

            const form = new ModalFormData()
                .title('Create Plot')
                .textField('Plot name', 'Example: MyBase');

            // Add PVP toggle ONLY for admins
            if (isStaff) {
                form.toggle('Disable PVP (Protect players)', true);
            }

            form.show(player).then((res) => {
                if (res.canceled) {
                    toastWarning(player, 'Plot creation cancelled.', 'claim_cancel');
                    return;
                }

                const plotName = (res.formValues?.[0] || '').trim();
                if (!plotName) {
                    toastError(player, 'You must enter a plot name.', 'claim_name_missing');
                    return;
                }

                // If staff, read the toggle (index 1). Otherwise, default to false (PVP is NOT disabled, meaning it's allowed)
                // *Edit: Assuming you want normal player claims to be safe zones, set this default to true. 
                // If you want normal claims to allow PVP, change the `true` below to `false`.
                let protectPvp = true; 
                if (isStaff) {
                    protectPvp = !!res.formValues?.[1];
                }

                const newPlot = {
                    id: Date.now().toString(),
                    name: plotName,
                    ownerId: player.id,
                    ownerName: player.name,
                    minX, maxX, minZ, maxZ,
                    y,
                    dimension: dimensionId,
                    area,
                    permissions: { 
                        default: { 
                            protectBreak: true, 
                            protectPlace: true, 
                            protectLiquid: true,
                            protectContainer: true, 
                            protectDoors: true, 
                            protectExplosion: true, 
                            protectFireSpread: true,
                            protectEnter: true,
                            protectPvp: protectPvp,
                            allowHomes: false,
                        },
                        players: {},
                        public: {},
                    }
                };

                const claimForFaction = player.getDynamicProperty('claim_for_faction');
                if (claimForFaction) {
                    const factions = JSON.parse(world.getDynamicProperty('factions') || '[]');
                    const fac = factions.find(f => f.id === claimForFaction);
                    if (fac) {
                        newPlot.ownerId = fac.id;
                        newPlot.ownerName = fac.name;
                        newPlot.factionClaim = true;
                        fac.claims = fac.claims || [];
                        fac.claims.push(newPlot);
                        world.setDynamicProperty('factions', JSON.stringify(factions));
                        toastSuccess(player, 'Plot claimed for faction ' + fac.name, 'claim_faction');
                    } else {
                        toastError(player, 'Faction not found, creating personal plot instead.', 'claim_faction_missing');
                    }
                }

                if (!newPlot.factionClaim) {
                    const ownedStr = player.getDynamicProperty('owned_plots') || '[]';
                    let owned = [];
                    try { owned = JSON.parse(ownedStr); } catch (e) { owned = []; }
                    if (Array.isArray(owned) && owned.length >= 1000) {
                        toastError(player, 'You have reached the maximum of 1000 plots.', 'claim_max_plots');
                        player.setDynamicProperty('plot_pos1', undefined);
                        player.setDynamicProperty('plot_pos2', undefined);
                        player.setDynamicProperty('claim_for_faction', undefined);
                        player.removeTag('plot_making');
                        const original = JSON.parse(player.getDynamicProperty('original_item') || 'null');
                        const inventory = player.getComponent('minecraft:inventory');
                        if (inventory && inventory.container && original) {
                            inventory.container.setItem(player.selectedSlotIndex, new ItemStack(original.typeId, original.amount || 1));
                        }
                        return;
                    }
                    owned.push(newPlot);
                    player.setDynamicProperty('owned_plots', JSON.stringify(owned));
                }

                if (!addToGlobalClaims(newPlot)) {
                    if (!newPlot.factionClaim) {
                        const ownedStr = player.getDynamicProperty('owned_plots') || '[]';
                        let owned = [];
                        try { owned = JSON.parse(ownedStr); } catch (e) { owned = []; }
                        const rollbackIdx = owned.findIndex((p) => p && p.id === newPlot.id);
                        if (rollbackIdx > -1) {
                            owned.splice(rollbackIdx, 1);
                            player.setDynamicProperty('owned_plots', JSON.stringify(owned));
                        }
                    }
                    toastError(
                        player,
                        'Plot could not be saved to world data. Try a smaller claim or contact staff.',
                        'claim_save_failed'
                    );
                    return;
                }

                rebuildGlobalClaimChunkCache(true);

                if (!newPlot.factionClaim) {
                    toastSuccess(player, 'Plot created: ' + newPlot.name, 'claim_created');
                }

                player.setDynamicProperty('plot_pos1', undefined);
                player.setDynamicProperty('plot_pos2', undefined);
                player.setDynamicProperty('claim_for_faction', undefined);
                player.removeTag('plot_making');
                const original = JSON.parse(player.getDynamicProperty('original_item') || 'null');
                const inventory = player.getComponent('minecraft:inventory');
                if (inventory && inventory.container && original) {
                    inventory.container.setItem(player.selectedSlotIndex, new ItemStack(original.typeId, original.amount || 1));
                }
            });
        }, 15);
    }
}
