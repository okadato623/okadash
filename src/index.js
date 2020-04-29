"use strict";

const electron = require("electron");
const app = electron.app;
const ipcMain = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const path = require('path');
const fs = require("fs");
let mainWindow;
let subWindow;
let initWindow;
let isSubOpen = false;
let isInitOpen = false;

// loading window size and position
const boundsFilePath = path.join(app.getPath('userData'), 'bounds.json');
let bounds = {};
try {
  bounds = JSON.parse(fs.readFileSync(boundsFilePath, 'utf8'));
} catch (e) {
  bounds = { "width": 1024, "height": 768 };
}

// for Google Analytics
const ua = require("universal-analytics");
const usr = ua("UA-148721366-1");
function trackEvent(category, action) {
  usr
    .event({
      ec: category,
      ea: action
    })
    .send();
}

function createBrowserWindow() {
  const browserWindow = new BrowserWindow({
    webPreferences: {
      transparent: false,
      frame: true,
      resizable: true,
      hasShadow: false,
      alwaysOnTop: false,
      nodeIntegration: true,
      webviewTag: true
    }
  });
  browserWindow.setBounds(bounds);
  browserWindow.loadURL("file://" + __dirname + "/index.html");

  return browserWindow
}

app.on("window-all-closed", function () {
  trackEvent("main", "Close App");
  app.quit();
});

app.on("ready", function () {
  mainWindow = createBrowserWindow();
  trackEvent("main", "Open App");
});

ipcMain.on("subwindow-open", function (event, name) {
  const newWindow = createBrowserWindow();
  newWindow.boardName = name
});

app.on("quit", function () {
  fs.writeFileSync(boundsFilePath, JSON.stringify(mainWindow.getBounds()));
})

ipcMain.on("window-open", function () {
  if (isSubOpen) return;
  subWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    frame: true,
    webPreferences: {
      nodeIntegration: true
    }
  });
  isSubOpen = true;
  subWindow.loadURL("file://" + __dirname + "/preference.html");
  subWindow.openDevTools();
  trackEvent("main", "Preference Open");
  subWindow.on("closed", function () {
    subWindow = null;
    isSubOpen = false;
    trackEvent("main", "Preference Close");
    BrowserWindow.getAllWindows().forEach(win => {
      win.reload();
    })
  });
});

ipcMain.on("initial-open", function () {
  if (isInitOpen) return;
  initWindow = new BrowserWindow({
    width: 1500,
    height: 1050,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  isInitOpen = true;
  initWindow.loadURL("file://" + __dirname + "/initial_setting.html");
  trackEvent("main", "Initialize Start");
  initWindow.on("closed", function () {
    initWindow = null;
    isInitOpen = false;
    trackEvent("main", "Initialize End");
    mainWindow.reload();
  });
});
