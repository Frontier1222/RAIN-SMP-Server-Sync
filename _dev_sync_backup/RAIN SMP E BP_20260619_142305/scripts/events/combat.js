import { markCombat } from '../utils/teleport.js';
import { refreshCombatSnapshot } from '../systems/clog/runtime.js';

export default {
  name: 'entityHurt',
  type: 1, // afterEvents
  run: (ev) => {
    const hurt = ev.hurtEntity;
    const damager = ev.damageSource?.damagingEntity;
    
    // Ensure both entities exist and are not the same entity (no self-harm tagging)
    if (!hurt || !damager) return;
    if (hurt.id === damager.id) return;

    // STRICT PVP CHECK: Only trigger combat if BOTH the attacker and victim are players!
    if (hurt.typeId === 'minecraft:player' && damager.typeId === 'minecraft:player') {
        const hurtUntil = markCombat(hurt);
        const damagerUntil = markCombat(damager);
        refreshCombatSnapshot(hurt, hurtUntil);
        refreshCombatSnapshot(damager, damagerUntil);
    }
  }
};