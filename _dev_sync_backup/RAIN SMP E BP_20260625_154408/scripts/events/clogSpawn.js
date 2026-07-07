import { onPlayerSpawn } from "../systems/clog/runtime.js";
export default {
  name: "playerSpawn",
  type: 1,
  run: (ev) => {
    onPlayerSpawn(ev);
  },
};