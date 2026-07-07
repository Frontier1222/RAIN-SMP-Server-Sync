import { world, system, EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import { isTinkersTool } from './durability.js';
import { modifierPlayerTick } from './modifiers/modifier_effects.js';
import { ultimine_main } from './ultimine_form.js';
import { tc as Ot } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const playerControllerMap = new Map();
playerControllerMap.clear();
const books = [
    "ftb_tc:materials_and_you",
    "ftb_tc:puny_smelting",
    "ftb_tc:gadgetry",
    "ftb_tc:mighty_smelting",
    "ftb_tc:modifiers",
];
world.afterEvents.projectileHitEntity.subscribe((event) => {
    const entThatWasHit = event.getEntityHit();
    if (!entThatWasHit || !entThatWasHit.entity) {
        return;
    }
    const hitEntity = entThatWasHit.entity;
    if (hitEntity.typeId !== "minecraft:player") {
        return;
    }
    if (playerControllerMap.has(hitEntity.id)) {
        const controller = playerControllerMap.get(hitEntity.id);
        if (controller.noNoKnockbackIsOn) {
            hitEntity.applyKnockback({ x: 0, z: -1 }, 0.4); // ✅ fixed
        }
    }
});
world.afterEvents.entityHitEntity.subscribe((event) => {
    if (event.hitEntity.typeId !== "minecraft:player") {
        return;
    }
    if (playerControllerMap.has(event.hitEntity.id)) {
        const controller = playerControllerMap.get(event.hitEntity.id);
        if (controller.noNoKnockbackIsOn) {
            // event.hitEntity.getVelocity();
            event.hitEntity.applyKnockback({ x: 0, z: 0 }, 0); // ✅ fixed
        }
    }
});
class PlayerController {
    constructor(player) {
        this.state = {
            currentHandItem: null,
            jumping: false,
            wasSneaking: false,
            lastSneakTime: 0,
        };
        this.magnetIsOn = false;
        this.jumpBoiIsOn = false;
        this.noNoKnockbackIsOn = false;
        this.justJumped = false;
        this.isFastBoi = false;
        this.player = player;
    }
    tick() {
        if (!this.player)
            return;
        let playerDoubleSneak = false;
        if (this.player.isSneaking && !this.state.wasSneaking) {
            this.state.wasSneaking = true;
        }
        if (!this.player.isSneaking && this.state.wasSneaking) {
            this.state.wasSneaking = false;
            const currentTime = system.currentTick;
            if (currentTime - this.state.lastSneakTime < 16) {
                this.state.lastSneakTime = currentTime;
                playerDoubleSneak = true;
            }
            else {
                this.state.lastSneakTime = currentTime;
            }
        }
        let toggleOff = false;
        const inventory = this.player.getComponent(EntityComponentTypes.Equippable);
        if (!inventory)
            return;
        const mainHandItem = inventory.getEquipment(EquipmentSlot.Mainhand);
        if (!mainHandItem) {
            toggleOff = true;
        }
        else {
            this.state.currentHandItem = mainHandItem.typeId;
        }
        modifierPlayerTick(this, inventory, mainHandItem);
        if (mainHandItem && mainHandItem.typeId.startsWith("ftb_tc:")) {
            if (playerDoubleSneak) {
                const itemProps = mainHandItem.getDynamicPropertyIds();
                if (itemProps.includes(Ot("ultimine"))) {
                    ultimine_main(this.player);
                }
            }
            const isTool = isTinkersTool(mainHandItem);
            const isMagneticTool = isTool && mainHandItem.typeId.includes("iron");
            const isJumpyTool = isTool && mainHandItem.typeId.includes("queens_slime");
            const isNoKnockbackTool = isTool && mainHandItem.typeId.includes("netherite");
            const isSpeedTool = isTool && shouldHaveSpeed(mainHandItem.typeId);
            this.magnetIsOn = isMagneticTool;
            this.jumpBoiIsOn = isJumpyTool;
            this.noNoKnockbackIsOn = isNoKnockbackTool;
            this.isFastBoi = isSpeedTool;
        }
        else {
            toggleOff = true;
        }
        if (toggleOff &&
            (this.magnetIsOn || this.jumpBoiIsOn || this.noNoKnockbackIsOn || this.isFastBoi)) {
            this.magnetIsOn = false;
            this.jumpBoiIsOn = false;
            this.noNoKnockbackIsOn = false;
            this.isFastBoi = false;
        }
        if (system.currentTick % 20 === 0)
            this.scanPlayersInventory();
        if (this.magnetIsOn && system.currentTick % 10 === 0)
            this.magnetItems();
        if (this.player.isJumping && !this.justJumped) {
            if (this.jumpBoiIsOn) {
                this.justJumped = true;
                // const viewDirection = this.player.getViewDirection();
                this.player.applyKnockback({ x: 0, z: 0 }, 1);
            }
            this.playerJumped();
        }
        if (!this.player.isJumping && this.player.isOnGround && this.justJumped) {
            this.justJumped = false;
        }
        if (this.player.isFalling && this.justJumped && this.jumpBoiIsOn) {
            const location = this.player.location;
            const below = {
                x: location.x,
                y: location.y - 3,
                z: location.z,
            };
            const block = this.player.dimension.getBlock(below);
            if (!block.isAir && !this.player.getEffect("slow_falling")) {
                this.player.addEffect("slow_falling", 10, {
                    amplifier: 0,
                    showParticles: false,
                });
            }
        }
        if (this.isFastBoi) {
            const speedEffect = this.player.getEffect("speed");
            if (!speedEffect || speedEffect.duration < 20) {
                this.player.addEffect("speed", 60, {
                    amplifier: 0,
                    showParticles: false,
                });
            }
        }
    }
    magnetItems() {
        const items = this.player.dimension.getEntities({
            location: this.player.location,
            maxDistance: 6,
            type: "item",
        });
        for (const ent of items) {
            const dx = this.player.location.x - ent.location.x;
            const dy = this.player.location.y - ent.location.y;
            const dz = this.player.location.z - ent.location.z;
            const velocity = 0.5;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            ent.applyImpulse({
                x: (dx / distance) * velocity,
                y: (dy / distance) * velocity,
                z: (dz / distance) * velocity,
            });
        }
    }
    scanPlayersInventory() {
        const inventory = this.player.getComponent(EntityComponentTypes.Inventory);
        if (!inventory)
            return;
        const container = inventory.container;
        if (!container)
            return;
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item ||
                !item.typeId.startsWith("ftb_tc:") ||
                !isTinkersTool(item) ||
                item.keepOnDeath)
                continue;
            if (item.typeId.includes("amethyst_bronze")) {
                item.keepOnDeath = true;
                container.setItem(i, item);
            }
        }
    }
    playerJumped() {
        const equippable = this.player.getComponent(EntityComponentTypes.Equippable);
        if (!equippable)
            return;
        const item = equippable.getEquipment(EquipmentSlot.Mainhand);
        if (!item)
            return;
        books.forEach((book) => this.closeBlook(item, book));
    }
    closeBlook(item, bookName) {
        if (!item.typeId.startsWith(bookName + "_"))
            return;
        this.player.runCommand("playsound item.book.page_turn @a ~~~");
        this.player.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${bookName}`);
    }
}
function shouldHaveSpeed(typeId) {
    if (typeId.includes("gold") && !typeId.includes("rose"))
        return true;
    if (typeId.includes("rose_gold")) {
        const parts = typeId.split("_");
        let prev = "";
        for (const word of parts) {
            if (word === "gold" && prev !== "rose")
                return true;
            prev = word;
        }
    }
    return false;
}
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        if (!playerControllerMap.has(player.id)) {
            const controller = new PlayerController(player);
            playerControllerMap.set(player.id, controller);
        }
        else {
            playerControllerMap.get(player.id)?.tick();
        }
    }
});

export { PlayerController };
