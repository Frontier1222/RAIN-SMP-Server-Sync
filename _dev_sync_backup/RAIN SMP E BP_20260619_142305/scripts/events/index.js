import plotPos from './plot/plotPos.js';

import plotProtection, {
    plotPlaceProtection,
    plotInteractProtection,
    plotContainerProtection,
    plotDoorProtection,
    plotItemFrameUseProtection,
    plotDecorFrameInteractRestore,
    plotDecorFrameUseRestore,
    plotDecorFrameBreakRestore,
    plotDecorSwingSnapshot,
    plotDecorFrameHitBefore,
    plotDecorFrameHitRestore,
    plotDecorFrameInventoryRestore,
    plotLogStripUseProtection,
    plotLogStripInteractProtection,
    plotLiquidUseProtection,
    plotLiquidInteractProtection,
    plotLiquidItemUseProtection,
    plotLiquidPlaceProtection,
    plotEntityInteractProtection,
    plotDecorEntityInteractRestore,
    plotEntityKillProtection,
    plotDecorEntityHitProtection,
    plotDecorEntityHitRestore,
    plotDecorEntityHurtRestore,
    plotDecorEntityDieProtection,
    plotDecorEntityDieRestoreProtection,
    plotEnderPearlProtection,
    plotCreativeRoleItemUseProtection,
    plotCreativeRoleItemUseOnProtection,
    plotCreativeRoleDropProtection,
    plotTinkersToolUseProtection,
    plotTinkersToolUseOnProtection,
} from './plot/plotProtection.js';

import plotExplosion from './plot/plotExplosion.js';
import { plotFirePlaceProtection, plotFireIgniteProtection, plotFireInteractProtection, plotFireItemUseProtection } from './plot/plotFireSpread.js';
import gui from './gui.js';
import plotHotbarWatcher from './plot/plotHotbarWatcher.js';
import cps from './cps.js';
import kdcount from './kdcount.js';
import cleanup from './cleanup.js';
import chat from './chat.js';
import combat from './combat.js';
import clogSpawn from './clogSpawn.js';
import clogLeave from './clogLeave.js';
import sellerShop from './sellerShop.js';

export const eventRegistry = [
    plotTinkersToolUseProtection,
    plotTinkersToolUseOnProtection,
    plotCreativeRoleItemUseProtection,
    plotCreativeRoleItemUseOnProtection,
    plotCreativeRoleDropProtection,
    combat,
    clogSpawn,
    clogLeave,
    plotPos,
    plotProtection,
    plotPlaceProtection,
    plotContainerProtection,
    plotDoorProtection,
    plotInteractProtection,
    plotItemFrameUseProtection,
    plotDecorFrameInteractRestore,
    plotDecorFrameUseRestore,
    plotDecorFrameBreakRestore,
    plotDecorSwingSnapshot,
    plotDecorFrameHitBefore,
    plotDecorFrameHitRestore,
    plotDecorFrameInventoryRestore,
    plotLogStripUseProtection,
    plotLogStripInteractProtection,
    plotLiquidUseProtection,
    plotLiquidInteractProtection,
    plotLiquidItemUseProtection,
    plotLiquidPlaceProtection,
    plotEntityInteractProtection,
    plotDecorEntityInteractRestore,
    plotEntityKillProtection,
    plotDecorEntityHitProtection,
    plotDecorEntityHitRestore,
    plotDecorEntityHurtRestore,
    plotDecorEntityDieProtection,
    plotDecorEntityDieRestoreProtection,
    plotEnderPearlProtection,
    plotExplosion,
    plotFirePlaceProtection,
    plotFireIgniteProtection,
    plotFireInteractProtection,
    plotFireItemUseProtection,
    chat,
    gui,
    plotHotbarWatcher,
    cps,
    kdcount,
    cleanup,
    sellerShop
];