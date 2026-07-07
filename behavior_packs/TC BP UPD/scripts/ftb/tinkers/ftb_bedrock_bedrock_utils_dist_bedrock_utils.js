import { BlockComponentTypes, Direction, system, BlockVolume, EquipmentSlot, GameMode, PlayerPermissionLevel, ItemComponentTypes, EnchantmentTypes, ItemTypes, EntityComponentTypes } from '@minecraft/server';
import '@minecraft/server-ui';

var Z = Object.defineProperty;
var Q = (i, t, e) => t in i ? Z(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e;
var d = (i, t, e) => Q(i, typeof t != "symbol" ? t + "" : t, e);
class X {
  /**
   * Generates a random number between a minimum and maximum value
   *
   * @param min
   * @param max
   *
   * @returns a random number between min and max
   */
  static randomRanged(t, e) {
    if (t > e)
      throw new Error("min must be less than or equal to max");
    return Math.random() * (e - t) + t;
  }
  /**
   * Generates a random integer between 0 and Number.MAX_SAFE_INTEGER
   *
   * @returns a random integer
   */
  static randomInt() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }
  /**
   * Clamps a value between a minimum and maximum value
   *
   * @param value input value
   * @param min minimum value
   * @param max maximum value
   *
   * @returns the clamped value
   */
  static clamp(t, e, n) {
    return Math.min(Math.max(t, e), n);
  }
  /**
   * Checks if a number is even
   *
   * @param value input value
   * @returns whether the value is even
   */
  static isEven(t) {
    return t % 2 === 0;
  }
  /**
   * Checks if a number is odd
   *
   * @param value input value
   * @returns whether the value is odd
   */
  static isOdd(t) {
    return !this.isEven(t);
  }
}
d(X, "TICKS_PER_SECOND", 20);
function Rt(i, t, e) {
  return { x: i, y: t, z: e };
}
class I {
  /**
   * Checks if the given Vector3's locations are the same
   *
   * @param vec1 the first Vector3
   * @param vec2 the second Vector3
   * @return if the given Vector3's locations are the same
   */
  static equals(t, e) {
    return !t || !e ? !1 : t.x === e.x && t.y === e.y && t.z === e.z;
  }
  /**
   * Adds given values to the Vector3
   *
   * @param vec3 the location
   * @param x the x amount to add
   * @param y the y amount to add
   * @param z the z amount to add
   */
  static addRaw(t, e, n, s) {
    return {
      x: t.x + e,
      y: t.y + n,
      z: t.z + s
    };
  }
  /**
   * Removes given values to the Vector3
   *
   * @param vec3 the location
   * @param x the x amount to remove
   * @param y the y amount to remove
   * @param z the z amount to remove
   */
  static subtractRaw(t, e, n, s) {
    return this.addRaw(t, -e, -n, -s);
  }
  /**
   * Adds given Vector3's together
   *
   * @param vecA first Vector3 to add
   * @param vecB second Vector3 to add
   * @return a new Vector3 with the locations added together
   */
  static add(t, e) {
    return this.addRaw(t, e.x, e.y, e.z);
  }
  /**
   * Subtracts given Vector3's from each other
   *
   * @param vecA first Vector3 to subtract from
   * @param vecB second Vector3 to subtract
   *
   * @return a new Vector3 with the locations subtracted
   */
  static subtract(t, e) {
    return this.subtractRaw(t, e.x, e.y, e.z);
  }
  /**
   * Zeroes out the Vector3's locations, rounding them down to the nearest integer
   *
   * @param vec3 the Vector3 to zero out
   * @return a new Vector3 with the locations zeroed out
   */
  static floor(t) {
    return {
      x: Math.floor(t.x),
      y: Math.floor(t.y),
      z: Math.floor(t.z)
    };
  }
  /**
   * Converts the Vector3 to a string
   *
   * @param vec3 the Vector3 to convert to string
   * @param separator the separator to use between the coordinates, defaults to a space
   * @return the vec3 formatted as a string
   */
  static toString(t, e = " ") {
    return `${t.x}${e}${t.y}${e}${t.z}`;
  }
  /**
   * creates a Vector3 from a string
   *
   * @param vec3String the string to convert to a Vector3
   * @param separator the separator to use between the coordinates, defaults to a space
   * @return a Vector3 or undefined if the string is not in the correct format
   */
  static fromString(t, e = " ") {
    const n = t.split(e);
    if (n.length === 3)
      return {
        x: parseFloat(n[0]),
        y: parseFloat(n[1]),
        z: parseFloat(n[2])
      };
    throw new Error("Could not parse Vector3 from string: " + t);
  }
  /**
   * Calculates the distance between two Vector3's
   *
   * @param vec3a first Vector3
   * @param vec3b second Vector3
   * @return the distance between the two Vector3's
   */
  static distance(t, e) {
    return Math.sqrt(Math.pow(t.x - e.x, 2) + Math.pow(t.y - e.y, 2) + Math.pow(t.z - e.z, 2));
  }
  /**
   * Clamps the y value of the Vector3 between a minimum and maximum value
   *
   * @param vec3 the Vector3 to clamp
   * @param min the minimum value for the y coordinate
   * @param max the maximum value for the y coordinate
   * @return a new Vector3 with the y coordinate clamped between min and max
   */
  static clamp(t, e, n) {
    return {
      x: t.x,
      y: X.clamp(t.y, e, n),
      z: t.z
    };
  }
}
const ot = {
  Air: "minecraft:air"
};
class zt {
  /**
   * If the block can see the sky, check if there are blocks above it the block it from having direct sunlight (Note blocks
   * such as leaves might not count)
   *
   * @param block target player
   * @returns true if the block can see the sky
   */
  static canBlockSeeSky(t) {
    var s;
    const e = t.location, n = (s = t.dimension.getTopmostBlock(e)) == null ? void 0 : s.location;
    return e.y === (n == null ? void 0 : n.y);
  }
  static getBlockContainer(t) {
    const e = t.getComponent(BlockComponentTypes.Inventory);
    return e == null ? void 0 : e.container;
  }
  static isBlockContainer(t) {
    return this.getBlockContainer(t) !== void 0;
  }
  /**
   * Gets the block from the given direction and offset amount.
   *
   * @param block the block to start from
   * @param direction the direction to get the block from
   * @param amount the number of blocks to offset in the given direction, defaults to 1
   * @returns the block or undefined if the block cannot be found / accessed
   */
  static getBlockFromDirection(t, e, n = 1) {
    try {
      switch (e) {
        case Direction.Down:
          return t.below(n);
        case Direction.North:
          return t.north(n);
        case Direction.South:
          return t.south(n);
        case Direction.East:
          return t.east(n);
        case Direction.Up:
          return t.above(n);
        case Direction.West:
          return t.west(n);
      }
    } catch {
      return;
    }
  }
  /**
   * Gets all the blocks around the given block;
   *
   * @param block the block to get the surrounding blocks from
   * @returns the blocks around
   */
  static getConnectedBlocks(t) {
    const e = [];
    for (const n of Object.values(Direction)) {
      const s = this.getBlockFromDirection(t, n);
      s && e.push(s);
    }
    return e;
  }
  /**
   * Fake and entity breaking a block with the item in their main hand
   *
   * @param block the block to break
   * @param entity the entity to break the block
   */
  static fakeBlockBreak(t, e) {
    this.spawnBreakLoot(t, e), system.runTimeout(() => {
      t.setType(ot.Air);
    }, 0);
  }
  /**
   * Spawns the loot of a block as if it was broken by an entity.
   *
   * @param block the block to break
   * @param entity the entity to break the block
   */
  static spawnBreakLoot(t, e) {
    const n = I.toString(I.floor(t.location));
    e.runCommand(`loot spawn ${n} mine ${n} mainhand`);
  }
  /**
   * Creates a block for the range around the given block.
   *
   * @param centerBlock block to get the block around
   * @param range how big of a range to get the blocks in
   * @param includeY should the range extend in the Y direction
   * @returns the block volume for the given range
   */
  static createVolumeFormRange(t, e, n = !0) {
    const s = Math.floor(e / 2), o = n ? e / 2 : 0, r = t.dimension.heightRange.min, a = t.dimension.heightRange.max, c = I.clamp(I.floor(I.subtractRaw(t, s, o, s)), r, a), g = I.clamp(I.floor(I.addRaw(t, s, o, s)), r, a);
    return new BlockVolume(c, g);
  }
  /**
   * Gets the block in a range of given block
   *
   * @param centerBlock block to get the block around
   * @param range how big of a range to get the blocks in
   * @param includeY should the range extend in the Y direction
   * @param filter block filter to apply
   * @returns the iterator of blocks in the range
   */
  static getBlocksInRange(t, e, n = !0, s = {}) {
    const o = this.createVolumeFormRange(t, e, n);
    return t.dimension.getBlocks(o, s).getBlockLocationIterator();
  }
  /**
   * Updates the block to the given states.
   *
   * @param block to update
   * @param states the states with their values to update
   * @param permutation the block permutation to use, defaults to the current block permutation
   */
  static updateBlockStates(t, e, n = t.permutation) {
    for (const s in e) {
      const o = e[s];
      n = n.withState(s, o);
    }
    t.setPermutation(n);
  }
  /**
   * Updates the block to the given states.
   *
   * @param block to update
   * @param stateName the state to update
   * @param value the value to set the state to
   * @param permutation the block permutation to use, defaults to the current block permutation
   */
  static updateBlockState(t, e, n, s = t.permutation) {
    this.updateBlockStates(
      t,
      {
        [e]: n
      },
      s
    );
  }
  static getBlockState(t, e) {
    return t.getState(e);
  }
}
function S(i) {
  return i.getComponent(EntityComponentTypes.Equippable);
}
function rt(i) {
  return i.getComponent(EntityComponentTypes.Inventory);
}
function V(i, t, e = i.location) {
  var r;
  const n = S(i);
  if (n && !n.getEquipment(EquipmentSlot.Mainhand))
    return n.setEquipment(EquipmentSlot.Mainhand, t), !0;
  const s = rt(i);
  return s ? (((r = s.container) == null ? void 0 : r.addItem(t)) && i.dimension.spawnItem(t, e), !0) : !1;
}
function at(i, t, e = i.location) {
  return V(i, t, e);
}
const $ = {
  Player: "minecraft:player"
};
class x {
  static getHeldItem(t, e = EquipmentSlot.Mainhand) {
    const n = S(t);
    if (n)
      return n.getEquipment(e);
  }
  /**
   * Forces the player to hold a specific item
   *
   * @param entity The entity to override the held item for
   * @param stack The item stack to set as the held item
   * @param hand The hand to set the item in (default is main hand)
   * @returns true if the operation was successful, false otherwise
   */
  static overrideHeldItem(t, e, n = EquipmentSlot.Mainhand) {
    const s = S(t);
    return s ? (s.setEquipment(n, e), !0) : !1;
  }
  static inCreative(t) {
    return t.typeId !== $.Player ? !1 : t.getGameMode() === GameMode.Creative;
  }
  static damageHeldItem(t, e, n = this.getHeldItem(t)) {
    if (!n || e <= 0 || this.inCreative(t))
      return;
    const s = y.calculateItemDamageAmount(n, e);
    if (s === 0)
      return;
    const o = n.getComponent(ItemComponentTypes.Durability);
    if (!o)
      return;
    const r = o.damage + s;
    if (r >= o.maxDurability) {
      t.dimension.playSound("random.break", t.location), this.overrideHeldItem(t, void 0);
      return;
    }
    o.damage = r, this.overrideHeldItem(t, n);
  }
  /**
   * Sends an action bar message to the player if the entity is a player
   * @param entity the entity to send the message to
   * @param message the message to send
   */
  static sendActionBar(t, e) {
    return (t == null ? void 0 : t.typeId) === $.Player ? (t.onScreenDisplay.setActionBar(e), !0) : !1;
  }
  /**
   * Updates the bucket in the entity's hand. First shrinks the stack then overrides the held item or gives the new stack to the entity
   * @param entity the entity to update the bucket for
   * @param heldItem the current held item (should be a bucket)
   * @param newStack the new item stack to give (should be a filled bucket)
   */
  static updateBucket(t, e, n) {
    const s = y.shrinkItemStack(e, 1);
    s ? (this.overrideHeldItem(t, s), V(t, n)) : this.overrideHeldItem(t, n);
  }
}
class R {
  /**
   * @deprecated use {@link EntityUtils.getHeldItem} instead
   */
  static getHeldItem(t) {
    return x.getHeldItem(t, EquipmentSlot.Mainhand);
  }
  /**
   * @deprecated use {@link EntityUtils.getHeldItem} instead
   */
  static getOffhandItem(t) {
    return x.getHeldItem(t, EquipmentSlot.Offhand);
  }
  /**
   * Forces the player to hold a specific item
   *
   * @param player
   * @param stack
   * @returns
   * @deprecated use {@link EntityUtils.overrideHeldItem} instead
   */
  static overrideHeldItem(t, e) {
    return x.overrideHeldItem(t, e, EquipmentSlot.Mainhand);
  }
  static inCreative(t) {
    return t.getGameMode() === GameMode.Creative;
  }
  /**
   * @deprecated use {@link EntityUtils.damageHeldItem} instead
   */
  static damageHeldItem(t, e, n = x.getHeldItem(t)) {
    x.damageHeldItem(t, e, n);
  }
  /**
   * Checks if player is an operator
   *
   * @param player the player to check
   * @returns true if the player is an operator
   */
  static isOp(t) {
    return t.playerPermissionLevel >= PlayerPermissionLevel.Operator;
  }
}
const ut = {
  Unbreaking: "minecraft:unbreaking"
};
function Ft(i, t, e, n) {
  return Math.random() <= e ? (i.spawnItem(t, n), !0) : !1;
}
class y {
  /**
   * Shrinks stack by the given amount
   *
   * @param itemStack the item stack to shrink
   * @param amount the amount to shrink the item stack by, defaults to 1
   * @returns the new ItemStack or undefined if the stack is empty
   */
  static shrinkItemStack(t, e = 1) {
    const n = t.amount - e;
    if (!(n <= 0))
      return t.amount = n, t;
  }
  /**
   * Gets the level of the given enchantment type on the item stack
   *
   * @param itemStack the item stack to check
   * @param enchantmentType the enchantment type to check
   * @returns the level of the enchantment on the item stack 0 if it doesn't exist
   */
  static getEnchantmentLevel(t, e) {
    const n = t.getComponent(ItemComponentTypes.Enchantable);
    if (!n)
      return 0;
    const s = n.getEnchantment(e);
    return s ? s.level : 0;
  }
  /**
   * Calculates the amount of damage to apply to an item stack based on the unbreaking enchantment
   *
   * @param itemStack item stack to damage
   * @param amount how much raw damage to apply
   * @return the amount of damage to apply to the item stack
   */
  static calculateItemDamageAmount(t, e = 1) {
    if (!t)
      return 0;
    const n = t.getComponent(ItemComponentTypes.Durability);
    if (!n)
      return 0;
    const s = EnchantmentTypes.get(ut.Unbreaking);
    if (s !== void 0) {
      const o = y.getEnchantmentLevel(t, s), r = n.getDamageChance(o);
      let a = 0;
      for (let c = 0; c < e; c++)
        Math.random() < r && a++;
      return a;
    }
    return e;
  }
  /**
   * Checks if the given item ID is a valid item type
   *
   * @param id the item ID to check
   * @return returns if the item ID is for a vaild item in game
   */
  static isValid(t) {
    return ItemTypes.get(t) !== void 0;
  }
  /**
   * Handles logic for updating a bucket itemstack.
   * It will first shrink then either replace the held item or give the new item to the player depending on if the stack is empty.
   * @param player the player holding the bucket
   * @param heldItem the current held item stack (the bucket)
   * @param newStack the new item stack to give or replace with (the filled bucket)
   */
  static updateBucket(t, e, n) {
    const s = y.shrinkItemStack(e, 1);
    s ? (R.overrideHeldItem(t, s), at(t, n)) : R.overrideHeldItem(t, n);
  }
}
var ct = /* @__PURE__ */ ((i) => (i.MINECRAFT = "minecraft", i.TINKERS = "ftb_tc", i.STORAGE_DRAWERS = "ftb_sd", i.DIRE = "ftb_dire", i.MYSTICAL = "ftb_ma", i.SIEVES = "ftb_sieves", i.BOTANIA = "ftb_botania", i.STRUCTURES = "ftb_structures", i.FRIEND = "ftb_friend", i))(ct || {});
function b(i, t) {
  return `${i}:${t}`;
}
function Nt(i) {
  return b("minecraft", i);
}
function Ot(i) {
  return b("ftb_tc", i);
}
function lt(i) {
  return b("ftb_sieves", i);
}
class Xt {
  /**
   * Capitalizes the first letter of a string
   *
   * @returns
   */
  static capitalize(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  /**
   * Capitalizes the first letter of each word in a string
   *
   * @returns The title-cased string
   */
  static titleCase(t) {
    let e = "";
    for (const n of t.split(" "))
      e += n.charAt(0).toUpperCase() + n.slice(1) + " ";
    return e.trim();
  }
  /**
   * Capitalizes the first letter of a string and lowercases the rest
   *
   * @returns The sentence-cased string
   */
  static sentenceCase(t) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
}
const _ = class _ {
  /**
   * Add a drop to the sifting table in Sieves and Things
   *
   * This <i><b>must</i></b> be called every time the world is loaded
   * best to call in `WorldLoadAfterEvent` from `world.afterEvents.worldLoad`
   *
   * @param dropItem item id of the item to drop
   * @param dropWeight weight of the drop, higher weights are more common
   * @param meshType type of mesh required to get the drop
   * @param blockType type of block required to get the drop
   */
  static addSiftingDrop(t, e, n, s) {
    if (e <= 0)
      throw new Error("Drop weight must be greater than 0");
    if (!ItemTypes.get(t))
      throw new Error(`Invalid dropItem: ${t}, could not find item`);
    const r = {
      dropItem: t,
      dropWeight: e,
      meshType: n,
      blockType: s
    };
    system.sendScriptEvent(_.SCRIPT_IDS.RECIPE_SIFTING, JSON.stringify(r));
  }
};
d(_, "SCRIPT_IDS", {
  RECIPE_SIFTING: lt("recipes/sifting")
});
let F = _;
var ht = /* @__PURE__ */ ((i) => (i.STRING = "string", i.FLINT = "flint", i.IRON = "iron", i.DIAMOND = "diamond", i.EMERALD = "emerald", i))(ht || {}), ft = /* @__PURE__ */ ((i) => (i.GRAVEL = "gravel", i.SAND = "sand", i.RED_SAND = "red_sand", i.DIRT = "dirt", i.DUST = "dust", i.SOUL_SAND = "soul_sand", i.CRUSHED_NETHERRACK = "crushed_netherrack", i.CRUSHED_BASALT = "crushed_basalt", i.CRUSHED_END_STONE = "crushed_end_stone", i))(ft || {});

export { zt as BlockUtils, x as EntityUtils, y as ItemUtils, ct as Keys, ht as MeshType, X as Mth, R as PlayerUtils, ft as SieveBlockType, F as SievesAPI, Xt as StringTransforms, I as VecUtils, Ft as dropItemWithChance, S as getEquippableComponent, rt as getInventoryComponent, V as giveItemToEntity, at as giveItemToPlayer, Nt as mc, b as namespace, lt as sieves, Ot as tc, Rt as vec3 };
