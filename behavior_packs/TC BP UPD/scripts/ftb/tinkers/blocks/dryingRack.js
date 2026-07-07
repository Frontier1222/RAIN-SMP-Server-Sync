import { ItemStack, EntityComponentTypes, EquipmentSlot, system } from '@minecraft/server';
import { serializeVec3 } from '../modifiers/modifier_effects.js';
import { tc as Ot, BlockUtils as zt, mc as Nt, ItemUtils as y } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

/**
 * Supports up to 16 different conversions
 */
const conversions = [
    {
        input: "rotten_flesh",
        inputState: "monster",
        output: Ot("jerky_monster"),
        time: 30 // 30 seconds
    },
    {
        input: "beef",
        inputState: "beef",
        output: Ot("jerky_beef"),
        time: 30 // 30 seconds
    },
    {
        input: "chicken",
        inputState: "chicken",
        output: Ot("jerky_chicken"),
        time: 30 // 30 seconds
    },
    {
        input: "tropical_fish",
        inputState: "clownfish",
        output: Ot("jerky_clownfish"),
        time: 30 // 30 seconds
    },
    {
        input: "cod",
        inputState: "fish",
        output: Ot("jerky_fish"),
        time: 30 // 30 seconds
    },
    {
        input: "mutton",
        inputState: "mutton",
        output: Ot("jerky_mutton"),
        time: 30 // 30 seconds
    },
    {
        input: "porkchop",
        inputState: "pork",
        output: Ot("jerky_pork"),
        time: 30 // 30 seconds
    },
    {
        input: "pufferfish",
        inputState: "pufferfish",
        output: Ot("jerky_puffferfish"),
        time: 30 // 30 seconds
    },
    {
        input: "rabbit",
        inputState: "rabbit",
        output: Ot("jerky_rabbit"),
        time: 30 // 30 seconds
    },
    {
        input: "salmon",
        inputState: "salmon",
        output: Ot("jerky_salmon"),
        time: 30 // 30 seconds
    },
];
if (conversions.length > 16) {
    throw new Error("Too many conversions, only 16 are supported");
}
const blockProcessingMap = new Map();
class DryingRackComponent {
    constructor() {
        this.onPlayerInteract = (event) => {
            if (!event.player) {
                return;
            }
            const block = event.block;
            const itemType = zt.getBlockState(block.permutation, Ot("item_type")) ?? "empty";
            const isDried = zt.getBlockState(block.permutation, Ot("is_dried")) ?? false;
            if (itemType !== "empty" && !isDried) {
                // Give back the item that's drying
                const conversion = conversions.find(c => c.inputState === itemType);
                const itemStack = new ItemStack(Nt(conversion.input));
                event.player.dimension.spawnItem(itemStack, event.block.location);
                // Update the block state
                zt.updateBlockStates(block, {
                    [Ot("item_type")]: "empty",
                    [Ot("is_dried")]: false
                });
            }
            else if (itemType !== "empty" && isDried) {
                const resultItem = conversions.find(c => c.inputState === itemType);
                if (!resultItem) {
                    return;
                }
                // Give the result to the player
                const itemStack = new ItemStack(resultItem.output);
                event.player.dimension.spawnItem(itemStack, event.block.location);
                // Update the block state
                zt.updateBlockStates(block, {
                    [Ot("item_type")]: "empty",
                    [Ot("is_dried")]: false
                });
            }
            else if (itemType === "empty") {
                // Take the item from the player and start drying it
                const equipment = event.player.getComponent(EntityComponentTypes.Equippable);
                if (!equipment) {
                    return;
                }
                const mainHand = equipment.getEquipment(EquipmentSlot.Mainhand);
                if (!mainHand) {
                    return;
                }
                const itemTypeId = mainHand.typeId;
                const conversion = conversions.find(c => c.input === itemTypeId.replace("minecraft:", ""));
                if (!conversion) {
                    return;
                }
                // Update the block state
                zt.updateBlockStates(block, {
                    [Ot("is_dried")]: false,
                    [Ot("item_type")]: conversion.inputState
                });
                // Remove the item from the player
                equipment.setEquipment(EquipmentSlot.Mainhand, y.shrinkItemStack(mainHand));
            }
        };
        this.onTick = (event) => {
            if (system.currentTick % 20 !== 0) {
                return;
            }
            const block = event.block;
            const strBlockLocation = serializeVec3(block.location);
            if (zt.getBlockState(block.permutation, Ot("is_dried")) === true) {
                if (blockProcessingMap.has(strBlockLocation)) {
                    blockProcessingMap.delete(strBlockLocation);
                }
                return;
            }
            const processingTime = blockProcessingMap.get(strBlockLocation) ?? 0;
            blockProcessingMap.set(strBlockLocation, processingTime + 1);
            // Each second try and process the item
            const currentItem = zt.getBlockState(block.permutation, Ot("item_type"));
            if (!currentItem || currentItem === "empty") {
                return;
            }
            const conversion = conversions.find(c => c.inputState === currentItem);
            if (!conversion) {
                return;
            }
            if (processingTime >= conversion.time) {
                // Process the item
                zt.updateBlockState(block, Ot("is_dried"), true);
                blockProcessingMap.delete(strBlockLocation);
            }
        };
    }
}

export { DryingRackComponent };
