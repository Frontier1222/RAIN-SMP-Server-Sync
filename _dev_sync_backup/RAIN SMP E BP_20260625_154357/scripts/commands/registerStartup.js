import { system } from "@minecraft/server";
import { slashRegistry } from "./index.js";

/** RAIN SMP slash commands use bd: namespace. */
const COMMAND_NS = "bd";

/** Frozen once at load — keeps command signatures stable across script reloads. */
const COMMAND_DEFS = slashRegistry
    .filter((cmd) => cmd?.data?.name)
    .map((cmd) => ({
        cmd,
        def: Object.freeze(cmd.data.toDefinition(COMMAND_NS)),
        enums: cmd.data.enums?.size
            ? [...cmd.data.enums.entries()].map(([name, values]) =>
                  Object.freeze({ name: name.replace(/^bd:/, `${COMMAND_NS}:`), values: Object.freeze([...values]) })
              )
            : [],
    }));

let reloadWarned = false;

function warnReloadRequired(err) {
    if (reloadWarned) return;
    reloadWarned = true;
    console.warn(
        "[RAIN] Custom commands were updated — leave and rejoin the world (or restart the Realm). " +
            "Script reload cannot change command parameters. " +
            String(err?.message || err)
    );
}

function isReloadParameterError(err) {
    const msg = String(err?.message || err || "");
    return msg.includes("cannot change parameters") || msg.includes("reload failed");
}

if (system.beforeEvents?.startup) {
    system.beforeEvents.startup.subscribe((init) => {
        const registry = init.customCommandRegistry;

        for (const entry of COMMAND_DEFS) {
            for (const { name, values } of entry.enums) {
                try {
                    registry.registerEnum(name, values);
                } catch (err) {
                    if (isReloadParameterError(err)) warnReloadRequired(err);
                    else console.warn(`[RAIN] Enum register failed (${name}): ${err}`);
                }
            }
        }

        for (const { cmd, def } of COMMAND_DEFS) {
            try {
                registry.registerCommand(def, (origin, ...args) => {
                    let base = null;
                    if (origin.sourceEntity) base = origin.sourceEntity;
                    return cmd.run(system, { source: base, sourceType: origin.sourceType }, args);
                });
            } catch (err) {
                if (isReloadParameterError(err)) warnReloadRequired(err);
                else console.warn(`[RAIN] Command register failed (${def.name}): ${err}`);
            }
        }
    });
}
