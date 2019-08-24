const builder = require("electron-builder");

builder.build({
  platform: "win",
  config: {
    win: {
      target: {
        target: "zip",
        arch: ["x64", "ia32"]
      }
    }
  }
});
