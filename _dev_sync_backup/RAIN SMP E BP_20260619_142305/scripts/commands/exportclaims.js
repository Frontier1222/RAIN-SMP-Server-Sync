import { Command } from "../extensions/command.js";
import { getAllGlobalClaims } from "../events/plot/plotHelpers.js";
import { toastError, toastInfo, toastSuccess } from "../utils/realmPerf.js";

function normalizeClaim(plot) {
    const minX = Math.min(plot.minX, plot.maxX);
    const maxX = Math.max(plot.minX, plot.maxX);
    const minZ = Math.min(plot.minZ, plot.maxZ);
    const maxZ = Math.max(plot.minZ, plot.maxZ);

    return {
        id: plot.id,
        name: plot.name || plot.id,
        owner: plot.ownerName || "?",
        dimension: plot.dimension || "minecraft:overworld",
        minX,
        maxX,
        minZ,
        maxZ,
        y: plot.y ?? 64,
        width: maxX - minX + 1,
        depth: maxZ - minZ + 1,
        area: (maxX - minX + 1) * (maxZ - minZ + 1),
        isSubclaim: !!plot.isSubclaim,
        factionClaim: !!plot.factionClaim,
    };
}

function formatClaimLine(claim) {
    return `${claim.name} | ${claim.owner} | X ${claim.minX}..${claim.maxX} | Z ${claim.minZ}..${claim.maxZ} | ${claim.dimension}`;
}

function canExportClaims(player) {
    if (!player) return false;
    try {
        return player.hasTag("staff") || player.hasTag("admin");
    } catch (e) {
        return false;
    }
}

export default {
    data: new Command()
        .setName("exportclaims")
        .setDescription("Export all land claim coordinates (staff)")
        .setPermission("GameDirectors"),
    run: (system, origin) => {
        const player = origin.source;
        if (!player) return;

        system.run(() => {
            if (!canExportClaims(player)) {
                toastError(player, "Staff only.", "exportclaims_deny");
                return;
            }

            const claims = getAllGlobalClaims().map(normalizeClaim);
            const payload = {
                exported_at: new Date().toISOString(),
                claim_count: claims.length,
                claims,
                umt_keep_boxes: claims.map((c) => ({
                    label: `claim_${String(c.name).replace(/\s+/g, "_")}`,
                    min_x: c.minX,
                    max_x: c.maxX,
                    min_z: c.minZ,
                    max_z: c.maxZ,
                    owner: c.owner,
                    dimension: c.dimension,
                })),
            };

            console.warn(`[RAIN exportclaims] ${JSON.stringify(payload)}`);

            toastSuccess(
                player,
                `Exported ${claims.length} claim(s). Full JSON is in the content log.`,
                "exportclaims_done"
            );

            const preview = claims.slice(0, 8);
            for (const claim of preview) {
                toastInfo(player, formatClaimLine(claim), `exportclaims_${claim.id}`);
            }

            if (claims.length > preview.length) {
                toastInfo(
                    player,
                    `+ ${claims.length - preview.length} more in content log (search exportclaims).`,
                    "exportclaims_more"
                );
            }
        });
    },
};
