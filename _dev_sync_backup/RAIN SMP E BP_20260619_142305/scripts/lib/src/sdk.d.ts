export type WaitingData = {
    [key: string]: (result: any) => void;
};
declare class ScriptSDK {
    private waitingData;
    constructor();
    private generateId;
    private event;
    private deserializer;
    private getResultBody;
    send(action: string, body: string[], args?: number): Promise<{
        success: boolean;
        code: number;
        result: string[];
    }>;
}
declare const _default: ScriptSDK;
export default _default;
