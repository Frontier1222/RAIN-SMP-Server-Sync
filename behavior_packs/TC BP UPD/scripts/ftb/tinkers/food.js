import { world, system, ItemStack } from '@minecraft/server';

const usableBlocks = {
    "ftb_tc:cheese_block": {
        returnItem: "ftb_tc:cheese_ingot",
        amount: 3,
        clearEffects: true,
        sound: ["random.eat", "random.burp"],
    },
    //   "ftb_tc:butter_block": {
    //     returnItem: "ftb_tc:butter_chunk",
    //     amount: 5,
    //     clearEffects: false,
    //     sound: ["random.eat"],
    //     applyEffects: [
    //       { effect: "speed", duration: 200, amplifier: 1 }
    //     ]
    //   }
};
const itemRemoveEffects = [
    "ftb_tc:cheese_ingot",
    "ftb_tc:copper_can_milk",
];
const ItemFoodEffectsComponent = {
    onConsume({ itemStack, source }) {
        const itemId = itemStack.typeId;
        if (itemRemoveEffects.includes(itemId)) {
            for (const effect of source.getEffects()) {
                source.removeEffect(effect.typeId);
            }
        }
        if (itemId === "ftb_tc:emerald_berry") {
            source.addEffect("village_hero", 600, {
                showParticles: true,
            });
        }
        if (itemId === "ftb_tc:xp_berry") {
            source.addExperience(5);
            const location = source.location;
            source.dimension.playSound("random.orb", location);
        }
        if (itemId === "ftb_tc:iron_berry") {
            source.addEffect("resistance", 600, {
                showParticles: true,
            });
        }
        if (itemId === "ftb_tc:gold_berry") {
            source.addEffect("speed", 600, {
                showParticles: true,
            });
        }
        if (itemId === "ftb_tc:diamond_berry") {
            source.addEffect("health_boost", 600, {
                showParticles: true,
            });
        }
        if (itemId === "ftb_tc:copper_berry") {
            source.addEffect("haste", 600, {
                showParticles: true,
            });
        }
    },
};
world.afterEvents.itemUse.subscribe((data) => {
    const player = data.source;
    const item = data.itemStack;
    if (!player || !player.isValid || !player.typeId.includes("player"))
        return;
    if (!item || !(item.typeId in usableBlocks))
        return;
    const blockData = usableBlocks[item.typeId];
    // Raycast check
    const headLocation = player.getHeadLocation();
    const viewDirection = player.getViewDirection();
    const blockHit = player.dimension.getBlockFromRay(headLocation, viewDirection, {
        maxDistance: 5,
        includeLiquidBlocks: false,
        includePassableBlocks: false,
    });
    if (blockHit && blockHit.block?.typeId !== "minecraft:air")
        return;
    // Sounds
    if (blockData.sound) {
        blockData.sound.forEach((sound, i) => {
            if (i === 0)
                system.run(() => player.playSound(sound));
            else
                system.runTimeout(() => player.playSound(sound), i * 10);
        });
    }
    // Clear effects if needed
    if (blockData.clearEffects) {
        for (const effect of player.getEffects()) {
            player.removeEffect(effect.typeId);
        }
    }
    if (blockData.applyEffects) {
        for (const fx of blockData.applyEffects) {
            player.addEffect(fx.effect, fx.duration, { amplifier: fx.amplifier });
        }
    }
    // Remove used block from hand
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv)
        return;
    if (item.amount - 1 <= 0) {
        inv.setItem(player.selectedSlotIndex, undefined);
    }
    else {
        item.amount--;
        inv.setItem(player.selectedSlotIndex, item);
    }
    // Add return item
    const newItem = new ItemStack(blockData.returnItem, blockData.amount);
    const remaining = inv.addItem(newItem);
    if (remaining) {
        player.dimension.spawnItem(remaining, player.location);
    }
});
system.beforeEvents.startup.subscribe((event) => {
    // Register the custom component for use in the item JSON file:
    event.itemComponentRegistry.registerCustomComponent("ftb_tc:food_effects", ItemFoodEffectsComponent);
});
