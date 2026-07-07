import { world, system } from '@minecraft/server';
import { updateDurability } from './durability.js';

/**
 * Yes, I named it this because it sounds like stripping ex's and I thought it was funny
 * - Mikey
 */
const conversionLookup = {
    "minecraft:acacia_log": "minecraft:stripped_acacia_log",
    "minecraft:oak_log": "minecraft:stripped_oak_log",
    "minecraft:spruce_log": "minecraft:stripped_spruce_log",
    "minecraft:birch_log": "minecraft:stripped_birch_log",
    "minecraft:jungle_log": "minecraft:stripped_jungle_log",
    "minecraft:dark_oak_log": "minecraft:stripped_dark_oak_log",
    "minecraft:mangrove_log": "minecraft:stripped_mangrove_log",
    "minecraft:cherry_log": "minecraft:stripped_cherry_log",
    "minecraft:warped_stem": "minecraft:stripped_warped_stem",
    "minecraft:crimson_stem": "minecraft:stripped_crimson_stem",
    "minecraft:bamboo_block": "minecraft:stripped_bamboo_block",
};
/**
 * Having a blank onUseOn function allows the item to animate on a right-click but we
 * still can't update the durability of the item.
 */
class StrippingAxes {
    constructor() {
        this.onUseOn = (arg0, arg1) => {
        };
    }
}
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const itemInHand = event.itemStack;
    if (!itemInHand || !itemInHand.typeId.startsWith("ftb_tc:hand_axe")) {
        return;
    }
    const objKeys = Object.keys(conversionLookup);
    if (!objKeys.includes(event.block.typeId)) {
        return;
    }
    system.run(() => {
        updateDurability(itemInHand, event.player);
    });
});

export { StrippingAxes };
