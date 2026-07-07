import { Player } from "@minecraft/server";
import { GroupRule } from "../src/enums";
export declare class Group {
    private players;
    is_destroy: boolean;
    is_created: boolean;
    name: string;
    rule: GroupRule;
    constructor(name: string, rule: GroupRule);
    init(): Promise<void>;
    addPlayer(player: Player | string): Promise<void>;
    removePlayer(player: Player | string): Promise<void>;
    getPlayers(): string[];
    hasPlayer(player: Player | string): boolean;
    destroy(): Promise<void>;
    toJson(): {
        name: string;
        rule: GroupRule;
        is_destroy: boolean;
        is_created: boolean;
        players: string[];
    };
}
