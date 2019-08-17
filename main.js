const { shell } = require("electron");
var { remote } = require("electron");
var { isMac, app, Menu, MenuItem } = remote;
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();
const json = loadSettings();
const menu = require("./menu");
let configWidth = json.contents[0].width;
let configHeight = json.contents[1].height;

// for xterm
const pty = require("node-pty");
const xtshell = process.env["SHELL"];
let ptyProcess = pty.spawn(xtshell, [], {
  cwd: process.cwd(),
  env: process.env
});
Terminal.applyAddon(fit);
json.contents.forEach(function(content) {
  if (content.style === "xterm") fontSize = content.fontSize;
});
var xterm = new Terminal({
  fontSize: `${fontSize}`
});
xterm.isOpen = false;

// initialize function
initialize();

function initialize() {
  if (noSettings()) {
    return;
  }
  calcWindowSize();

  // create menu bar
  initializeMenu(menu.menuTemplate);

  // create div elements
  const contents = json.contents;
  contents.forEach(function(content) {
    initializeDiv(content["style"], content["size"], content["url"]);
  });

  // create webviews in div
  getWebviews().forEach(function(webview, index) {
    webview.addEventListener("dom-ready", function() {
      initializeWebview(webview);
      if (
        webview.parentNode.classList.contains("small") &&
        !webview.previousSibling.hasChildNodes()
      ) {
        addButtons(webview.previousSibling, webview.parentNode.id);
      }
    });
    webview.onresize = function() {
      let width = document.getElementsByClassName("large")[0].offsetWidth;
      let allWidth = document.getElementById("main-content").offsetWidth;
      let height = document.getElementsByClassName("medium")[0].offsetHeight;
      let allHeight = document.getElementById("main-content").offsetHeight;
      configWidth = (width / allWidth) * 100;
      configHeight = (height / allHeight) * 100;
      calcWindowSize();
    };
  });
}
var i = 0;
var dragging_vertical = false;
var dragging_horizontal = false;
$("#dragbar-vertical").mousedown(function(e) {
  e.preventDefault();
  $("#main-content").css("pointer-events", "none");

  dragging_vertical = true;
  var main = $("#main-content");
  var ghostbar = $("<div>", {
    id: "ghostbar-vertical",
    css: {
      height: main.outerHeight(),
      top: main.offset().top,
      left: main.offset().left
    }
  }).appendTo("body");

  $(document).mousemove(function(e) {
    ghostbar.css("left", e.pageX + 2);
  });
});

$("#dragbar-horizontal").mousedown(function(e) {
  e.preventDefault();
  $("#main-content").css("pointer-events", "none");

  dragging_horizontal = true;
  var main = $(".medium");
  var ghostbar = $("<div>", {
    id: "ghostbar-horizontal",
    css: {
      width: main.outerWidth(),
      top: main.offset().top,
      left: main.offset().left
    }
  }).appendTo("body");

  $(document).mousemove(function(e) {
    ghostbar.css("top", e.pageY + 2);
  });
});

$(document).mouseup(function(e) {
  if (dragging_vertical) {
    $(".large").css("width", e.pageX + 2);
    $("#main-content").css("left", e.pageX + 2);
    $("#ghostbar-vertical").remove();
    $(document).unbind("mousemove");
    dragging_vertical = false;
  }
  if (dragging_horizontal) {
    $(".medium").css("height", e.pageY + 2);
    $("#main-content").css("left", e.pageY + 2);
    $("#ghostbar-horizontal").remove();
    $(document).unbind("mousemove");
    dragging_horizontal = false;
  }
});
function initializeMenu(template) {
  let menu = Menu.buildFromTemplate(template);
  const menuItemForSmallPace = generateMenuItemForSmallPane();
  menu.append(menuItemForSmallPace);

  const settingsMenu = generateSettingsMenu();
  menu.append(settingsMenu);

  Menu.setApplicationMenu(menu);
}
function generateMenuItemForSmallPane() {
  const menuItem = new MenuItem({
    id: "smallPane",
    label: "Open",
    submenu: []
  });
  const nameAndUrls = getAdditionalPaneInfo(json.url_options);
  const additionalPaneMenuItems = generateAdditionalPaneMenuItems(nameAndUrls);

  additionalPaneMenuItems.forEach(function(apMenuItem) {
    menuItem.submenu.append(apMenuItem);
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
      accelerator: `Command+${nameAndUrl["index"] + 1}`,
      click() {
        loadAdditionalPage(nameAndUrl["url"]);
      }
    });
  });

  return additionalPaneMenuItems;
}
function getAdditionalPaneInfo(url_options) {
  const nameAndUrls = url_options.map(function(url, index) {
    let dispName = url.split("/").slice(-1)[0]; // 最後の / 以降を取得
    return { name: dispName, url: new URL(url), index: index };
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
  renderByCustomCss(webview);
  if (webview.src !== "about:blank") addKeyEvents(webview);
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
function renderByCustomCss(webview) {
  const slackOnlyBodyCss = getSlackOnlyBodyCss();
  const slackChannelAndBodyCss = getSlackChannelAndBodyCss();
  const trelloHeaderlessCss = getTrelloHeaderlessCss();

  selectApplicableCss(webview, {
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
    if (input.meta && input.key === "w") {
      if (webview.parentNode.classList.contains("small"))
        remove(webview.parentNode.id);
    }
  });
}
function remove(index) {
  const target = document.getElementById(index);
  const parent = target.parentNode;
  const smallPanes = Array.from(document.getElementsByClassName("small"));
  smallPanes.forEach(function(pane) {
    if (pane.id > index) pane.id = pane.id - 1;
  });
  parent.removeChild(target);
  calcWindowSize();
  refreshButtons();
}
function moveLeft(index) {
  const target = document.getElementById(index);
  const prev = document.getElementById(index - 1);
  const tmp = target.id;
  target.id = prev.id;
  target.style.order = prev.style.order;
  prev.id = tmp;
  prev.style.order = tmp;
  refreshButtons();
}
function moveRight(index) {
  const target = document.getElementById(index);
  const next = document.getElementById(index + 1);
  const tmp = target.id;
  target.id = next.id;
  target.style.order = next.style.order;
  next.id = tmp;
  next.style.order = tmp;
  refreshButtons();
}
function refreshButtons() {
  const main = document.getElementById("main-content");
  const panes = Array.from(main.children);
  panes.forEach(function(child) {
    if (!child.classList.contains("small")) return;
    const target = child.firstChild;
    if (target.nextSibling.classList.contains("terminal")) return;
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }
    addButtons(target, target.parentNode.id);
  });
}
function addButtons(div, index) {
  if (index != 2)
    div.innerHTML += `<button onclick=moveLeft(${index}) style="font-size: 12px";><</button>`;
  div.innerHTML += `<button onclick=remove(${index}) style="font-size: 12px";>Close</button>`;
  if (index != getPaneNum() - 1)
    div.innerHTML += `<button onclick=moveRight(${index}) style="font-size: 12px";>></button>`;
}
function getPaneNum() {
  return $(".large").length + $(".medium").length + $(".small").length;
}
function loadAdditionalPage(additionalPage) {
  if (additionalPage.href === "http://xterm/") {
    if (xterm.isOpen) return;
    var style = "xterm";
    const size = "small";
    initializeDiv(style, size, "");
  } else {
    var style = "slack-only-body";
    const size = "small";
    initializeDiv(style, size, "");

    const webview = getWebviews()[getNumberOfWebviews() - 1];
    webview.id = style;
    webview.addEventListener("dom-ready", function() {
      initializeWebview(webview, additionalPage);
    });
    refreshButtons();
  }
}
function initializeDiv(style, size, url = "") {
  generatePane(size, style, url);
  if (size === "large" || size === "medium") generateDraggableBar(size);
}
function generatePane(size, style, url) {
  let divContainer = createContainerDiv(size);
  let divButtons = createButtonDiv();

  document.getElementById("main-content").appendChild(divContainer);
  divContainer.appendChild(divButtons);
  if (style === "xterm") {
    createXtermPane();
  } else {
    const webview = createWebview(style, url);
    divContainer.appendChild(webview);
  }
  calcWindowSize();
}
function createXtermPane() {
  ptyProcess = pty.spawn(xtshell, [], {
    cwd: process.cwd(),
    env: process.env
  });
  xterm = new Terminal({
    fontSize: `${fontSize}`
  });
  xterm.open(document.getElementById(getPaneNum() - 1));
  xterm.isOpen = true;
  xterm.on("data", data => {
    ptyProcess.write(data);
    if (data === "") closeXtermPane(); // Ctrl+d
  });
  ptyProcess.on("data", function(data) {
    xterm.write(data);
  });
}
function closeXtermPane() {
  const target = document.getElementsByClassName("terminal")[0];
  remove(target.parentNode.id);
  xterm.isOpen = false;
}
function generateDraggableBar(size) {
  let divBar = document.createElement("div");
  divBar.id = size === "large" ? "dragbar-vertical" : "dragbar-horizontal";
  document.getElementById("main-content").appendChild(divBar);
}
function createContainerDiv(size) {
  let div = document.createElement("div");
  div.id = getPaneNum();
  div.className = size;
  div.style.order = getPaneNum();
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
  if (
    url.startsWith("http://") ||
    url.startsWith("https://" || url.startsWith("file://"))
  ) {
    shell.openExternal(url);
  }
}
function checkUrlIsDefault(webview) {
  return webview.attributes.src.value == "about:blank";
}
function applyCss(webview, css) {
  webview.insertCSS(css);
}
function savePaneSize() {
  store.set("contents.1.height", configHeight);
  store.set("contents.0.width", configWidth);
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
  store.set(settings);
  remote.getCurrentWindow().reload();
}
function clearStoredSettings() {
  store.clear();
  remote.getCurrentWindow().reload();
}
function loadSettings() {
  if (noSettings()) {
    openFileAndSave();
    return;
  }

  return buildJsonObjectFromStoredData();
}
function buildJsonObjectFromStoredData() {
  let jsonObj = {
    url_options: store.get("url_options"),
    contents: store.get("contents")
  };

  return jsonObj;
}
function noSettings() {
  return store.size == 0;
}
function calcWindowSize() {
  if (xterm.isOpen === true) xterm.fit();
  const smallNum = document.getElementsByClassName("small").length;
  const main = document.getElementById("main-content");
  let columns = "";
  let rows = "";
  if (configWidth !== undefined) {
    columns = `grid-template-columns: ${configWidth}% ${100 -
      configWidth}% !important ;`;
  }
  if (configHeight !== undefined) {
    rows = `grid-template-rows: ${configHeight}% 0% ${100 -
      configHeight}% !important ;`;
  }
  if (smallNum !== 0) {
    const ratio = `${(100 - configWidth) / smallNum}% `.repeat(smallNum);
    columns = `grid-template-columns: ${configWidth}% 0% ${ratio} !important ;`;
  } else {
    columns = `grid-template-columns: ${configWidth}% 0% ${100 -
      configWidth}% !important ;`;
    rows = `grid-template-rows: 99% 1% !important ;`;
  }
  main.style = columns + rows;
  if (configWidth !== undefined) savePaneSize();
}
