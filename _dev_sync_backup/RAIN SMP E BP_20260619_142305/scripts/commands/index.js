import { Command } from "../extensions/command.js";
import { togglePlayerHudSidebar } from "../systems/stats.js";
import claimland from "./claimland.js";
import ft from "./ft.js";
import rank from "./rank.js";
import admin from "./admin.js";
import exportclaims from "./exportclaims.js";

const hidesidebar = {
    data: new Command()
        .setName("hidesidebar")
        .setDescription("Toggle the HUD stats sidebar on or off"),
    run: (system, origin) => {
        const player = origin.source;
        if (!player) return;
        system.run(() => togglePlayerHudSidebar(player));
    },
};

// Exporting the raw array of commands so main.js can read them
export const slashRegistry = [claimland, ft, rank, admin, exportclaims, hidesidebar];
