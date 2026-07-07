import { system } from "@minecraft/server";
class ScriptSDK {
    constructor() {
        this.waitingData = {};
        system.afterEvents.scriptEventReceive.subscribe((e) => this.event(e));
    }
    generateId(length = 10) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
    event(e) {
        const { id, message, sourceEntity, sourceType } = e;
        const [message_type, message_id] = id.split(':');
        if (message_type == 'scriptsdkresult') {
            if (Object.keys(this.waitingData).includes(message_id)) {
                this.waitingData[message_id](message);
                delete this.waitingData[message_id];
            }
        }
    }
    deserializer(message, args = 1) {
        const repeatedPattern = Array(args).fill("(.*)").join(';#;');
        const regex = new RegExp(`^([a-z]*);#;(\\d{3});#;${repeatedPattern}$`, 'gm');
        return regex.exec(message);
    }
    getResultBody(result, length) {
        const cleanResult = new Array(length);
        result.map((value, index) => {
            if (index > 2) {
                cleanResult[index - 3] = value;
            }
        });
        return cleanResult;
    }
    async send(action, body, args = 1) {
        return new Promise((resolve) => {
            const id = this.generateId();
            system.sendScriptEvent(`scriptsdk:${id}-${action}`, `${body.join(';#;')}`);
            this.waitingData[id] = (data) => {
                let m = this.deserializer(data, args);
                if (m == null) {
                    m = this.deserializer(data);
                    args = 1;
                }
                if (m && m.length >= 4) {
                    resolve({
                        success: m[1] == 'true',
                        code: parseInt(m[2]),
                        result: m[1] == 'true' ? this.getResultBody(m, args) : [m[3]]
                    });
                }
            };
        });
    }
}
export default new ScriptSDK();
