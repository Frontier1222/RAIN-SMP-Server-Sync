import { ItemTypes, system } from "@minecraft/server";
import { toast } from "../utils/realmPerf.js";

export default {
  name: "chatSend",
  type: 0,

  run: (ev) => {
    const sender = ev.sender;
    const msg = ev.message || "";
    const lower = msg.toLowerCase();

    // Count custom items command only
    if (lower.startsWith("!countitems")) {
      ev.cancel = true;

      system.run(() => {
        const allTypes = ItemTypes.getAll();
        let customCount = 0;
        const customIds = [];

        for (const t of allTypes) {
          if (!t.id.startsWith("minecraft:")) {
            customCount++;
            customIds.push(t.id);
          }
        }

        let reply = `§aThere are §l${customCount}§r§a custom item type${
          customCount === 1 ? "" : "s"
        } registered in the game.`;

        if (customIds.length) {
          reply += "\n§7" + customIds.join(", ");
        }

        toast(sender, reply, "countitems");
      });

      return;
    }

    // Do nothing else here.
    // main.js handles mute checks and formatted chat.
  }
};