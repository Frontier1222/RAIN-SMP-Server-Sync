const EVENT_DETAILS = Object.freeze({
  "Random Head": [
    "§7Opens into one random mob head.",
    "§d20% each: §7Creeper, Piglin, Zombie,",
    "§7Skeleton, or Wither Skeleton.",
    "§8Excludes Dragon, player, and Tinkers heads."
  ],
  "Random Music Disc": [
    "§7Opens into one random obtainable music disc.",
    "§d22 equal outcomes: 4.55% each.",
    "§713, Cat, Blocks, Chirp, Far, Mall, Mellohi,",
    "§7Stal, Strad, Ward, 11, Wait, Otherside, 5,",
    "§7Pigstep, Creator, Creator Music Box,",
    "§7Precipice, Tears, Lava Chicken, Relic, or Bounce."
  ],
  "Random Common Trim": [
    "§7Opens into one common armor trim template.",
    "§d9 equal outcomes: 11.11% each.",
    "§7Sentry, Dune, Coast, Wild, Wayfinder,",
    "§7Raiser, Shaper, Host, or Bolt."
  ],
  "Random Rare Trim": [
    "§7Opens into one rare armor trim template.",
    "§d7 equal outcomes: 14.29% each.",
    "§7Vex, Rib, Snout, Eye, Ward, Tide, or Flow."
  ],
  "Random Dye Bundle": [
    "§7A large material crate containing 10-12 stacks.",
    "§7Each roll gives 64 dye of one random color.",
    "§d16 equal colors: 6.25% per roll.",
    "§8Rolls are independent, so colors can repeat."
  ],
  "Random Flower Bundle": [
    "§7A large material crate containing 10-12 stacks.",
    "§7Includes standard, tall, newer, and rare flowers.",
    "§d23 equal flower outcomes: 4.35% per roll.",
    "§7Most rolls give 64; Wither Roses give 16.",
    "§8Rolls are independent, so flowers can repeat."
  ],
  "Random Wool Bundle": [
    "§7A large material crate containing 10-12 stacks.",
    "§7Each roll gives 32-64 wool of one color.",
    "§d16 equal colors: 6.25% per roll.",
    "§8Rolls are independent, so colors can repeat."
  ],
  "Random Terracotta Bundle": [
    "§7A large material crate containing 10-12 stacks.",
    "§7Each roll gives 32-64 normal or glazed terracotta.",
    "§d32 equal outcomes: 3.13% per roll.",
    "§7Includes all 16 colors in both block styles.",
    "§8Rolls are independent, so blocks can repeat."
  ],
  "Random Concrete Bundle": [
    "§7A large material crate containing 10-12 stacks.",
    "§7Each roll gives 32-64 concrete of one color.",
    "§d16 equal colors: 6.25% per roll.",
    "§8Rolls are independent, so colors can repeat."
  ],
  "Random Spawn Egg": [
    "§7Opens into one random allowed spawn egg.",
    "§d11 equal outcomes: 9.09% each.",
    "§7Vindicator, Witch, Creeper, Skeleton,",
    "§7Zombie Villager, Cow, Sheep, Spider,",
    "§7Enderman, Drowned, or Zombified Piglin.",
    "§8Bosses and economy-breaking mobs are excluded."
  ],
  "Random Legendary Trim": [
    "§7Awards one legendary armor trim template.",
    "§dSilence: 50%",
    "§dSpire: 50%"
  ],
  "Enchanted Golden Apple": ["§7A rare enchanted apple with powerful combat effects."],
  "Totem of Undying": ["§7Prevents one death while held in either hand."],
  "Breeze Bombs": ["§7Awards 32 Wind Charges for combat and mobility."],
  "Nether Reactor Core": ["§7An unobtainable legacy block intended for collection."],
  "Netherite Upgrade Templates": ["§7Awards 10 templates used to upgrade diamond gear."],
  "Enchanted Elytra": ["§7Ready-to-use Elytra with Unbreaking III and Mending I."],
  "Heavy Core": ["§7Rare crafting component used to create a Mace."],
  "Mob Spawner": ["§7A placeable mob spawner block. Spawn egg sold separately."],
  "Bedrock": ["§7An unobtainable luxury building block."],
  "Knockback XVI Fish": ["§7Special event weapon with extreme knockback."],
  "Raid Authorization Permit": [
    "§7Authorizes one staff-approved raid against",
    "§7one targeted player or faction at one property.",
    "§7Present the permit to staff before activation.",
    "§8Temporarily bypasses Kill and Steal protection.",
    "§cInvalid until approved; one use only."
  ],
  "The Death Note": [
    "§7Write the exact name of one online player,",
    "§7then present the signed note to a moderator.",
    "§7Staff reviews the request before using /kill.",
    "§8Nearby loot may be taken only when rules allow.",
    "§cSubject to staff approval and server rules."
  ],
  "Book: Unbreaking III": ["§7Enchanted book containing Unbreaking III."],
  "Book: Protection IV": ["§7Enchanted book containing Protection IV."],
  "Book: Efficiency V": ["§7Enchanted book containing Efficiency V."],
  "Book: Sharpness V": ["§7Enchanted book containing Sharpness V."],
  "Book: Frost Walker II": ["§7Enchanted book containing Frost Walker II."],
  "Book: Soul Speed III": ["§7Enchanted book containing Soul Speed III."],
  "Book: Swift Sneak III": ["§7Enchanted book containing Swift Sneak III."],
  "Book: Protection V Placeholder": ["§8Placeholder reward; enhanced enchantment is not active."],
  "Book: Sharpness VI Placeholder": ["§8Placeholder reward; enhanced enchantment is not active."]
});

function plainName(value) {
  return String(value || "").replace(/§[0-9a-fk-or]/gi, "").trim();
}

export function getEventShopDetails(itemOrName) {
  const name = typeof itemOrName === "string"
    ? itemOrName
    : itemOrName?.customName || itemOrName?.sell?.nameTag;
  const details = EVENT_DETAILS[plainName(name)];
  return details ? [...details] : [];
}
