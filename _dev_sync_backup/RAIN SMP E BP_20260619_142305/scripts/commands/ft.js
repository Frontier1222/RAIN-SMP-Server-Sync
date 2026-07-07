import { Command } from "../extensions/command.js";
import { openFloatingTextsUi } from "../systems/floatingTexts.js";

export default {
  data: new Command().setName("ft").setDescription("Manage floating texts"),
  run: (system, origin) => {
    const player = origin.source;
    if (!player) return;

    system.run(() => {
      openFloatingTextsUi(player);
    });
  },
};
