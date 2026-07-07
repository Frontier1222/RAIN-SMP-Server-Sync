function getRepairMaterialFromTypeId(typeId) {
    const material = _getRepairMaterialFromTypeId(typeId);
    if (material === "rock_stone") {
        return "stone";
    }
    return material;
}
function _getRepairMaterialFromTypeId(typeId) {
    if (typeId.includes("pickaxe") || typeId.includes("axe") || typeId.includes("shoel")) {
        // Get the text after _head_, then stop at the _binding_
        const headIndex = typeId.indexOf("_head_");
        const bindingIndex = typeId.indexOf("_binding_");
        if (headIndex !== -1 && bindingIndex !== -1) {
            return typeId.substring(headIndex + 6, bindingIndex);
        }
    }
    else if (typeId.includes("sword")) {
        const headIndex = typeId.indexOf("_blade_");
        if (headIndex !== -1) {
            return typeId.substring(headIndex + 7);
        }
    }
    else if (typeId.includes("dagger")) {
        const headIndex = typeId.indexOf("_blade_");
        const crossguardIndex = typeId.indexOf("_crossguard_");
        if (headIndex !== -1 && crossguardIndex !== -1) {
            return typeId.substring(headIndex + 7, crossguardIndex);
        }
    }
    else if (typeId.includes("cleaver")) {
        const headIndex = typeId.indexOf("_head_");
        const guardIndex = typeId.indexOf("_guard_");
        if (headIndex !== -1 && guardIndex !== -1) {
            return typeId.substring(headIndex + 6, guardIndex);
        }
    }
    else if (typeId.includes("bow")) {
        const headIndex = typeId.indexOf("bow_");
        if (headIndex !== -1) {
            return typeId.substring(headIndex + 4);
        }
    }
    return null;
}

export { getRepairMaterialFromTypeId };
