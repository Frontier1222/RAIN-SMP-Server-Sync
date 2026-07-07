import { world } from "@minecraft/server";
import { Command } from "../extensions/command.js";
import { getAllRankTags, getRankMeta } from "../systems/ranks.js";
import { syncRankChatTeam } from "../systems/rankChatRuntime.js";
import { toastError, toastSuccess } from "../utils/realmPerf.js";

function normalizeTargets(sel) {
  if (!sel) return [];
  if (Array.isArray(sel)) return sel;
  return [sel];
}

function setRankTag(player, rankId) {
  for (const t of getAllRankTags()) {
    if (player.hasTag(t)) player.removeTag(t);
  }

  if (rankId === "owner") player.addTag("rank:owner");
  else if (rankId === "coowner") player.addTag("rank:coowner");
  else if (rankId === "admin") player.addTag("rank:admin");

  syncRankChatTeam(player, true);
}

export default {
  data: new Command()
    .setName("rank")
    .setDescription("Set a player's server rank")
    .setPermission("Admin")
    .registerEnum("bd:rank", ["owner", "coowner", "admin", "member"])
    .addPlayerSelectorOption("player", true)
    .addEnumOption("bd:rank", true),

  run: (system, origin, args) => {
    const caller = origin.source;
    if (!caller) return;

    const targets = normalizeTargets(args[0]);
    const rankId = args[1];

    if (!rankId || targets.length === 0) {
      toastError(caller, "§cUsage: /bd:rank <player> <owner|coowner|admin|member>", "rank_usage");
      return;
    }

    system.run(() => {
      for (const target of targets) {
        setRankTag(target, rankId);
        const meta = getRankMeta(target);
        toastSuccess(target, `§aYour rank is now: §f${meta.label}`, "rank_updated");
      }

      toastSuccess(caller, `§aUpdated rank for §f${targets.length}§a player(s).`, "rank_bulk_updated");
    });
  },
};
