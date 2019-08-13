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

// initialize function
initialize();

function initialize() {
  if (noSettings()) {
    return;
  }

  // create menu bar
  initializeMenu(menuModule.menuTemplate);

  const contents = json.contents;

  // modify layout if sets in setting
  modifyLayoutFromSettings(contents);

  // create div elements
  contents.forEach(function(content, index) {
    initializeDiv(content["style"], content["size"], content["url"], index);
  });

  // create webviews in div
  const webviews = getWebviews();
  webviews.forEach(function(webview, index) {
    webview.addEventListener("dom-ready", function() {
      initializeWebview(webview);
    });
  });
}
function initializeMenu(template) {
  let menu = Menu.buildFromTemplate(template);
  if (hasMultipleWorkspaces()) {
    const menuItemForWorkspaces = generateMenuItemForSmallBlock();
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
function generateMenuItemForSmallBlock() {
  const menuItem = new MenuItem({
    id: "smallBlock",
    label: "New",
    submenu: []
  });
  const nameAndUrls = getAdditionalPainInfo(json.url_options);
  const additionalPainMenuItems = generateOtherWorkspaceMenuItems(nameAndUrls);

  additionalPainMenuItems.forEach(function(owsMenuItem) {
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
        label: "Import Settings",
        click() {
          saveSettings();
        }
      },
      {
        label: "Clear Settings",
        click() {
          clearStoredSettings();
        }
      }
    ]
  });

  return menuItem;
}
function generateOtherWorkspaceMenuItems(nameAndUrls) {
  const additionalPainMenuItems = nameAndUrls.map(function(nameAndUrl) {
    return new MenuItem({
      label: nameAndUrl["name"],
      click() {
        loadWorkspace(nameAndUrl["url"]);
      }
    });
  });

  return additionalPainMenuItems;
}
function getAdditionalPainInfo(url_options) {
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
  addKeyEvents(webview);
  registerToOpenUrl(webview, shell);
  setWebviewAutosize(webview, "on");

  if (checkUrlIsDefault(webview)) {
    if (additionalPage !== "") {
      var url = additionalPage;
    } else {
      var url = webview.url;
    }
    loadURL(webview, url);
  }

  const slackOnlyBodyCss = getSlackOnlyBodyCss();
  const slackChannelAndBodyCss = getSlackChannelAndBodyCss();
  const trelloHeaderlessCss = getTrelloHeaderlessCss();
  selectAplicableCss(webview, {
    slackOnlyBodyCss,
    slackChannelAndBodyCss,
    trelloHeaderlessCss
  });
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
  const webviews = getWebviews();
  let webview = webviews[1];
  webview.openDevTools();
}
function remove(index) {
  let targetTab = document.getElementById(index);
  targetTab.parentNode.removeChild(targetTab);
}
function loadWorkspace(additionalPage) {
  const style = "body-only";
  const size = "small";
  const index = getUniqueIndex();
  initializeDiv(style, size, "", index);

  const webview = getWebviews()[getNumberOfWebviews() - 1];
  webview.id = style;
  webview.addEventListener("dom-ready", function() {
    initializeWebview(webview, additionalPage);
  });
}
function addButtons(div, index) {
  let divForButtons = div.children[0];
  divForButtons.innerHTML += `<button onclick=remove(${index});>Remove</button>`;
}
function initializeDiv(style, size, url = "") {
  const generatedDivs = generateTab(size, style, url);
  if (size === "small")
    addButtons(generatedDivs["divTabToolBar"], getUniqueIndex());

  incrementUniqueIndex();
}
function generateTab(size, style, url) {
  let divContainer = createContainerDiv(getUniqueIndex(), size);
  let divTabToolBar = createToolBarDiv();
  let divWebview = createWebviewDiv();
  let webview = createWebview(style, url);
  let root = getRootElement();

  root.appendChild(divContainer);
  divContainer.appendChild(divWebview);
  divWebview.appendChild(divTabToolBar);
  divWebview.appendChild(webview);

  return {
    divContainer: divContainer,
    divTabToolBar: divTabToolBar,
    divWebview: divWebview
  };
}
function getRootElement() {
  return document.getElementsByClassName("main-content")[0];
}
function createContainerDiv(index, size) {
  let div = document.createElement("div");
  div.id = index;
  div.className = size;
  return div;
}
function createToolBarDiv() {
  let divTabToolBar = document.createElement("div");
  divTabToolBar.className = "tab-tool-bar";

  let buttonDiv = document.createElement("div");
  buttonDiv.className = "tab-tool-bar-button";
  divTabToolBar.appendChild(buttonDiv);

  return divTabToolBar;
}
function createWebviewDiv() {
  let divWebview = document.createElement("div");
  divWebview.className = "webview";
  return divWebview;
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
function selectAplicableCss(
  webview,
  { slackOnlyBodyCss, slackChannelAndBodyCss, trelloHeaderlessCss }
) {
  if (shouldRenderSlackOnlyBody(webview)) {
    applyCss(webview, slackOnlyBodyCss);
  }
  if (shouldRenderSlackChannelAndBody(webview)) {
    applyCss(webview, slackChannelAndBodyCss);
  }
  if (shouldRenderTrelloHeaderless(webview)) {
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
function shouldRenderSlackOnlyBody(webview) {
  return webview.id == "slack-only-body";
}
function shouldRenderSlackChannelAndBody(webview) {
  return webview.id == "slack-channel-and-body";
}
function shouldRenderTrelloHeaderless(webview) {
  return webview.id == "trello-headerless";
}
function checkUrlIsDefault(webview) {
  return webview.attributes.src.value == "about:blank";
}
function loadURL(webview, url) {
  webview.loadURL(url.toString());
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
          name: "settings",
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
function modifyLayoutFromSettings(contents) {
  const style = document.getElementById("modify-from-config");
  contents.forEach(function(content) {
    if (content["size"] === "large" && content["width"] !== undefined) {
      style.innerHTML += `.large { width: ${content["width"]}% !important; }
                          .normal { width: ${100 - content["width"]}% !important;  }
                          .small { width: ${(100 - content["width"]) / 3}% !important;  }
                          .small { left: -${100.1 - content["width"]}% !important;  }`
    }
    if (content["size"] === "normal" && content["height"] !== undefined) {
      style.innerHTML += `.normal { height: ${content["height"]}% !important; }
                          .small { height: ${99.9 - content["height"]}% !important;  }`
    }
    // TODO: make small pain num configuable
    // if (content["size"] === "small" && content["number"] !== undefined) {
    //   style.innerHTML += `.small { width: ${content["height"]} !important; }`
    // }
  });
}