const builder = require("electron-builder");
const Platform = builder.Platform;

builder.build({
  targets: Platform.WINDOWS.createTarget(),
  config: {
    win: {
      target: {
        target: "zip",
        arch: ["x64"]
      },
      files: ["!images/*"]
    }
  }
});
