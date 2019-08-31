const { shell } = require("electron");
var { remote } = require("electron");
var { Menu, MenuItem } = remote;
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();
const json = loadSettings();
const options = loadUserSettings();
const menu = require("./menu");
const mainWidth = document.getElementById("main-content").clientWidth;
const mainHeight = document.getElementById("main-content").clientHeight;
let allWidth = json.contents[0].allWidth;
let configWidth = json.contents[0].width;
let configHeight = json.contents[1].height;

initialize();

var dragging_vertical = false;
var dragging_horizontal = false;
var dragging_vertical_small = false;
var draggingId = "";
$("#dragbar-vertical, .dragbar-vertical-small").mousedown(function(e) {
  e.preventDefault();
  $("#main-content").css("pointer-events", "none");
  if (this.id === "dragbar-vertical") {
    draggingId = "0";
    dragging_vertical = true;
  } else {
    dragging_vertical_small = true;
    draggingId = this.id.replace(/[^0-9]/g, "");
  }
  const main = $("#main-content");
  const ghostbar = $("<div>", {
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

window.onresize = function() {
  remote.getCurrentWindow().reload();
};

$("#dragbar-horizontal").mousedown(function(e) {
  e.preventDefault();
  $("#main-content").css("pointer-events", "none");

  dragging_horizontal = true;
  const main = $(".medium");
  const ghostbar = $("<div>", {
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
    const largeWidth = document.getElementById("0").clientWidth;
    const smallPanes = Array.from(document.getElementsByClassName("small"));
    if (smallPanes.length !== 0) {
      let nextPaneLen = largeWidth;
      smallPanes.forEach(function(pane) {
        if (pane.id <= 2) nextPaneLen += pane.clientWidth;
      });
      if (e.pageX >= nextPaneLen) return;
      $("#2").css("width", nextPaneLen - e.pageX);
    }

    $("#0").css("width", e.pageX);
    $("#ghostbar-vertical").remove();
    $(document).unbind("mousemove");
    dragging_vertical = false;
    calcWindowSize();
  }
  if (dragging_horizontal) {
    $(".medium").css("height", e.pageY);
    $("#ghostbar-horizontal").remove();
    $(document).unbind("mousemove");
    dragging_horizontal = false;
    calcWindowSize();
  }
  if (dragging_vertical_small) {
    const largeWidth = document.getElementById("0").clientWidth;
    const smallPanes = Array.from(document.getElementsByClassName("small"));
    var otherPanesLen = largeWidth;
    var nextPaneLen = largeWidth;

    // drop可能な範囲を限定
    smallPanes.forEach(function(pane) {
      if (pane.id < draggingId) otherPanesLen += pane.clientWidth;
      if (pane.id <= Number(draggingId) + 1) nextPaneLen += pane.clientWidth;
    });
    if (e.pageX <= otherPanesLen || e.pageX >= nextPaneLen) return;
    $(`#${draggingId}`).css("width", e.pageX - otherPanesLen);
    $(`#${Number(draggingId) + 1}`).css("width", nextPaneLen - e.pageX);

    $("#ghostbar-vertical").remove();
    $(document).unbind("mousemove");
    dragging_vertical_small = false;
    calcWindowSize();
  }
});

$(document).keydown(function(e) {
  if (
    e.keyCode == 27 &&
    document.getElementsByClassName("overlay").length !== 0
  ) {
    const main = document.getElementById("main-content");
    main.removeChild(document.getElementsByClassName("overlay")[0]);
  }
});

function initialize() {
  if (store.size == 0) return;

  initializeMenu(menu.menuTemplate);
  const contents = json.contents;
  contents.forEach(function(content) {
    if (content["size"] === undefined) content["size"] = "small";
    createPane(content["size"], content["url"], true);
  });

  getWebviews().forEach(function(webview, index) {
    webview.addEventListener("dom-ready", function() {
      initializeWebview(
        webview,
        json.contents[index]["url"],
        json.contents[index]["customCSS"]
      );
      if (
        webview.parentNode.classList.contains("small") &&
        !webview.previousSibling.hasChildNodes()
      ) {
        addButtons(webview.previousSibling, webview.parentNode.id);
      }
    });
  });
}

function initializeMenu(template) {
  let menu = Menu.buildFromTemplate(template);
  const settingsMenu = createSettingsMenu();
  menu.append(settingsMenu);

  const menuItemForSmallPane = createMenuItemForSmallPane();
  menu.append(menuItemForSmallPane);

  Menu.setApplicationMenu(menu);
}

function createMenuItemForSmallPane() {
  const menuItem = new MenuItem({
    id: "smallPane",
    label: "Open",
    submenu: []
  });
  options.splice(0, 2);
  const content = getAdditionalPaneInfo(options);
  const additionalPaneMenuItems = createAdditionalPaneMenuItems(content);

  additionalPaneMenuItems.forEach(function(apMenuItem) {
    menuItem.submenu.append(apMenuItem);
  });
  menuItem.submenu.append(new MenuItem({ type: "separator" }));
  menuItem.submenu.append(createGoogleMenuItem());
  return menuItem;
}

function createSettingsMenu() {
  const menuItem = new MenuItem({
    id: "settings",
    label: "Settings",
    submenu: [
      {
        label: "Reload",
        click() {
          store.clear();
          remote.getCurrentWindow().reload();
        }
      }
    ]
  });

  return menuItem;
}

function createAdditionalPaneMenuItems(contents) {
  const additionalPaneMenuItems = contents.map(function(content) {
    return new MenuItem({
      label: content["name"],
      accelerator: `Command+${content["index"] + 1}`,
      click() {
        loadAdditionalPage(content["url"], content["customCSS"]);
      }
    });
  });

  return additionalPaneMenuItems;
}

function createGoogleMenuItem() {
  return new MenuItem({
    label: "Search in Google",
    accelerator: "Command+l",
    click() {
      openGoogleInOverlay();
    }
  });
}

function openGoogleInOverlay() {
  const main = document.getElementById("main-content");
  const div = document.createElement("div");
  const label = document.createElement("label");
  div.className = "overlay";
  label.className = "overlay-message";
  label.innerHTML = "Press Esc to Close";
  div.appendChild(label);
  main.appendChild(div);
  const webview = createWebview("normal", "https://google.com");
  webview.addEventListener("dom-ready", function() {
    initializeWebview(webview, "https://google.com");
    webview.focus();
  });
  div.appendChild(webview);
}

function getAdditionalPaneInfo(contents) {
  const content = contents.map(function(content, index) {
    try {
      url = new URL(content["url"]);
    } catch {
      alert(
        "[Error] invalid URL format found in settings.json.  Maybe [workspace] in settings?"
      );
    }
    return {
      name: content["name"],
      url: url,
      customCSS: content["customCSS"],
      index: index
    };
  });
  return content;
}

function getWebviews() {
  let webviews = Array.from(document.getElementsByTagName("webview"));
  return webviews;
}

function initializeWebview(webview, url, customCSS = []) {
  registerToOpenUrl(webview, shell);
  webview.insertCSS(customCSS.join(" "));
  webview.autosize = "on";

  if (webview.src === "about:blank") {
    webview.loadURL(url.toString());
  } else {
    addKeyEvents(webview);
    if (!webview.parentNode.classList.contains("overlay"))
      addMaximizeButton(webview.parentNode, webview.parentNode.id);
  }
}

function addKeyEvents(webview) {
  webview.getWebContents().on("before-input-event", (event, input) => {
    if (
      input.meta &&
      input.key === "w" &&
      webview.parentNode.classList.contains("small")
    ) {
      remove(webview.parentNode.id);
    }
    if (webview.parentNode.classList.contains("overlay")) {
      if (input.key === "Escape" || (input.meta && input.key === "w")) {
        const main = document.getElementById("main-content");
        main.removeChild(document.getElementsByClassName("overlay")[0]);
      }
      if (input.meta && input.key === "[") {
        webview.goBack();
      }
      if (input.meta && input.key === "]") {
        webview.goForward();
      }
    }
  });
}

function remove(index) {
  draggingId = "";
  const target = document.getElementById(index);
  const targetBar = document.getElementById(`dvs-${index}`);
  const parent = target.parentNode;
  const smallPanes = Array.from(document.getElementsByClassName("small"));
  const bars = Array.from(
    document.getElementsByClassName("dragbar-vertical-small")
  );
  store.delete(`contents.${index}`);
  saveNewContents();

  smallPanes.forEach(function(pane) {
    if (pane.id > index) {
      pane.id = Number(pane.id) - 1;
      pane.style.order = Number(pane.id) - 1;
    }
  });
  bars.forEach(function(bar) {
    id = Number(bar.id.replace(/[^0-9]/g, ""));
    if (id > index) {
      bar.id = `dvs-${id - 1}`;
      bar.style = `grid-column: ${(id - 1) * 2} / ${(id - 1) * 2 + 1}`;
    }
  });
  parent.removeChild(target);
  parent.removeChild(targetBar);
  calcWindowSize();
  refreshButtons();
}

function move(index, next) {
  const json = loadSettings();
  const src = document.getElementById(index);
  const dst = document.getElementById(Number(index) + Number(next));
  const storeSrc = src.querySelector("webview");
  const storeDst = dst.querySelector("webview");
  storeUrl(dst.id, storeSrc.src);
  storeUrl(src.id, storeDst.src);
  const tmp = src.id;
  const tmpCSS = json.contents[index]["customCSS"];
  storeCustomCSS(src.id, json.contents[dst.id]["customCSS"]);
  src.id = src.style.order = dst.id;
  storeCustomCSS(dst.id, tmpCSS);
  dst.id = dst.style.order = tmp;

  refreshButtons();
}

function maximize(index) {
  const target = document.getElementById(index);
  const url = target.querySelector("webview").src;
  const main = document.getElementById("main-content");
  const div = document.createElement("div");
  const label = document.createElement("label");
  div.className = "overlay";
  label.className = "overlay-message";
  label.innerHTML = "Press Esc to Close";
  div.appendChild(label);
  main.appendChild(div);
  const webview = createWebview("normal", url);
  webview.addEventListener("dom-ready", function() {
    initializeWebview(webview, url);
  });
  div.appendChild(webview);
}

function refreshButtons() {
  const main = document.getElementById("main-content");
  const children = Array.from(main.children);
  children.forEach(function(child) {
    if (!child.classList.contains("small")) return;
    const target = child.querySelector(".tool-buttons");
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }
    addButtons(target, target.parentNode.id);
    child.style.width = "100%";
    child.style.height = "100%";

    const maxBtn = child.querySelector(".max-button");
    if (maxBtn !== null) maxBtn.parentNode.removeChild(maxBtn);
    addMaximizeButton(child, target.parentNode.id);
  });
}

function addButtons(div, index) {
  if (index != 2)
    div.innerHTML += `<button onclick=move(${index},"-1") style="font-size: 12px";><</button>`;
  if (getPaneNum() !== 3)
    div.innerHTML += `<button onclick=remove(${index}) style="font-size: 12px";>Close</button>`;
  if (index != getPaneNum() - 1)
    div.innerHTML += `<button onclick=move(${index},"1") style="font-size: 12px";>></button>`;
}

function addMaximizeButton(div, index) {
  const btn = document.createElement("button");
  btn.className = "max-button";
  btn.setAttribute("onclick", `maximize(${index})`);
  btn.innerHTML = `<i class="fas fa-arrows-alt-h fa-rotate-135"></i>`;
  btn.style = "font-size: 14px;";
  div.insertBefore(btn, div.firstChild);
}

function getPaneNum() {
  return $(".large").length + $(".medium").length + $(".small").length;
}

function loadAdditionalPage(additionalPage, customCSS = []) {
  resetWindowSize();
  const size = "small";
  createPane(size, "");
  storeSize(getPaneNum() - 1, size);
  storeUrl(getPaneNum() - 1, additionalPage);
  storeCustomCSS(getPaneNum() - 1, customCSS);

  const webview = getWebviews()[getPaneNum() - 1];
  webview.addEventListener("dom-ready", function() {
    initializeWebview(webview, additionalPage, customCSS);
  });
  refreshButtons();
}

function storeSize(index, size) {
  store.set(`contents.${index}.size`, size);
}

function storeUrl(index, url) {
  store.set(`contents.${index}.url`, url);
}

function storeCustomCSS(index, customCSS) {
  store.set(`contents.${index}.customCSS`, customCSS);
}

function createPane(size, url = "", init = false) {
  let divContainer = createContainerDiv(size);
  let divButtons = createButtonDiv();

  document.getElementById("main-content").appendChild(divContainer);
  divContainer.appendChild(divButtons);

  const webview = createWebview(url);
  divContainer.appendChild(webview);

  createDraggableBar(size);
  calcWindowSize(init);
}

function createDraggableBar(size) {
  let div = document.createElement("div");
  if (size === "large") {
    div.id = "dragbar-vertical";
  } else if (size === "medium") {
    div.id = "dragbar-horizontal";
  } else {
    div.id = `dvs-${getPaneNum() - 1}`;
    div.className = "dragbar-vertical-small";
    div.style = `grid-column: ${(getPaneNum() - 1) * 2} / 
      ${(getPaneNum() - 1) * 2 + 1}`;
  }
  document.getElementById("main-content").appendChild(div);
}

function createContainerDiv(size) {
  let div = document.createElement("div");
  div.id = getPaneNum();
  div.className = size;
  div.style.order = getPaneNum();
  return div;
}

function createButtonDiv() {
  let div = document.createElement("div");
  div.className = "tool-buttons";

  return div;
}

function createWebview(url = "") {
  let webview = document.createElement("webview");
  webview.src = "about:blank";
  webview.id = "normal";
  webview.url = url;
  return webview;
}

function registerToOpenUrl(webview) {
  webview.removeEventListener("new-window", openExternalUrl);
  webview.addEventListener("new-window", openExternalUrl);
}

function openExternalUrl(event) {
  const url = event.url;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://")
  ) {
    shell.openExternal(url);
  }
}

function autoLoadSettingsInCurrentDir() {
  try {
    if (__dirname + "/settings.json") saveJson(__dirname + "/settings.json");
  } catch (err) {
    alert("[Error in loading settings] " + err.message);
  }
}

function saveJson(jsonPath) {
  const settings = JSON.parse(fs.readFileSync(jsonPath));
  if (!validateJson(settings)) {
    return null;
  }

  store.set(settings);
  remote.getCurrentWindow().reload();
}

function validateJson(jsonObj) {
  if (!jsonObj.contents) {
    alert("Error in settings: contents is invalid");
    return false;
  }
  jsonObj.contents.forEach(function(content) {
    if (content["customCSS"] === undefined) content["customCSS"] = [];
  });

  return true;
}

function loadSettings() {
  if (store.size == 0) {
    autoLoadSettingsInCurrentDir();
    return;
  }

  return buildJsonObjectFromStoredData();
}

function loadUserSettings() {
  var settings = JSON.parse(fs.readFileSync(__dirname + "/settings.json"));
  if (!validateJson(settings)) {
    return null;
  }
  return settings["contents"];
}

function saveNewContents() {
  const contents = store.get("contents");
  let newContents = [];
  contents.forEach(function(content) {
    if (content !== null) newContents.push(content);
  });
  store.set("contents", newContents);
}

function buildJsonObjectFromStoredData() {
  const contents = store.get("contents");
  let newContents = [];
  contents.forEach(function(content) {
    if (content !== null) newContents.push(content);
  });
  store.set("contents", newContents);
  let jsonObj = {
    contents: newContents
  };

  return jsonObj;
}

function resetWindowSize() {
  const smallNum = document.getElementsByClassName("small").length;
  const main = document.getElementById("main-content");
  ratio =
    `${configWidth}% 0% ` +
    `${(100 - configWidth) / smallNum}% 0% `.repeat(smallNum);
  columns = `grid-template-columns: ${ratio} !important ;`;
  rows = `grid-template-rows: ${configHeight}% 0% ${100 -
    configHeight}% !important ;`;
  main.style = columns + rows;
  draggingId = "";
}

function calcWindowSize(init = false) {
  const smallNum = document.getElementsByClassName("small").length;
  const main = document.getElementById("main-content");
  const largeWidth = $(".large")[0].clientWidth;
  if ($(".medium")[0] !== undefined)
    var mediumHheight = $(".medium")[0].clientHeight;
  let columns = "";
  let rows = "";
  configWidth = (largeWidth / mainWidth) * 100;
  configHeight = (mediumHheight / mainHeight) * 100;
  if (draggingId !== undefined && draggingId !== "") {
    nextNum =
      draggingId === "0" ? Number(draggingId) + 2 : Number(draggingId) + 1;
    const target = document.getElementById(`${draggingId}`);
    const next = document.getElementById(`${nextNum}`);
    let arColumns = main.style["grid-template-columns"].split(" ");
    var newSmallWidth = (target.clientWidth / mainWidth) * 100;
    var nextWidth = Math.abs((next.clientWidth / mainWidth) * 100);
    // Largeペインだけ特別扱い（統合したい…）
    if (draggingId === "0") {
      arColumns[0] = `${newSmallWidth}% `;
      arColumns[2] = `${nextWidth}% `;
    } else {
      arColumns[Number(draggingId) * 2 - 2] = `${newSmallWidth}% `;
      arColumns[Number(draggingId) * 2] = `${nextWidth}% `;
    }
    ratio = arColumns.join(" ");
  } else {
    // リセット時の処理なので等分するだけ
    ratio =
      `${configWidth}% 0% ` +
      `${(100 - configWidth) / smallNum}% 0% `.repeat(smallNum);
  }
  columns = `grid-template-columns: ${ratio} !important ;`;
  rows = `grid-template-rows: ${configHeight}% 0% ${100 -
    configHeight}% !important ;`;
  if (init && allWidth !== undefined) columns = allWidth;
  main.style = columns + rows;
  const panes = Array.from(document.getElementsByClassName("small"));
  panes.forEach(function(pane) {
    pane.style.width = "100%";
    pane.style.height = "100%";
  });
  if (configHeight !== undefined) {
    store.set("contents.0.width", configWidth);
    store.set("contents.0.allWidth", columns);
    store.set("contents.1.height", configHeight);
  }
}

var savedLargeWidth = document.getElementById("0").clientWidth;
function foldLargePane() {
  const largeWidth = document.getElementById("0").clientWidth;
  const smallPanes = Array.from(document.getElementsByClassName("small"));
  let newWidth = 700;
  if (smallPanes.length !== 0) {
    var nextPaneLen = largeWidth;
    smallPanes.forEach(function(pane) {
      if (pane.id <= 2) nextPaneLen += pane.clientWidth;
    });
  }
  draggingId = "0";
  if (
    savedLargeWidth === 0 ||
    savedLargeWidth === nextPaneLen ||
    savedLargeWidth === 700
  ) {
    savedLargeWidth = largeWidth;
    $("#0").css("width", 160);
    $("#2").css("width", nextPaneLen - 160);
    savedLargeWidth = 160;
    calcWindowSize();
  } else if (savedLargeWidth === 160) {
    if (nextPaneLen <= 700) {
      newWidth = nextPaneLen;
    }
    $("#0").css("width", newWidth);
    $("#2").css("width", nextPaneLen - newWidth);
    calcWindowSize();
    savedLargeWidth = newWidth;
  } else {
    $("#0").css("width", savedLargeWidth);
    $("#2").css("width", nextPaneLen - savedLargeWidth);
    calcWindowSize();
    savedLargeWidth = 0;
  }
}
