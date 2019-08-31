const builder = require("electron-builder");
const Platform = builder.Platform;

builder.build({
  targets: Platform.WINDOWS.createTarget(),
  config: {
    win: {
      target: {
        icon: "build/icons/icon.icns",
        target: "zip",
        arch: ["x64"]
      }
    }
  }
});
