import { tc as Ot, mc as Nt } from '../../ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

var SmelteryFuelType;
(function (SmelteryFuelType) {
    SmelteryFuelType["EMPTY"] = "empty";
    SmelteryFuelType["WATER"] = "water";
    SmelteryFuelType["LAVA"] = "lava";
    SmelteryFuelType["BLAZE"] = "blaze";
})(SmelteryFuelType || (SmelteryFuelType = {}));
function smelteryFuelTypeFromId(id) {
    switch (id) {
        case Nt("water"):
        case "water":
            return SmelteryFuelType.WATER;
        case Nt("lava"):
        case "lava":
            return SmelteryFuelType.LAVA;
        case Ot("blaze"):
            return SmelteryFuelType.BLAZE;
        default:
            return SmelteryFuelType.EMPTY;
    }
}

export { SmelteryFuelType, smelteryFuelTypeFromId };
