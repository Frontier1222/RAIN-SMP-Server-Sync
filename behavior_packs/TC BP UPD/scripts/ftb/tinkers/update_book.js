import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';

let changelogData = [];
let changelogDataLoaded = false;
async function getOrLoadChangelogData() {
    if (changelogDataLoaded) {
        return changelogData;
    }
    try {
        const file = "./changelogs.js";
        const { changelogs } = await import(file);
        changelogData = changelogs;
        return changelogData;
    }
    catch (e) {
        console.warn("Failed to load changelog data", e);
    }
    finally {
        changelogDataLoaded = true;
    }
}
world.beforeEvents.itemUse.subscribe(async (data) => {
    let player = data.source;
    if (data.itemStack.typeId == "ftb_tc:changelog_1") {
        const changelogs = await getOrLoadChangelogData();
        system.run(() => ftb_tinkers_update_changelog(player, changelogs[0]));
    }
});
async function ftb_tinkers_update_main(player) {
    const changelogs = await getOrLoadChangelogData();
    const form = new ActionFormData()
        .title("Tinkers' Construct " + changelogs[0].title)
        .body(`§gChoose a previous changelog to view.`);
    for (let i = 0; i < changelogs.length; i++) {
        const changelog = changelogs[i];
        form.button(`§l${changelog.title}${i === 0 ? ' (Latest)' : ''}`, "textures/items/banner_pattern");
    }
    form.button("§lRemove\n§7[ Removes Changelog Book ]")
        .button("§lClose\n§7[ Keep Changelog Book ]");
    form.show(player).then((r) => {
        if (r.selection >= 0 && r.selection < changelogs.length) {
            system.run(() => ftb_tinkers_update_changelog(player, changelogs[r.selection]));
        }
        if (r.selection == changelogs.length) {
            player.runCommand(`clear @s ftb_tc:changelog_1 0 1`);
            player.runCommand(`playsound random.orb @s ~ ~ ~`);
        }
    });
}
function ftb_tinkers_update_changelog(player, changelog) {
    const form = new ActionFormData()
        .title("Tinkers' Construct " + changelog.title)
        .body(changelog.changes);
    form.button("§lView older changelogs", "textures/ui/recap_glyph_color_2x")
        .button("§lContinue\n§7[ Remove Changelog ]", "textures/ui/book_trash_default")
        .button("§lClose\n§7[ Keep Changelog ]", "textures/ui/redX1");
    form.show(player).then((r) => {
        if (r.selection == 0) {
            system.run(() => ftb_tinkers_update_main(player));
        }
        if (r.selection == 1) {
            player.runCommand(`clear @s ftb_tc:changelog_1 0 1`);
            player.runCommand(`playsound random.orb @s ~ ~ ~`);
        }
    });
}
