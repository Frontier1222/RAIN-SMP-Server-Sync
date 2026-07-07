import { startAntiCrash, stopAntiCrash } from "../../modules/anticrash.js";
import { paradoxModulesDB } from "../../event-listeners/world-initialize.js";
export const anticrashCommand = {
    name: "anticrash",
    description: "Toggles protection against packet-based crasher exploits [BDS Only].",
    usage: "{prefix}anticrash",
    examples: ["{prefix}anticrash"],
    category: "Modules",
    securityClearance: 4,
    icon: "textures/ui/empty_armor_slot_shield.png",
    guiInstructions: {
        formType: "ActionFormData",
        title: "Anti-Crash Module",
        description: "Protects the server from malicious clients attempting to crash the world via packet flooding [BDS Only].\n\n" +
            "§7• Detects 'Sub-Chunk' request flooding exploits.\n" +
            "§7• Automatically cancels packets with excessive offset arrays.\n" +
            "§7• Bans offenders to prevent repeat attacks on server stability.\n\n",
        actions: [
            {
                name: "Enable / Disable",
                icon: "textures/ui/empty_armor_slot_chestplate.png",
                description: "Toggle Anti-Crash protection on or off.",
            },
        ],
    },
    execute: async (message, _) => {
        if (!message)
            return;
        const player = message.sender;
        const moduleKey = "antiCrashCheck_b";
        const moduleData = paradoxModulesDB.get(moduleKey) ?? { enabled: false };
        const isEnabled = moduleData.enabled;
        if (!isEnabled) {
            moduleData.enabled = true;
            await paradoxModulesDB.set(moduleKey, moduleData);
            const success = await startAntiCrash();
            if (success) {
                player.sendMessage("§2[§7Paradox§2]§o§7 Anti-Crash protection has been §aenabled§7.");
            }
            else {
                // Revert state if server-net is missing
                moduleData.enabled = false;
                await paradoxModulesDB.set(moduleKey, moduleData);
                player.sendMessage("§2[§7Paradox§2]§o§7 Anti-Crash protection could not be enabled: §c@minecraft/server-net not found§7.");
            }
        }
        else {
            moduleData.enabled = false;
            await paradoxModulesDB.set(moduleKey, moduleData);
            stopAntiCrash();
            player.sendMessage("§2[§7Paradox§2]§o§7 Anti-Crash protection has been §4disabled§7.");
        }
    },
};
