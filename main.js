const { shell } = require("electron");
var { remote } = require("electron");
var { isMac, app, Menu, MenuItem } = remote;
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();

// global variables
const json = loadSettings();
const menuModule = require("./menu");
let uniqueIndex = 0;
let configWidth = json.contents[0].width;
let configHeight = json.contents[1].height;

// initialize function
initialize();

function initialize() {
  if (noSettings()) {
    return;
  }

  // create menu bar
  initializeMenu(menuModule.menuTemplate);

  // create div elements
  const contents = json.contents;
  contents.forEach(function(content, index) {
    initializeDiv(content["style"], content["size"], content["url"], index);
  });

  // create webviews in div
  getWebviews().forEach(function(webview, index) {
    webview.addEventListener("dom-ready", function() {
      initializeWebview(webview);
      if (
        webview.parentNode.classList.contains("small") &&
        !webview.previousSibling.hasChildNodes()
      ) {
        addButtons(webview.previousSibling, index);
      }
    });
    // cannot click resize operate pos...
    // webview.onresize = function() {
    //   let width = document.getElementsByClassName("large")[0].offsetWidth;
    //   let allWidth = document.getElementById("main-content").offsetWidth;
    //   let height = document.getElementsByClassName("normal")[0].offsetHeight;
    //   let allHeight = document.getElementById("main-content").offsetHeight;
    //   configWidth = (width / allWidth) * 100;
    //   configHeight = (height / allHeight) * 100;
    //   calcWindowSize();
    // };
  });
}
function initializeMenu(template) {
  let menu = Menu.buildFromTemplate(template);
  if (hasMultipleWorkspaces()) {
    const menuItemForWorkspaces = generateMenuItemForSmallPane();
    menu.append(menuItemForWorkspaces);
  }

  const settingsMenu = generateSettingsMenu();
  menu.append(settingsMenu);

  Menu.setApplicationMenu(menu);
}
function incrementUniqueIndex() {
  uniqueIndex += 1;
}
function getUniqueIndex() {
  return uniqueIndex;
}
function hasMultipleWorkspaces() {
  return json.url_options;
}
function generateMenuItemForSmallPane() {
  const menuItem = new MenuItem({
    id: "smallPane",
    label: "Add",
    submenu: []
  });
  const nameAndUrls = getAdditionalPaneInfo(json.url_options);
  const additionalPaneMenuItems = generateAdditionalPaneMenuItems(nameAndUrls);

  additionalPaneMenuItems.forEach(function(owsMenuItem) {
    menuItem.submenu.append(owsMenuItem);
  });
  return menuItem;
}
function generateSettingsMenu() {
  const menuItem = new MenuItem({
    id: "settings",
    label: "Settings",
    submenu: [
      {
        label: "Reload",
        click() {
          clearStoredSettings();
        }
      }
    ]
  });

  return menuItem;
}
function generateAdditionalPaneMenuItems(nameAndUrls) {
  const additionalPaneMenuItems = nameAndUrls.map(function(nameAndUrl) {
    return new MenuItem({
      label: nameAndUrl["name"],
      click() {
        loadAdditionalPage(nameAndUrl["url"]);
      }
    });
  });

  return additionalPaneMenuItems;
}
function getAdditionalPaneInfo(url_options) {
  const nameAndUrls = url_options.map(function(url) {
    const domainName = new URL(url).hostname;
    return { name: domainName, url: new URL(url) };
  });
  return nameAndUrls;
}
function getWebviews() {
  return Array.from(document.getElementsByTagName("webview"));
}
function getNumberOfWebviews() {
  return getWebviews().length;
}
function initializeWebview(webview, additionalPage = "") {
  const slackOnlyBodyCss = getSlackOnlyBodyCss();
  const slackChannelAndBodyCss = getSlackChannelAndBodyCss();
  const trelloHeaderlessCss = getTrelloHeaderlessCss();
  selectApplicableCss(webview, {
    slackOnlyBodyCss,
    slackChannelAndBodyCss,
    trelloHeaderlessCss
  });

  addKeyEvents(webview);
  registerToOpenUrl(webview, shell);
  setWebviewAutosize(webview, "on");

  if (checkUrlIsDefault(webview)) {
    if (additionalPage !== "") {
      var url = additionalPage;
    } else {
      var url = webview.url;
    }
    webview.loadURL(url.toString());
  }
}
function getSlackOnlyBodyCss() {
  const disableChannelList =
    ".p-workspace__sidebar { display: none !important; }";
  const disableTeamHeader =
    ".p-classic_nav__team_header { display: none !important; }";
  const widenBody =
    ".p-workspace--context-pane-collapsed { grid-template-columns: 0px auto !important; }";
  const adjustHeight =
    ".p-workspace--classic-nav { grid-template-rows: min-content 60px auto !important; }";
  const adjustLeftPadding =
    ".p-workspace--context-pane-expanded { grid-template-columns: 0px auto !important; }";
  return (
    disableChannelList +
    widenBody +
    adjustHeight +
    disableTeamHeader +
    adjustLeftPadding
  );
}
function getSlackChannelAndBodyCss() {
  const disableTeamHeader =
    ".p-classic_nav__team_header { display: none !important; }";
  const adjustHeight =
    ".p-workspace--classic-nav { grid-template-rows: min-content 60px auto !important; }";
  const adjustLeftPadding =
    ".p-workspace--context-pane-expanded { grid-template-columns: 0px auto !important; }";
  return adjustHeight + disableTeamHeader + adjustLeftPadding;
}
function getTrelloHeaderlessCss() {
  const disableHeader = "#header { display: none !important; }";
  const disableBoardHeader = ".board-header { display: none !important; }";
  const adjustHeight = ".board-canvas { margin-top: 10px !important; }";
  return disableHeader + disableBoardHeader + adjustHeight;
}
function addKeyEvents(webview) {
  webview.getWebContents().on("before-input-event", (event, input) => {
    if (input.meta && input.key === "[" && webview.canGoBack()) {
      webview.goBack();
    }
    // NOTE: canGoForward() and goForward() do not work somewhy....
    if (input.meta && input.key === "]" && webview.canGoForward()) {
      webview.goForward();
    }
  });
}
function opendev() {
  const webview = getWebviews()[1];
  webview.openDevTools();
}
function remove(index) {
  const target = document.getElementById(index);
  const parent = target.parentNode;
  parent.removeChild(target);
  calcWindowSize();
  refreshButtons();
}
function moveLeft(index) {
  const target = document.getElementById(index);
  target.parentNode.insertBefore(target, target.previousSibling);
  refreshButtons();
}
function moveRight(index) {
  const target = document.getElementById(index);
  target.parentNode.insertBefore(target, target.nextSibling.nextSibling);
  refreshButtons();
}
function refreshButtons() {
  const main = document.getElementById("main-content");
  for (let i = 0; i < main.children.length; i++) {
    if (main.children[i].classList.contains("small")) {
      let target = main.children[i].firstChild;
      while (target.firstChild) {
        target.removeChild(target.firstChild);
      }
      addButtons(target, target.parentNode.id);
    }
  }
}
function addButtons(div, index) {
  if (div.parentNode.previousSibling.classList.contains("small"))
    div.innerHTML += `<button onclick=moveLeft(${index}) style="font-size: 12px";><</button>`;
  div.innerHTML += `<button onclick=remove(${index}) style="font-size: 12px";>Remove</button>`;
  if (div.parentNode.nextSibling !== null)
    div.innerHTML += `<button onclick=moveRight(${index}) style="font-size: 12px";>></button>`;
}
function loadAdditionalPage(additionalPage) {
  const style = "slack-only-body";
  const size = "small";
  const index = getUniqueIndex();
  initializeDiv(style, size, "", index);

  const webview = getWebviews()[getNumberOfWebviews() - 1];
  webview.id = style;
  webview.addEventListener("dom-ready", function() {
    initializeWebview(webview, additionalPage);
  });
  refreshButtons();
}
function initializeDiv(style, size, url = "") {
  generateTab(size, style, url);
  incrementUniqueIndex();
}
function generateTab(size, style, url) {
  let divContainer = createContainerDiv(getUniqueIndex(), size);
  let divButtons = createButtonDiv();
  let webview = createWebview(style, url);
  let root = getRootElement();

  root.appendChild(divContainer);
  divContainer.appendChild(divButtons);
  divContainer.appendChild(webview);
  calcWindowSize();

  return {
    divContainer: divContainer,
    divButtons: divButtons
  };
}
function getRootElement() {
  return document.getElementById("main-content");
}
function createContainerDiv(index, size) {
  let div = document.createElement("div");
  div.id = index;
  div.className = size;
  return div;
}
function createButtonDiv() {
  let buttonDiv = document.createElement("div");
  buttonDiv.className = "tool-buttons";

  return buttonDiv;
}
function createWebview(style, url = "") {
  let webview = document.createElement("webview");
  webview.src = "about:blank";
  webview.id = style;
  webview.url = url;
  return webview;
}
function setWebviewAutosize(webview, autosize) {
  webview.autosize = autosize;
}
function selectApplicableCss(
  webview,
  { slackOnlyBodyCss, slackChannelAndBodyCss, trelloHeaderlessCss }
) {
  if (webview.id == "slack-only-body") {
    applyCss(webview, slackOnlyBodyCss);
  } else if (webview.id == "slack-channel-and-body") {
    applyCss(webview, slackChannelAndBodyCss);
  } else if (webview.id == "trello-headerless") {
    applyCss(webview, trelloHeaderlessCss);
  }
}
function registerToOpenUrl(webview, shell) {
  // Hack: remove EventListener if already added
  webview.removeEventListener("new-window", openExternalUrl);
  webview.addEventListener("new-window", openExternalUrl);
}
function openExternalUrl(event) {
  const url = event.url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    shell.openExternal(url);
  }
}
function checkUrlIsDefault(webview) {
  return webview.attributes.src.value == "about:blank";
}
function applyCss(webview, css) {
  webview.insertCSS(css);
}
function saveSettings() {
  openFileAndSave();
}
function openFileAndSave() {
  const win = remote.getCurrentWindow();
  remote.dialog.showOpenDialog(
    win,
    {
      properties: ["openFile"],
      filters: [
        {
          name: "config",
          extensions: ["json"]
        }
      ]
    },
    filePath => {
      if (filePath) {
        saveJson(filePath[0]);
      }
    }
  );
}
function saveJson(jsonPath) {
  const settings = JSON.parse(fs.readFileSync(jsonPath));
  if (!validateJson(settings)) {
    return null;
  }

  store.set(settings);
  forceReload();
}
function validateJson(jsonObj) {
  if (!jsonObj.url_options) {
    alert("jsonObj.url_options is invalid");
    return false;
  }
  if (!jsonObj.contents) {
    alert("jsonObj.contents is invalid");
    return false;
  }

  return true;
}
function forceReload() {
  remote.getCurrentWindow().reload();
}
function clearStoredSettings() {
  store.clear();
  forceReload();
}
function loadSettings() {
  if (noSettings()) {
    saveSettings();
    return;
  }

  return buildJsonObjectFromStoredData();
}
function buildJsonObjectFromStoredData() {
  let jsonObj = {
    url: store.get("url"),
    url_options: store.get("url_options"),
    contents: store.get("contents")
  };
  if (!validateJson(jsonObj)) {
    return null;
  }

  return jsonObj;
}
function noSettings() {
  return store.size == 0;
}
function calcWindowSize() {
  const smallNum = document.getElementsByClassName("small").length;
  const main = document.getElementById("main-content");
  let columns = "";
  let rows = "";
  if (configWidth !== undefined) {
    columns = `grid-template-columns: ${configWidth}% ${100 -
      configWidth}% !important ;`;
  }
  if (configHeight !== undefined) {
    rows = `grid-template-rows: ${configHeight}% ${100 -
      configHeight}% !important ;`;
  }
  if (smallNum !== 0) {
    const ratio = `${(100 - configWidth) / smallNum}% `.repeat(smallNum);
    columns = `grid-template-columns: ${configWidth}% ${ratio} !important ;`;
  } else {
    rows = `grid-template-rows: 100% !important ;`;
  }
  main.style = columns + rows;
}
