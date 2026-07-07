import { Player, system } from "@minecraft/server";
import ScriptSDK from '../src/sdk';
import { prefix } from "../ScriptSDK";
export class Group {
    constructor(name, rule) {
        this.players = [];
        this.is_destroy = false;
        this.is_created = false;
        this.name = name;
        this.rule = rule;
    }
    async init() {
        if (!this.is_created) {
            await ScriptSDK.send('createGroup', [this.name, `${this.rule}`]).then((e) => {
                if (e.success) {
                    this.is_created = true;
                    system.groups.push(this);
                }
                else {
                    this.is_destroy = true;
                    throw new Error(prefix + 'Error creating the group ' + this.name + ' !');
                }
            });
        }
    }
    async addPlayer(player) {
        const playerName = player instanceof Player ? player.name : player;
        if (this.is_destroy) {
            throw new Error(prefix + 'the group is destroyed');
        }
        else if (!this.is_created) {
            throw new Error(prefix + 'the group is not initialized');
        }
        if (!this.players.includes(playerName)) {
            const result = await ScriptSDK.send('addPlayerToGroup', [this.name, playerName]);
            if (result.success) {
                this.players.push(playerName);
            }
            else {
                throw new Error(prefix + 'Error adding a player to the group ' + this.name);
            }
        }
    }
    async removePlayer(player) {
        const playerName = player instanceof Player ? player.name : player;
        if (this.is_destroy) {
            throw new Error(prefix + 'the group is destroyed');
        }
        else if (!this.is_created) {
            throw new Error(prefix + 'the group is not initialized');
        }
        if (this.players.includes(playerName)) {
            const result = await ScriptSDK.send('removePlayerToGroup', [this.name, playerName]);
            if (result.success) {
                this.players = this.players.filter(p => p != playerName);
            }
            else {
                throw new Error(prefix + 'Error removing a player to the group ' + this.name);
            }
        }
    }
    getPlayers() {
        if (this.is_destroy) {
            throw new Error(prefix + 'the group is destroyed');
        }
        else if (!this.is_created) {
            throw new Error(prefix + 'the group is not initialized');
        }
        return this.players;
    }
    hasPlayer(player) {
        const playerName = player instanceof Player ? player.name : player;
        return this.players.includes(playerName);
    }
    async destroy() {
        if (this.is_destroy) {
            throw new Error(prefix + 'the group is destroyed');
        }
        else if (!this.is_created) {
            throw new Error(prefix + 'the group is not initialized');
        }
        const result = await ScriptSDK.send('deleteGroup', [this.name]);
        if (result.success) {
            this.is_destroy = true;
            system.groups = system.groups.filter((g) => g != this);
        }
        else {
            throw new Error(prefix + 'Error deleting the group ' + this.name);
        }
    }
    toJson() {
        return {
            name: this.name,
            rule: this.rule,
            is_destroy: this.is_destroy,
            is_created: this.is_created,
            players: this.players
        };
    }
}
