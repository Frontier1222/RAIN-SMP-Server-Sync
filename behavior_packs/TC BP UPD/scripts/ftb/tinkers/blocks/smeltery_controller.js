import { world, system } from '@minecraft/server';
import { sendTranslated, getOppositeDirection, getDirectionFromFacing } from '../utils.js';
import { BlockUtils as zt, PlayerUtils as R, StringTransforms as Xt, ItemUtils as y } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';
import { ActionFormData } from '@minecraft/server-ui';
import { SmelteryHandler } from './handlers/smeltery.js';
import { MinecraftBlockTypes } from '../minecraft_vanilla_data.js';

class SmelteryBlockComponent {
    constructor() {
        this.onPlayerInteract = (event, parameters) => {
            const block = event.block;
            const player = event.player;
            const stack = R.getHeldItem(player);
            const smelteryHandler = SmelteryHandler.tryGet(block);
            if (smelteryHandler === undefined) {
                sendTranslated(player, "ftb_tc.smeltery.info.no_entity");
                return;
            }
            if (!smelteryHandler.isBuilt()) {
                const notBuiltMessage = smelteryHandler.getNotBuiltMessage();
                sendTranslated(player, notBuiltMessage);
                return;
            }
            if (!stack) {
                return;
            }
            const message = smelteryHandler.tryToSmeltItem(player, stack);
            if (message) {
                sendTranslated(player, message);
            }
        };
        this.onTick = (event, parameters) => {
            const block = event.block;
            const smelteryHandler = SmelteryHandler.tryGet(block);
            if (smelteryHandler === undefined || !smelteryHandler.isBuilt()) {
                return;
            }
            const direction = Xt.capitalize(zt.getBlockState(block.permutation, "minecraft:cardinal_direction"));
            const blockFromDirection = zt.getBlockFromDirection(block, getOppositeDirection(direction));
            if (blockFromDirection?.typeId !== MinecraftBlockTypes.Hopper) {
                return;
            }
            if (getDirectionFromFacing(blockFromDirection.permutation.getState("facing_direction")) !== direction) {
                return undefined;
            }
            if (blockFromDirection.permutation.getState("toggle_bit") === true) {
                return undefined;
            }
            const blockContainer = zt.getBlockContainer(blockFromDirection);
            if (!blockContainer) {
                return;
            }
            const activeMaterials = smelteryHandler.getMaterial();
            const tanks = smelteryHandler.getTanks();
            for (let i = 0; i < blockContainer.size; i++) {
                const containerStack = blockContainer.getItem(i);
                const message = smelteryHandler.tryToSmeltItem(undefined, containerStack, activeMaterials, tanks);
                if (message === undefined) {
                    blockContainer.setItem(i, y.shrinkItemStack(containerStack));
                    return;
                }
            }
        };
    }
}
world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const block = event.block;
    const player = event.player;
    if (block.typeId !== "ftb_tc:smeltery_controller") {
        return;
    }
    event.cancel = true;
    system.runTimeout(() => {
        smeltery_remove(player, block);
    }, 0);
});
function smeltery_remove(player, block) {
    const form = new ActionFormData()
        .title("Warning: Removing Smeltery Controller")
        .body("Are you absolutely sure you want to remove the Smeltery Controller?\n\n§sImportant:§r\n§b - Removing the controller will permanently destroy any materials currently stored within the smeltery.§r\n\n§b - Removing the Smeltery Controller will also remove the Seared Drain.§r\n\nPlease double-check your decision before proceeding.\n\nIf you are certain, click 'Remove' to confirm.\n\nOtherwise, click 'Cancel' to return.")
        .button("§l§qRemove")
        .button("§l§mCancel.");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            if (!block.isValid) {
                return;
            }
            if (block.typeId !== "ftb_tc:smeltery_controller") {
                return;
            }
            zt.fakeBlockBreak(block, player);
            return;
        }
        if (r.selection == 1 || r.canceled) {
            player.playSound("random.orb", {
                location: player.location,
                volume: 1,
                pitch: 0.1
            });
        }
    });
}

export { SmelteryBlockComponent, smeltery_remove };
