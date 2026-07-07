import { world } from '@minecraft/server';
import { SievesAPI as F, MeshType as ht, SieveBlockType as ft } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { TCItems } from '../constants.js';

world.afterEvents.worldLoad.subscribe((event) => {
    F.addSiftingDrop(TCItems.TIN_SCRAP, 26, ht.DIAMOND, ft.GRAVEL);
    F.addSiftingDrop(TCItems.TIN_SCRAP, 30, ht.EMERALD, ft.GRAVEL);
    F.addSiftingDrop(TCItems.TIN_SCRAP, 24, ht.IRON, ft.GRAVEL);
    F.addSiftingDrop(TCItems.TIN_SCRAP, 20, ht.FLINT, ft.GRAVEL);
    F.addSiftingDrop(TCItems.TIN_SCRAP, 18, ht.STRING, ft.GRAVEL);
    F.addSiftingDrop(TCItems.ARDITE_SCRAP, 2, ht.DIAMOND, ft.CRUSHED_NETHERRACK);
    F.addSiftingDrop(TCItems.ARDITE_SCRAP, 2, ht.EMERALD, ft.CRUSHED_NETHERRACK);
    F.addSiftingDrop(TCItems.COBALT_SCRAP, 6, ht.DIAMOND, ft.CRUSHED_NETHERRACK);
    F.addSiftingDrop(TCItems.COBALT_SCRAP, 6, ht.EMERALD, ft.CRUSHED_NETHERRACK);
    F.addSiftingDrop(TCItems.COBALT_SCRAP, 6, ht.IRON, ft.CRUSHED_NETHERRACK);
});
