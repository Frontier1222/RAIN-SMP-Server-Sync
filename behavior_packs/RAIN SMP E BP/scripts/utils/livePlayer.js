/** True when a player handle is still connected and safe to read/write. */
export function isLivePlayer(player) {
    try {
        return !!player?.isValid;
    } catch (e) {
        return false;
    }
}

export function safePlayerName(player) {
    if (!isLivePlayer(player)) return "";
    try {
        return String(player.name ?? "").trim();
    } catch (e) {
        return "";
    }
}

export function safePlayerId(player) {
    if (!isLivePlayer(player)) return "";
    try {
        return String(player.id ?? "").trim();
    } catch (e) {
        return "";
    }
}
