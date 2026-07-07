import { system, world } from "@minecraft/server";
import * as CryptoESImport from "../node_modules/crypto-es.js";
const CryptoES = CryptoESImport.default ?? CryptoESImport;
/**
 * Security clearance levels for commands.
 * Determines which players can execute certain commands.
 */
var SecurityClearance;
(function (SecurityClearance) {
    SecurityClearance[SecurityClearance["Level1"] = 1] = "Level1";
    SecurityClearance[SecurityClearance["Level2"] = 2] = "Level2";
    SecurityClearance[SecurityClearance["Level3"] = 3] = "Level3";
    SecurityClearance[SecurityClearance["Level4"] = 4] = "Level4";
})(SecurityClearance || (SecurityClearance = {}));
/**
 * Handles command registration, execution, and GUI integration.
 */
export class CommandHandler {
    /** Commands organized by category */
    commandsByCategory = new Map();
    /** Commands lookup by name */
    commands = new Map();
    /** Current command prefix */
    prefix;
    /** Item ID that opens the GUI when used */
    guiItem;
    /** Lock to serialize command execution */
    prefixLock = false;
    /** Lock for prefix updates */
    prefixUpdateLock = false;
    /** Rate-limit interval in ticks */
    rateLimitInterval = 20;
    /** Maximum commands per interval */
    maxCommandsPerInterval = 5;
    /** Commands executed in current interval */
    commandCount = 0;
    /** Tick of last executed command */
    lastCommandTimestamp = 0;
    /**
     * Initializes a new CommandHandler and sets the prefix.
     */
    constructor() {
        this.prefix = world.getDynamicProperty("__prefix") ?? ":";
        this.guiItem = world.getDynamicProperty("__guiItem");
    }
    /**
     * Registers an array of commands and organizes them by category.
     * @param commands - Array of Command objects
     */
    registerCommand(commands) {
        this.commands.clear();
        this.commandsByCategory.clear();
        commands.forEach((command) => {
            command.usage = command.usage.replaceAll("{prefix}", this.prefix);
            command.examples = command.examples.map((ex) => ex.replaceAll("{prefix}", this.prefix));
            const category = command.category.charAt(0).toUpperCase() + command.category.slice(1).toLowerCase();
            const catCommands = this.commandsByCategory.get(category) ?? [];
            catCommands.push(command);
            this.commandsByCategory.set(category, catCommands);
            this.commands.set(command.name.toLowerCase(), command);
        });
    }
    /**
     * Returns all registered commands.
     */
    getRegisteredCommands() {
        return Array.from(this.commands.values());
    }
    /**
     * Handles a player sending a command message.
     * @param message - Chat event
     * @param player - Player sending the command
     * @param prefix - Command prefix
     */
    async handleCommand(message, player, prefix) {
        const args = message.message.slice(prefix.length).trim().split(/\s+/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName)
            return false;
        if (!this.canExecuteCommand()) {
            player.sendMessage("\n§2[§7Paradox§2]§o§7 Commands are being rate-limited. Please wait.");
            return true;
        }
        await this.acquireCommandExecutionLock();
        try {
            const shouldUpdatePrefix = await this.executeCommand(message, player, commandName, args, prefix);
            if (shouldUpdatePrefix)
                this.updatePrefix(player);
        }
        finally {
            this.releaseCommandExecutionLock();
        }
        return true;
    }
    /**
     * Returns the current GUI trigger item ID.
     */
    getGuiItem() {
        return this.guiItem;
    }
    /**
     * Sets the GUI trigger item ID.
     * @param itemId - Minecraft item ID (e.g. 'minecraft:compass')
     */
    setGuiItem(itemId) {
        this.guiItem = itemId;
        world.setDynamicProperty("__guiItem", itemId);
    }
    /**
     * Updates the command prefix dynamically and updates all command usage strings and examples.
     * @param player - Player triggering prefix update
     */
    updatePrefix(player) {
        if (this.prefixUpdateLock) {
            player.sendMessage("\n§2[§7Paradox§2]§o§7 Another prefix update is in progress.");
            return;
        }
        this.prefixUpdateLock = true;
        (async () => {
            try {
                const newPrefix = world.getDynamicProperty("__prefix") ?? this.prefix;
                if (newPrefix !== this.prefix) {
                    for (const command of this.commands.values()) {
                        command.usage = command.usage.replaceAll(this.prefix + command.name, newPrefix + command.name);
                        command.examples = command.examples.map((ex) => ex.replaceAll(this.prefix + command.name, newPrefix + command.name));
                    }
                    this.prefix = newPrefix;
                }
            }
            finally {
                this.prefixUpdateLock = false;
            }
        })();
    }
    /**
     * Waits for locks to clear and acquires command execution lock.
     */
    async acquireCommandExecutionLock() {
        while (this.prefixLock || this.prefixUpdateLock) {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        this.prefixLock = true;
    }
    /**
     * Releases the command execution lock.
     */
    releaseCommandExecutionLock() {
        this.prefixLock = false;
    }
    /**
     * Executes a command safely, checks security, and handles help requests.
     * @param message - Chat message event
     * @param player - Player executing the command
     * @param commandName - Command keyword
     * @param args - Command arguments
     * @param defaultPrefix - Current command prefix
     */
    async executeCommand(message, player, commandName, args, defaultPrefix) {
        const helpAliases = ["help", "--help"];
        const isHelpRequest = helpAliases.includes(commandName) || helpAliases.includes(args[0]?.toLowerCase());
        const command = this.commands.get(commandName);
        if (!command && !isHelpRequest) {
            player.sendMessage(`\n§2[§7Paradox§2]§o§7 Command "${commandName}" not found. Use ${defaultPrefix}help.`);
            return false;
        }
        const playerSecurityClearance = player.getDynamicProperty("securityClearance") ?? SecurityClearance.Level1;
        /**
         * Determine security requirement.
         * Priority:
         * 1. arg-specific security
         * 2. command-level security
         */
        const argKey = args[0]?.toLowerCase();
        const requiredClearance = command?.argSecurity?.[argKey ?? ""] ?? command?.securityClearance ?? SecurityClearance.Level1;
        const hasPermission = (playerSecurityClearance >= requiredClearance && playerSecurityClearance <= SecurityClearance.Level4) || commandName === "op";
        if (!hasPermission) {
            player.sendMessage("§2[§7Paradox§2]§o§7 Insufficient clearance to execute this command.");
            return false;
        }
        if (isHelpRequest) {
            const targetCommand = helpAliases.includes(commandName) ? args[0]?.toLowerCase() : commandName;
            if (!targetCommand) {
                this.displayAllCommands(player);
            }
            else {
                const info = this.getCommandInfo(targetCommand, player);
                player.sendMessage(info.join("\n") || "\n§2[§7Paradox§2]§o§7 Command not found.");
            }
            return false;
        }
        try {
            const execResult = await command.execute(message, args, CryptoES);
            return commandName === "prefix" && typeof execResult === "boolean" ? execResult : false;
        }
        catch (err) {
            console.error("[Paradox] Command execution error:", err);
            player.sendMessage("§2[§7Paradox§2]§o§7 Error executing the command.");
            return false;
        }
    }
    /**
     * Returns detailed command information for display.
     * @param commandName - Name of the command
     * @param player - Player requesting info
     */
    getCommandInfo(commandName, player) {
        const command = this.commands.get(commandName);
        if (!command)
            return [`\n§2[§7Paradox§2]§o§7 Command "${commandName}" not found.`];
        const playerSecurityClearance = player.getDynamicProperty("securityClearance") ?? SecurityClearance.Level1;
        const info = [
            `\n§2[§7Command§2]§f: §o${command.name}§r`,
            `§2[§7Usage§2]§f: §o${this.formatUsage(command.usage)}§r`,
            `§2[§7Description§2]§f: §o${command.description}§r`,
            `§2[§7Examples§2]§f:\n${command.examples.map((ex) => `    §o${ex}`).join("\n")}`,
        ];
        if (command.specialNote && playerSecurityClearance === SecurityClearance.Level4) {
            info.push(`§2[§7Note§2]§f: §o${command.specialNote}§r`);
        }
        return info;
    }
    /**
     * Formats usage string with Minecraft color codes.
     * @param usage - Command usage string
     */
    formatUsage(usage) {
        return usage.replace(/[\[\]<>\|]/g, (m) => `§2${m}§f`);
    }
    /**
     * Filters GUI buttons based on player security clearance.
     * Used when generating ActionFormData menus.
     */
    filterButtonsBySecurity(buttons, playerSecurityClearance) {
        return buttons
            .filter((button) => (button.securityClearance ?? SecurityClearance.Level1) <= playerSecurityClearance)
            .map((button) => ({
            ...button,
            subActions: button.subActions ? this.filterButtonsBySecurity(button.subActions, playerSecurityClearance) : undefined,
        }));
    }
    /**
     * Displays all commands available to the player, sorted and filtered by security clearance.
     * @param player - Player requesting the command list
     */
    displayAllCommands(player) {
        let message = "\n§2[§7Available Commands§2]§r\n";
        const playerSecurityClearance = player.getDynamicProperty("securityClearance") ?? SecurityClearance.Level1;
        this.commandsByCategory.forEach((commands, category) => {
            const filtered = commands.filter((c) => c.securityClearance <= playerSecurityClearance);
            if (!filtered.length)
                return;
            message += `\n§2[§7${category}§2]§r\n`;
            filtered
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach((c) => {
                message += `§7${c.name}§2: §o§f${c.description}§r\n`;
            });
        });
        player.sendMessage(message || "\n§2[§7Paradox§2]§o§7 No commands registered.");
    }
    /**
     * Checks if a command can be executed based on rate-limiting.
     */
    canExecuteCommand() {
        const tick = system.currentTick;
        if (tick - this.lastCommandTimestamp >= this.rateLimitInterval) {
            this.commandCount = 0;
            this.lastCommandTimestamp = tick;
        }
        return this.commandCount++ < this.maxCommandsPerInterval;
    }
}
