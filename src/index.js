"use strict";

const electron = require("electron");
const app = electron.app;
const ipcMain = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
let mainWindow;
let subWindow;
let initWindow;
let isSubOpen = false;
let isInitOpen = false;

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

app.on("window-all-closed", function() {
  trackEvent("main", "Close App");
  if (process.platform != "darwin") {
    app.quit();
  }
});

app.on("before-quit", function() {
  trackEvent("main", "Close App");
  mainWindow = null;
});

app.on("ready", function() {
  mainWindow = new BrowserWindow({
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
  trackEvent("main", "Open App");
  mainWindow.maximize();
  mainWindow.loadURL("file://" + __dirname + "/index.html");

  mainWindow.on("closed", function() {
    mainWindow = null;
  });
});

ipcMain.on("window-open", function() {
  if (isSubOpen) return;
  subWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  isSubOpen = true;
  subWindow.loadURL("file://" + __dirname + "/preference.html");
  trackEvent("main", "Preference Open");
  subWindow.on("closed", function() {
    subWindow = null;
    isSubOpen = false;
    trackEvent("main", "Preference Close");
    mainWindow.reload();
  });
});

ipcMain.on("initial-open", function() {
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
  initWindow.on("closed", function() {
    initWindow = null;
    isInitOpen = false;
    trackEvent("main", "Initialize End");
    mainWindow.reload();
  });
});
