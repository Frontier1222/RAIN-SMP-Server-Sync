class ModifierProperties {
    constructor(displayName, incompatibleWithModifiers, incompatibleWithItemsChecks, enchantments, properties) {
        this.incompatibleWithModifiers = [];
        this.incompatibleWithItemsChecks = [];
        this.enchantments = [];
        this.properties = [];
        this.displayName = displayName;
        this.incompatibleWithModifiers = incompatibleWithModifiers;
        this.incompatibleWithItemsChecks = incompatibleWithItemsChecks;
        this.enchantments = enchantments;
        this.properties = properties;
    }
    static builder(displayName) {
        return new ModifierPropertiesBuilder(displayName);
    }
}
class ModifierPropertiesBuilder {
    constructor(displayName) {
        this.displayName = displayName;
        this.incompatibleWithModifiers = [];
        this.incompatibleWithItemsChecks = [];
        this.enchantments = [];
        this.properties = [];
    }
    addEnchantment(enchantment, max, checker = ModifierPropertiesBuilder.ALWAYS_TRUE) {
        this.enchantments.push({ enchantment, max, applierChecker: checker });
        return this;
    }
    addIncompatibleModifier(modifier) {
        this.incompatibleWithModifiers.push(modifier);
        return this;
    }
    addIncompatibleItemCheck(item) {
        this.incompatibleWithItemsChecks.push(item);
        return this;
    }
    // An inverse of the given checker
    addOnlyCompatibleWithItemCheck(checker) {
        this.addIncompatibleItemCheck((item) => !checker(item));
        return this;
    }
    addDynamicProperity(key, max = 1) {
        this.properties.push({ name: key, max });
        return this;
    }
    build() {
        return new ModifierProperties(this.displayName, this.incompatibleWithModifiers, this.incompatibleWithItemsChecks, this.enchantments, this.properties);
    }
}
ModifierPropertiesBuilder.ALWAYS_TRUE = (_stack) => true;

export { ModifierProperties, ModifierPropertiesBuilder };
