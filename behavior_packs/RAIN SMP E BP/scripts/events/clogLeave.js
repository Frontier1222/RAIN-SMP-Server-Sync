import { onPlayerLeave } from "../systems/clog/runtime.js";

export default {
  name: "playerLeave",
  type: 0,
  run: (ev) => {
    onPlayerLeave(ev);
  },
};
