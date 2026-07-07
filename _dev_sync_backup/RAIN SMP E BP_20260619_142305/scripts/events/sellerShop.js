import { world, system } from '@minecraft/server';
import { openShopForEntityPlayer } from '../systems/shop/gui/index.js';
import { toastError } from '../utils/realmPerf.js';

// We use native beforeEvents to intercept the click BEFORE the vanilla text bubble opens
world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  const player = ev.player;
  const target = ev.target;

  if (!player || player?.typeId !== 'minecraft:player') return;
  if (!target) return;

  // Check if it's our shopkeeper
  if (!target.hasTag('shopkeeper')) return;

  // THE MAGIC BULLET: This cancels the blank vanilla text bubble completely!
  ev.cancel = true;

  // Bedrock rule: You cannot open a UI in the exact same tick you cancel an event.
  // We use system.run to wait exactly 1 tick before popping the menu open.
  system.run(() => {
    try {
      openShopForEntityPlayer(player, target);
    } catch (err) {
      try { 
        toastError(player, '§cShop failed to open.', "shop_open_fail"); 
      } catch (e) {}
      console.error('sellerShop error', err);
    }
  });
});

// We leave this empty export at the bottom so your server's framework 
// doesn't crash looking for the old file structure!
export default {
  name: 'entityInteract', 
  type: 1, 
  run: () => {} 
};