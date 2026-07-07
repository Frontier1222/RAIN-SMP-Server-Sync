import { EquipmentSlot, EntityComponentTypes } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';
import { tc as Ot } from './ftb_bedrock_bedrock_utils_dist_bedrock_utils.js';

function ultimine_main(player) {
    const mainHandContainer = getMainHandItem(player);
    if (!mainHandContainer)
        return;
    const [inventory, mainHand] = mainHandContainer;
    const settingsRaw = mainHand.getDynamicProperty(Ot("ultimine_settings")) ?? "logs,ores";
    const modeRaw = mainHand.getDynamicProperty(Ot("ultimine_mode")) ?? "always";
    const settings = settingsRaw.split(",");
    const modeIndex = modeRaw === "sneak" ? 1 : 0;
    const form = new ModalFormData()
        .title({ translate: "ultimine.main.title", with: ["\n"] })
        .toggle({ translate: "ultimine.logs.toggle" }, { defaultValue: settings.includes("logs") })
        .toggle({ translate: "ultimine.ores.toggle" }, { defaultValue: settings.includes("ores") })
        .toggle({ translate: "ultimine.gravel.toggle" }, { defaultValue: settings.includes("gravel") })
        .toggle({ translate: "ultimine.andesite.toggle" }, { defaultValue: settings.includes("andesite") })
        .toggle({ translate: "ultimine.diorite.toggle" }, { defaultValue: settings.includes("diorite") })
        .toggle({ translate: "ultimine.granite.toggle" }, { defaultValue: settings.includes("granite") })
        .dropdown({ translate: "dire_gadgets.building_gadget.mode", with: ["\n"] }, ["Always Active", "Sneak-to-Activate"], { defaultValueIndex: modeIndex });
    form.show(player).then((r) => {
        if (typeof r?.formValues === "undefined")
            return;
        const [logs, ores, gravel, andesite, diorite, granite, mode] = r.formValues;
        const mainHandContainer = getMainHandItem(player);
        if (!mainHandContainer)
            return;
        const [inventory, mainHand] = mainHandContainer;
        const newSettings = [];
        if (logs)
            newSettings.push("logs");
        if (ores)
            newSettings.push("ores");
        if (gravel)
            newSettings.push("gravel");
        if (andesite)
            newSettings.push("andesite");
        if (diorite)
            newSettings.push("diorite");
        if (granite)
            newSettings.push("granite");
        mainHand.setDynamicProperty(Ot("ultimine_settings"), newSettings.join(","));
        mainHand.setDynamicProperty(Ot("ultimine_mode"), mode === 1 ? "sneak" : "always");
        inventory.setEquipment(EquipmentSlot.Mainhand, mainHand);
    });
}
function getMainHandItem(player) {
    const inventory = player.getComponent(EntityComponentTypes.Equippable);
    if (!inventory) {
        return null;
    }
    const mainHand = inventory.getEquipment(EquipmentSlot.Mainhand);
    if (!mainHand) {
        return null;
    }
    const itemTypeId = mainHand.typeId;
    if (!itemTypeId.startsWith("ftb_tc:")) {
        return null;
    }
    const props = mainHand.getDynamicPropertyIds();
    if (!props.includes(Ot("ultimine"))) {
        return null;
    }
    return [inventory, mainHand];
}

export { ultimine_main };
