import { world, Player } from "@minecraft/server";
import { commandHandler } from "../../event-listeners/world-initialize.js";
import { openMainGui } from "../../commands/gui/form-generator.js";
/**
 * Handles item use events to trigger the Paradox GUI if a configured item is used.
 */
class ItemUseSubscription {
    callback = null;
    /**
     * Subscribes to the world itemUse event.
     */
    subscribe() {
        if (this.callback)
            return;
        this.callback = (event) => {
            const player = event.source;
            if (!(player instanceof Player))
                return;
            const guiItem = commandHandler.getGuiItem();
            // Check if the used item matches the configured trigger item
            if (guiItem && event.itemStack.typeId === guiItem) {
                openMainGui(player);
            }
        };
        world.afterEvents.itemUse.subscribe(this.callback);
    }
    unsubscribe() {
        if (!this.callback)
            return;
        world.afterEvents.itemUse.unsubscribe(this.callback);
        this.callback = null;
    }
}
export const itemUseSubscription = new ItemUseSubscription();
