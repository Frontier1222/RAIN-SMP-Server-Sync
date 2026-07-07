import { ItemStack } from "@minecraft/server";

export function countItemsByType(container, typeId) {
  let total = 0;
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (it && it.typeId === typeId) total += it.amount ?? 1;
  }
  return total;
}

export function takeItemsByType(container, typeId, amount) {
  let remaining = amount;

  for (let i = 0; i < container.size && remaining > 0; i++) {
    const it = container.getItem(i);
    if (!it || it.typeId !== typeId) continue;

    if (it.amount <= remaining) {
      remaining -= it.amount;
      container.setItem(i, undefined);
    } else {
      it.amount -= remaining;
      container.setItem(i, it);
      remaining = 0;
    }
  }
  return remaining === 0;
}

export function giveItemToPlayer(player, stack) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;

  const leftover = inv.addItem(stack);
  if (leftover) {
    player.dimension.spawnItem(leftover, player.location);
  }
}
