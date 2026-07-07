import { onPlayerLeave } from "../systems/clog/runtime.js";

export default {
  name: "playerLeave",
  type: 1,
  run: (ev) => {

    onPlayerLeave(ev);
  },
};
