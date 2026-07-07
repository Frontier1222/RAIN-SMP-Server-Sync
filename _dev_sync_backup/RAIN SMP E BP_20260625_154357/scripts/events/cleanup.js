import { cleanupPlayerCaches } from "../main"

export default {
    name: "playerLeave",
    type: 1,
    run: (data) => {
        cleanupPlayerCaches(data.playerId)
    }
}