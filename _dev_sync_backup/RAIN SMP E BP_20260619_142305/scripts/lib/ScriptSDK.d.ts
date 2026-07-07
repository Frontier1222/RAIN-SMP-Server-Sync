import { BossBarColor, BossBarStyle } from "../src/enums";
import { Group } from "../src/groups";
export declare const prefix = "[ScriptSDK] ";
export type ServerInfo = {
    ping: number;
    edition: string;
    gameMode: string;
    mapName: string;
    name: string;
    players: {
        online: number;
        max: number;
    };
    serverId: number;
    version: string;
};
declare module '@minecraft/server' {
    interface Player {
        ip: string | null;
        xuid: string | null;
        device_os: string | null;
        /**
         *  Assigns a boss bar to a player.
         */
        setBossBar(title: string, color: BossBarColor, style: BossBarStyle, percent: number): Promise<void>;
        /**
         * Reset a boss bar to a player.
         */
        resetBossBar(): Promise<void>;
        /**
         * Get the player's ping
         */
        getPing(): Promise<number>;
        /**
         * Send toast notification.
         */
        sendToast(title: string, content: string): Promise<void>;
        /**
         * Send popup.
         */
        sendPopup(message: string): Promise<void>;
    }
    interface Entity {
        /**
         * Defines the target entity name for the player.
         */
        setNameTagForPlayer(target: Player, newName: string): Promise<void>;
        /**
         * Get the name of the entity visible to the targeted player.
         */
        getNameTagByPlayer(target: Player): string;
        /**
         * Reset the name of the entity visible to the targeted player.
         */
        resetNameTagForPlayer(target: Player): Promise<void>;
    }
    interface System {
        groups: Group[];
        /**
         *
         */
        getInfoFromExternalServer(host: string, port: number): Promise<ServerInfo>;
    }
}
