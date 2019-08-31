const builder = require("electron-builder");

builder.build({
  config: {
    mac: {
      icon: "build/icons/icon.icns",
      target: "zip",
      files: ["!images/*"]
    }
  }
});
