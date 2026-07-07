import { ModifierProperties } from './modifier_properties.js';
import { isTinkersTool } from '../durability.js';
import { isSling as isSling$1 } from '../slingshot.js';
import { tc as Ot, mc as Nt } from '../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

const isSling = (item) => isSling$1(item);
const isPickaxe = (item) => item.typeId.startsWith(Ot("pickaxe"));
const isAxes = (item) => item.typeId.startsWith(Ot("hand_axe"));
const isPickaxeOrAxe = (item) => isPickaxe(item) || isAxes(item);
const isSword = (item) => item.typeId.startsWith(Ot("sword"));
const isDaggerCleaverOrSword = (item) => isSword(item) || item.typeId.startsWith(Ot("dagger")) || item.typeId.startsWith(Ot("cleaver"));
const isWeapon = (item) => isDaggerCleaverOrSword(item) || isAxes(item);
const notWeapon = (item) => !isWeapon(item);
const isModifierApplicable = (item) => isTinkersTool(item) && !isSling(item) && !item.typeId.includes("shuriken");
const modifierRegistry = {
    // Rapid / Haste
    [Ot("redstone_modifier")]: ModifierProperties.builder("Rapid")
        .addEnchantment(Nt("efficiency"), 5)
        .addIncompatibleItemCheck(isSling)
        .build(),
    // Lucky
    [Ot("lapis_modifier")]: ModifierProperties.builder("Lucky")
        .addEnchantment(Nt("fortune"), 3, notWeapon)
        .addEnchantment(Nt("looting"), 3, isWeapon)
        .addIncompatibleModifier(Ot("silky_modifier")) // silk_touch
        .addIncompatibleModifier(Ot("tnt_modifier"))
        .addIncompatibleModifier(Ot("emerald_modifier")) // luck
        .addIncompatibleItemCheck(isSling)
        .build(),
    // Spounged
    [Ot("prismarine_modifier")]: ModifierProperties.builder("Sponged")
        .addIncompatibleModifier(Ot("scute_modifier")) // soaked
        .addIncompatibleModifier(Ot("glowstone_modifier")) // bright
        .addIncompatibleItemCheck(isSling)
        .addDynamicProperity(Ot("sponged")) // Scripted effect (done)
        .build(),
    // Soaked
    [Ot("scute_modifier")]: ModifierProperties.builder("Soaked")
        .addIncompatibleModifier(Ot("prismarine_modifier")) // sponged
        .addIncompatibleModifier(Ot("glowstone_modifier")) // bright
        .addIncompatibleItemCheck(isSling)
        .addDynamicProperity(Ot("water_breathing"))
        .build(),
    // Tough
    [Ot("armadillo_modifier")]: ModifierProperties.builder("Tough")
        .addIncompatibleItemCheck(isSling)
        .addDynamicProperity(Ot("resistence"), 3)
        .build(),
    // Bright
    [Ot("glowstone_modifier")]: ModifierProperties.builder("Bright")
        .addIncompatibleModifier(Ot("prismarine_modifier")) // sponged
        .addIncompatibleModifier(Ot("scute_modifier")) // soaked
        .addIncompatibleItemCheck(isSling)
        .addDynamicProperity(Ot("bright")) // Scripted effect (done)
        .build(),
    // Sharp
    [Ot("quartz_modifier")]: ModifierProperties.builder("Sharp")
        .addOnlyCompatibleWithItemCheck(isWeapon)
        .addEnchantment(Nt("sharpness"), 5)
        .build(),
    // Ultimine
    [Ot("emerald_modifier")]: ModifierProperties.builder("Ultimine")
        .addOnlyCompatibleWithItemCheck(isPickaxeOrAxe)
        .addIncompatibleModifier(Ot("tnt_modifier"))
        .addIncompatibleModifier(Ot("silky_modifier"))
        .addIncompatibleModifier(Ot("lapis_modifier")) // exposive
        .addDynamicProperity(Ot("ultimine")) // Scripted effect (done)
        .build(),
    // Electrifying
    [Ot("lightining_modifier")]: ModifierProperties.builder("Electrifying")
        .addOnlyCompatibleWithItemCheck(isSword)
        .addDynamicProperity(Ot("electrifying")) // Scripted effect (done)
        .build(),
    // Bane
    [Ot("spider_modifier")]: ModifierProperties.builder("Bane")
        .addOnlyCompatibleWithItemCheck((item) => isDaggerCleaverOrSword(item) || isAxes(item))
        .addEnchantment(Nt("bane_of_arthropods"), 5)
        .build(),
    // Explosive
    [Ot("tnt_modifier")]: ModifierProperties.builder("Explosive")
        .addIncompatibleModifier(Ot("emerald_modifier")) // ultimine
        .addDynamicProperity(Ot("explosive"))
        .addIncompatibleModifier(Ot("silky_modifier"))
        .addIncompatibleModifier(Ot("lapis_modifier")) // Scripted effect (done)
        .addOnlyCompatibleWithItemCheck(isPickaxe)
        .build(),
    // Starstruck
    [Ot("netherstar_modifier")]: ModifierProperties.builder("Starstruck")
        .addOnlyCompatibleWithItemCheck(isDaggerCleaverOrSword)
        .addDynamicProperity(Ot("starstruck")) // Scripted effect (Done)
        .build(),
    // Reinforced
    [Ot("obsidian_modifier")]: ModifierProperties.builder("Reinforced")
        .addEnchantment(Nt("unbreaking"), 3)
        .addIncompatibleItemCheck(isSling)
        .build(),
    // Silky
    [Ot("silky_modifier")]: ModifierProperties.builder("Silky")
        .addIncompatibleItemCheck(isSling)
        .addIncompatibleItemCheck(isSword)
        .addIncompatibleModifier(Ot("lapis_modifier"))
        .addIncompatibleModifier(Ot("tnt_modifier"))
        .addIncompatibleModifier(Ot("emerald_modifier")) // luck
        .addEnchantment(Nt("silk_touch"), 1)
        .build(),
    // Steal
    [Ot("necrotic_modifier")]: ModifierProperties.builder("Steal")
        .addOnlyCompatibleWithItemCheck(isDaggerCleaverOrSword)
        .addDynamicProperity(Ot("necrotic_modifier")) // Scripted effect (Done)
        .build(),
    // Pushed
    [Ot("piston_modifier")]: ModifierProperties.builder("Pushed")
        .addOnlyCompatibleWithItemCheck(isDaggerCleaverOrSword)
        .addEnchantment(Nt("knockback"), 2)
        .build(),
    // Smitey
    [Ot("rotten_modifier")]: ModifierProperties.builder("Smitey")
        .addOnlyCompatibleWithItemCheck(isDaggerCleaverOrSword)
        .addEnchantment(Nt("smite"), 5)
        .build(),
};

export { isModifierApplicable, modifierRegistry };
