const { shell } = require("electron");
var { remote, ipcRenderer } = require("electron");
var { Menu, MenuItem, dialog } = remote;
const app = remote.app;
const fs = require("fs");
const path = require("path");
const Store = require("electron-store");
const store = new Store();
const menu = require("./menu");
const WebView = require("./components/webview");

/**
 * このウィンドウが表示しているボードのインデックス
 */
let currentBoardIndex = 0

/**
 * アプリケーションのバージョン情報
 */
const VERSION = "1.7.0";

/**
 * ボード全体のサイズ
 */
const mainContentSize = {
  width: document.getElementById("main-content").clientWidth,
  height: document.getElementById("main-content").clientHeight
};

/**
 * 初期描画するボードの情報
 */
let json = loadSettings();

let allWidth = json.contents[0].allWidth;
let configWidth = json.contents[0].width;
let configHeight = json.contents[1].height;

/**
 * ウィンドウサイズが変わるたびに、全て再描画し直す
 */
window.onresize = function () {
  remote.getCurrentWindow().reload();
};

/**
 * 現在ドラッグ中のペイン間の境界情報
 */
const draggingBoarder = {
  id: "",
  isVertical: false,
  isVerticalSmall: false,
  isHorizontal: false
};

/**
 * ペインのIDに対応するWebViewオブジェクトを管理するマッパー
 * TODO: ペインクラスをちゃんと作ってオブジェクト指向で管理するようにする
 */
const webViews = {};

function boardNameToIndex() {
  const currentBoardName = remote.getCurrentWindow().boardName
  if (currentBoardName) {
    const res = store.get("boards").findIndex((board) => {
      if (board["name"] === currentBoardName) {
        return true
      }
    })

    // 存在しないボードを参照したときには 0 番目を返す
    return res === -1 ? 0 : res
  } else {
    return 0
  }
}

/**
 * 初期化
 */
initialize();

/**
 * 縦のボーダー上でのマウスダウンをトリガーにドラッグ可視化用のゴーストバーを生成し、カーソル移動に追従させる
 */
$("#dragbar-vertical, .dragbar-vertical-small").mousedown(function (e) {
  e.preventDefault();
  $("#main-content").css("pointer-events", "none");
  if (this.id === "dragbar-vertical") {
    draggingBoarder.id = "0";
    draggingBoarder.isVertical = true;
  } else {
    draggingBoarder.id = this.id.replace(/[^0-9]/g, "");
    draggingBoarder.isVerticalSmall = true;
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

  $(document).mousemove(function (e) {
    ghostbar.css("left", e.pageX + 2);
  });
});

/**
 * 横のボーダー上でのマウスダウンをトリガーにドラッグ可視化用のゴーストバーを生成し、カーソル移動に追従させる
 */
$("#dragbar-horizontal").mousedown(function (e) {
  e.preventDefault();
  $("#main-content").css("pointer-events", "none");

  draggingBoarder.id = "0";
  draggingBoarder.isHorizontal = true;
  const main = $(".medium");
  const ghostbar = $("<div>", {
    id: "ghostbar-horizontal",
    css: {
      width: main.outerWidth(),
      top: main.offset().top,
      left: main.offset().left
    }
  }).appendTo("body");

  $(document).mousemove(function (e) {
    ghostbar.css("top", e.pageY + 2);
  });
});

/**
 * ドラッギング完了をトリガに、ペインのリサイズを完了させる
 */
$(document).mouseup(function (e) {
  if (draggingBoarder.isVertical) {
    const largeWidth = document.getElementById("0").clientWidth;
    const smallPanes = Array.from(document.getElementsByClassName("small"));
    if (smallPanes.length !== 0) {
      let nextPaneLen = largeWidth;
      smallPanes.forEach(function (pane) {
        if (pane.id <= 2) nextPaneLen += pane.clientWidth;
      });
      if (e.pageX >= nextPaneLen) return;
      $("#2").css("width", nextPaneLen - e.pageX);
    }

    $("#0").css("width", e.pageX);
    $("#ghostbar-vertical").remove();
    $(document).unbind("mousemove");
    draggingBoarder.isVertical = false;
    calcWindowSize();
  }
  if (draggingBoarder.isVerticalSmall) {
    const largeWidth = document.getElementById("0").clientWidth;
    const smallPanes = Array.from(document.getElementsByClassName("small"));
    var otherPanesLen = largeWidth;
    var nextPaneLen = largeWidth;

    // drop可能な範囲を限定
    smallPanes.forEach(function (pane) {
      if (pane.id < draggingBoarder.id) otherPanesLen += pane.clientWidth;
      if (pane.id <= Number(draggingBoarder.id) + 1) nextPaneLen += pane.clientWidth;
    });
    if (e.pageX <= otherPanesLen || e.pageX >= nextPaneLen) return;
    $(`#${draggingBoarder.id}`).css("width", e.pageX - otherPanesLen);
    $(`#${Number(draggingBoarder.id) + 1}`).css("width", nextPaneLen - e.pageX);

    $("#ghostbar-vertical").remove();
    $(document).unbind("mousemove");
    draggingBoarder.isVerticalSmall = false;
    calcWindowSize();
  }
  if (draggingBoarder.isHorizontal) {
    $(".medium").css("height", e.pageY);
    $("#ghostbar-horizontal").remove();
    $(document).unbind("mousemove");
    draggingBoarder.isHorizontal = false;
    calcWindowSize();
  }
});

/**
 * 開いているオーバーレイウィンドウをESC押下で閉じれるように
 */
$(document).keydown(function (e) {
  if (e.keyCode == 27 && document.getElementsByClassName("overlay").length !== 0) {
    const main = document.getElementById("main-content");
    main.removeChild(document.getElementsByClassName("overlay")[0]);
  }
});

/**
 * アプリケーション起動時の初期設定
 * バージョン確認、設定ファイルの互換性確認、メニュー生成、ペインとWebViewの初期化
 */
function initialize() {
  if (store.size == 0) return;
  getLatestVersion();

  remote.getCurrentWindow().on('focus', () => {
    initializeMenu(menu.menuTemplate);
  })
  initializeMenu(menu.menuTemplate);

  // 使用中のボードをStoreから参照し、ペインの初期描画を行う
  const contents = json.contents;
  contents.forEach(function (content) {
    if (content["size"] === undefined) content["size"] = "small";
    if (content["zoom"] === undefined) content["zoom"] = 1.0;
    createPane(content, true);
  });
  // 描画されたWebviewを操作するためのUIを追加する
  getWebviews().forEach(function (webviewElm) {
    const webView = convertToWebViewInstance(webviewElm);
    webviewElm.addEventListener("dom-ready", function () {
      const isSmallPane = webviewElm.parentNode.classList.contains("small");
      const hasButtons = webviewElm.previousSibling.hasChildNodes();
      if (isSmallPane && !hasButtons) {
        addButtons(webviewElm.previousSibling, webviewElm.parentNode.id);
      }
      addMaximizeButton(webviewElm.parentNode, webviewElm.parentNode.id);
      addReloadButton(webviewElm.parentNode, webviewElm.parentNode.id);
      addSearchbox(webView);
    });
  });
}

/**
 * GithubAPI経由でアプリケーションの最新バージョン情報を取得し、
 * 古い場合はアラートアイコンを表示させる
 */
function getLatestVersion() {
  const request = new XMLHttpRequest();
  request.open(
    "GET",
    "https://api.github.com/repos/konoyono/okadash/releases/latest"
  );
  request.onreadystatechange = function () {
    if (request.readyState != 4) {
      // requesting
    } else if (request.status != 200) {
      // request failed...
    } else {
      const res = JSON.parse(request.responseText);
      checkLatestVersion(res["tag_name"]);
    }
  };
  request.send(null);
}

/**
 * アプリケーションのバージョンが指定バージョンと合致しない場合、アラートアイコンを表示させる
 * @param {string} latest 比較対象のバージョン情報
 */
function checkLatestVersion(latest) {
  if (VERSION != latest) $("#alert-icon").css("display", "block");
}

/**
 * メニューテンプレートを元にメニューを生成する
 * @param {any} template
 */
function initializeMenu(template) {
  let menu = Menu.buildFromTemplate(template);

  const menuItemForSmallPane = createMenuItemForSmallPane();
  menu.append(menuItemForSmallPane);

  const menuItemForBoard = createMenuItemForBoard();
  menu.append(menuItemForBoard);

  Menu.setApplicationMenu(menu);
}

/**
 * Board メニューを生成する
 */
function createMenuItemForBoard() {
  const menuItem = new MenuItem({
    id: "board",
    label: "Board",
    submenu: []
  });
  const boardMenuItems = createBoardMenuItems();
  boardMenuItems.forEach(function (boardMenuItem, i) {
    menuItem.submenu.append(boardMenuItem);
    if (i === 0) menuItem.submenu.append(new MenuItem({ type: "separator" }));
  });
  menuItem.submenu.append(new MenuItem({ type: "separator" }));
  menuItem.submenu.append(
    new MenuItem({
      label: "Export This Board",
      click() {
        exportUsingBoard();
      }
    })
  );
  menuItem.submenu.append(
    new MenuItem({
      label: "Preferences",
      accelerator: "CommandOrControl+,",
      click() {
        ipcRenderer.send("window-open");
      }
    })
  );
  return menuItem;
}

/**
 * ペインリロードメニューを生成する
 * @param {string} index 対象ペイン要素のID
 */
function createMenuItemForContextmenu(index) {
  const options = store.get(`options.${currentBoardIndex}.contents`);
  const content = getAdditionalPaneInfo(options);

  return createContextMenuItems(content, index);
}

/**
 * Open メニューを生成する
 */
function createMenuItemForSmallPane() {
  const menuItem = new MenuItem({
    id: "smallPane",
    label: "Open",
    submenu: []
  });
  const options = store.get(`options.${currentBoardIndex}.contents`);
  const content = getAdditionalPaneInfo(options);
  const additionalPaneMenuItems = createAdditionalPaneMenuItems(content);

  additionalPaneMenuItems.forEach(function (apMenuItem) {
    menuItem.submenu.append(apMenuItem);
  });
  menuItem.submenu.append(new MenuItem({ type: "separator" }));
  menuItem.submenu.append(createNewPaneFromURLMenuItem());

  return menuItem;
}

/**
 * 現在表示しているボードをJSON出力する
 */
function exportUsingBoard() {
  const usingBoard = store.get("boards")[currentBoardIndex];
  // jsonにしたものをファイルに吐き出す
  // allWidthとかとってこれる？
  delete usingBoard.name;
  const win = remote.getCurrentWindow();
  dialog.showSaveDialog(
    win,
    {
      properties: ["openFile"],
      filters: [
        {
          name: "Documents",
          extensions: ["json"]
        }
      ]
    },
    fileName => {
      if (fileName) {
        const data = JSON.stringify(usingBoard, null, 2);
        writeFile(fileName, data);
      }
    }
  );
}

/**
 * ファイル出力する
 * @param {string} path
 * @param {string} data
 */
function writeFile(path, data) {
  fs.writeFile(path, data, error => {
    if (error != null) {
      alert("save error.");
      return;
    }
  });
}

/**
 * ボード切り替え用のメニューを生成する
 */
function createBoardMenuItems() {
  const allOptions = store.get("options");
  const boardMenuItems = [];
  for (i in allOptions) {
    const index = i;
    if (i == 0) {
      boardMenuItems.push(
        new MenuItem({
          label: allOptions[i]["name"] + " [ default ]",
          index: i
        })
      );
    } else {
      boardMenuItems.push(
        new MenuItem({
          label: allOptions[i]["name"],
          accelerator: `CommandOrControl+Option+${i}`,
          index: i,
          click() {
            openNewWindow(index);
          }
        })
      );
    }
  }

  return boardMenuItems;
}

/**
 * 選択したボードを使用中ボードに切り替える
 * @param {number} index 選択されたボードのインデックス
 */
function openNewWindow(index) {
  const allOptions = store.get("options");
  const boardName = allOptions[index]["name"]
  ipcRenderer.send("subwindow-open", boardName)
}

/**
 * ボード内のアイテムリスト情報を元に、ペイン追加用のメニューアイテムを生成する
 * @param {Array} contents
 */
function createAdditionalPaneMenuItems(contents) {
  const additionalPaneMenuItems = contents.map(function (content) {
    return new MenuItem({
      label: content["name"],
      accelerator: `CommandOrControl+${content["index"] + 1}`,
      click() {
        loadAdditionalPage(content);
      }
    });
  });

  return additionalPaneMenuItems;
}

/**
 * アイテムリストを元に、ペイン再生性用のメニューアイテムを作成する
 * @param {[any]}  contents
 * @param {string} index 対象ペイン要素のID
 */
function createContextMenuItems(contents, index) {
  const contextMenuItems = contents.map(function (content) {
    return new MenuItem({
      label: content["name"],
      click() {
        recreateSelectedPane(index, content);
      }
    });
  });

  return contextMenuItems;
}

/**
 * Create new from URL メニューを生成する
 */
function createNewPaneFromURLMenuItem(index) {
  return new MenuItem({
    label: "Open new pane from URL",
    click() {
      openNewPaneFromUrlDialog(index)
    }
  });
}

/**
 * URLから新規ペインを作成するためのダイアログを開く
 * @param {string} 挿入するペイン(省略した場合新規smallペインを生成)
 */
function openNewPaneFromUrlDialog(index = null) {
  const dlg = document.querySelector("#create-new-pane-dialog");
  dlg.style.display = "block";
  dlg.showModal();

  function onClose() {
    if (dlg.returnValue === "ok") {
      const newContent = {
        name: dlg.querySelector(".name").value,
        url: dlg.querySelector(".url").value,
        zoom: 1,
        customCSS: []
      }

      if (index !== null) {
        recreateSelectedPane(index, newContent)
      } else {
        loadAdditionalPage(newContent)
      }
    } else {
      dlg.close()
    }
    dlg.style.display = "none";
  }
  dlg.addEventListener("close", onClose, { once: true });
}

/**
 * eventから現在のペインのURLとidを受け取り、
 * ペインを変更するためのダイアログを開く
 * @param {*} event 
 */
function replacePaneFromUrlDialog(event){
  const {url, id} = event.detail
  const dlg = document.querySelector("#create-new-pane-dialog");

  const index = getWebviews().findIndex(webView => {
    return webView.id === id
  })
  const pane = store.get("boards")[currentBoardIndex].contents[index]
  dlg.querySelector(".url").value = url; 
  dlg.querySelector(".name").value = pane.name;

  openNewPaneFromUrlDialog(index)
}
window.addEventListener("openReplaceUrlDialog", replacePaneFromUrlDialog)

/**
 * ボード内アイテムリストを元に、メニュー用のオブジェクトリストを戻す
 * @param {Array} contents ボード内のアイテムリスト
 */
function getAdditionalPaneInfo(contents) {
  const content = contents.map(function (content, index) {
    try {
      url = new URL(content["url"]);
    } catch {
      alert(
        "[Error] invalid URL format found in settings.  Maybe [workspace] in settings?"
      );
      ipcRenderer.send("window-open");
    }
    return {
      name: content["name"],
      url: content["url"],
      zoom: content["zoom"],
      customCSS: content["customCSS"],
      index: index
    };
  });
  return content;
}

/**
 * 現在描画されているWebviewの一覧を取得する
 */
function getWebviews() {
  let webviews = Array.from(document.getElementsByTagName("webview"));
  return webviews;
}

/**
 * Overlayを削除する
 */
function removeOverlay() {
  const main = document.getElementById("main-content");
  main.removeChild(document.getElementsByClassName("overlay")[0]);
}

/**
 * smallペインを削除する
 * @param {number} index 対象ペインのインデックス
 */
function removeSmallPane(index) {
  draggingBoarder.id = "";
  const target = document.getElementById(index);
  const targetBar = document.getElementById(`dvs-${index}`);
  const parent = target.parentNode;
  const smallPanes = Array.from(document.getElementsByClassName("small"));
  const bars = Array.from(document.getElementsByClassName("dragbar-vertical-small"));
  store.delete(`boards.${currentBoardIndex}.contents.${index}`);
  saveNewContents();

  smallPanes.forEach(function (pane) {
    if (pane.id > index) {
      pane.id = Number(pane.id) - 1;
      pane.style.order = Number(pane.id) - 1;
    }
  });
  bars.forEach(function (bar) {
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

/**
 * samllペインを左右入れ替えるボタンを生成する
 * @param {string} index 対象のペイン要素のID
 * @param {number} direction -1 or 1
 */
function createSwapButton(index, direction) {
  const swapTargetIndex = (Number(index) + direction).toString();
  const label = direction === -1 ? "<" : ">";

  return $(`<button style="font-size: 10px;">${label}</button>`).click(() =>
    swapSmallPane(index, swapTargetIndex)
  )[0];
}

/**
 * smallペインを閉じるボタンを生成する
 * @param {string} index 対象のペイン要素のID
 */
function createCloseButton(index) {
  return $(`<button style="font-size: 10px";>Close</button>`).click(() => {
    removeSmallPane(index);
  })[0];
}
/**
 * smallペインの内容を交換する
 * @param {string} fromIndex 交換もとペイン要素のID
 * @param {string} toIndex   交換さきペイン要素のID
 */
function swapSmallPane(fromIndex, toIndex) {
  const settings = loadSettings();
  const fromPane = document.getElementById(fromIndex);
  const toPane = document.getElementById(toIndex);

  // 両ペインの定義済み設定を交換
  storeUrl(fromIndex, settings.contents[toIndex]["url"]);
  storeUrl(toIndex, settings.contents[fromIndex]["url"]);
  storeZoom(fromIndex, settings.contents[toIndex]["zoom"]);
  storeZoom(toIndex, settings.contents[fromIndex]["zoom"]);
  storeCustomCSS(fromIndex, settings.contents[toIndex]["customCSS"]);
  storeCustomCSS(toIndex, settings.contents[fromIndex]["customCSS"]);

  // ペインのIDと表示位置を交換
  [fromPane.id, fromPane.style.order, toPane.id, toPane.style.order] = [
    toPane.id,
    toPane.id,
    fromPane.id,
    fromPane.id
  ];

  // ボタンの描画もし直す
  refreshButtons();
}

/**
 * ペインを最大化表示する
 * @param {string} index 対象要素のID
 */
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
  const webview = createWebView(div.id, { url, forOverlay: true });
  div.appendChild(webview.element);
}

/**
 * 各ペイン内のボタンを再描画する
 */
function refreshButtons() {
  const main = document.getElementById("main-content");
  const children = Array.from(main.children);
  children.forEach(function (child) {
    const target = child.querySelector(".tool-buttons");
    if (child.classList.contains("small")) {
      while (target.firstChild) {
        target.removeChild(target.firstChild);
      }
      addButtons(target, target.parentNode.id);
      child.style.width = "100%";
      child.style.height = "100%";
    }

    const maxBtn = child.querySelector(".max-button");
    if (maxBtn !== null) $(".max-button").remove();
    const reloadBtn = child.querySelector(".reload-button");
    if (reloadBtn !== null) $(".reload-button").remove();
    if (target !== null) {
      addMaximizeButton(child, target.parentNode.id);
      addReloadButton(child, target.parentNode.id);
    }
  });
}

/**
 * smallペイン操作用のボタンを描画する
 * @param {HTMLDivElement} div 描画対象の親要素
 * @param {string} index ペインのID
 */
function addButtons(div, index) {
  const isFirstSmallPane = index == 2;
  const isLastSmallPane = index == getPaneNum() - 1;
  const isOnlySmallPane = getPaneNum() == 3;

  if (!isFirstSmallPane) div.append(createSwapButton(index, -1));
  if (!isOnlySmallPane) div.append(createCloseButton(index));
  if (!isLastSmallPane) div.append(createSwapButton(index, 1));
}

/**
 * 検索UIを描画する
 * @param {WebView} webView UIを使用するWebViewオブジェクト
 */
function addSearchbox(webView) {
  const parent = webView.element.parentNode;
  const $searchBox = $(`
    <div class="search-box pane${parent.id}">
      <input type="text" class="search-input" placeholder="search for text in page">
      <span class="search-count"></span>
    </div>
  `);
  $searchBox.prependTo(parent);
  adjustSearchBox($searchBox);
  webView.initializeTextSeacher({
    boxSelector: `.search-box.pane${parent.id}`,
    inputSelector: `.search-box.pane${parent.id} .search-input`,
    countSelector: `.search-box.pane${parent.id} .search-count`,
    visibleSelector: `.visible`
  });
}

/**
 * ペインをリロードするボタンを描画する
 * @param {Element} div ボタンを挿入する要素
 * @param {string}  index クリック時に最大化する要素のID
 */
function addReloadButton(div, index) {
  const btn = document.createElement("button");
  btn.className = "reload-button";
  btn.setAttribute("onclick", `openContextMenu(${index})`);
  btn.innerHTML = `<i class="fas fa-exchange-alt"></i>`;
  btn.style = `font-size: 14px;  margin-left: ${div.clientWidth - 20}px;`;
  div.insertBefore(btn, div.firstChild);
}

/**
 * ペインを最大化するボタンを描画する
 * @param {Element} div ボタンを挿入する要素
 * @param {string}  index クリック時に最大化する要素のID
 */
function addMaximizeButton(div, index) {
  const btn = document.createElement("button");
  btn.className = "max-button";
  btn.setAttribute("onclick", `maximize(${index})`);
  btn.innerHTML = `<i class="fas fa-arrows-alt-h fa-rotate-135"></i>`;
  btn.style = "font-size: 14px;";
  div.insertBefore(btn, div.firstChild);
}

/**
 * ペインリロードメニューを開く
 * @param {string} 対象ペイン要素のID
 */
function openContextMenu(index) {
  const remote = require("electron").remote;
  const Menu = remote.Menu;

  var menu = new Menu();
  const contextMenuItems = createMenuItemForContextmenu(index);
  contextMenuItems.forEach(function (contextMenuItem, i) {
    menu.append(contextMenuItem);
  });

  menu.append(new MenuItem({ type: "separator" }));
  menu.append(createNewPaneFromURLMenuItem(index));

  menu.popup(remote.getCurrentWindow());
}

/**
 * 現在表示しているボードの全ペイン数
 */
function getPaneNum() {
  return $(".large").length + $(".medium").length + $(".small").length;
}

/**
 * smallペインを追加する
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.url
 * @param {string} params.zoom
 * @param {[string]} params.customCSS
 */
function loadAdditionalPage({ name, url, zoom = 1.0, customCSS = [] }) {
  resetWindowSize();
  const size = "small";
  createPane({ size, url, zoom, customCSS });
  storeName(getPaneNum() - 1, name);
  storeSize(getPaneNum() - 1, size);
  storeUrl(getPaneNum() - 1, url);
  storeZoom(getPaneNum() - 1, zoom);
  storeCustomCSS(getPaneNum() - 1, customCSS);

  const webviewElm = getWebviews()[getPaneNum() - 1];
  const webView = convertToWebViewInstance(webviewElm);
  webviewElm.addEventListener("dom-ready", function () {
    addMaximizeButton(webviewElm.parentNode, webviewElm.parentNode.id);
    addReloadButton(webviewElm.parentNode, webviewElm.parentNode.id);
    addSearchbox(webView);
  });
  refreshButtons();
}

/**
 * 対象ペインを再生成する
 * @param {string} index 対象ペイン要素のID
 * @param {object} params
 * @param {string} params.name
 * @param {string} params.url
 * @param {string} params.zoom
 * @param {[string]} params.customCSS
 */
function recreateSelectedPane(index, {name, url, zoom, customCSS }) {
  const div = document.getElementById(`${index}`);
  const webViewElm = div.querySelector("webview");
  convertToWebViewInstance(webViewElm).dispose();

  storeName(index, name);
  storeUrl(index, url);
  storeCustomCSS(index, customCSS);
  storeZoom(index, zoom);

  const webview = createWebView(div.id, { url, zoom, customCSS });
  div.appendChild(webview.element);
  addSearchbox(webview)
}

/**
 * 現在表示しているペインの名前を保存する
 * @param {string} index 対象ペインのID
 * @param {string} name
 */
function storeName(index, name) {
  store.set(`boards.${currentBoardIndex}.contents.${index}.name`, name);
}

/**
 * 現在表示しているペインのサイズを保存する
 * @param {string} index 対象ペインのID
 * @param {string} size
 */
function storeSize(index, size) {
  store.set(`boards.${currentBoardIndex}.contents.${index}.size`, size);
}

/**
 * 現在表示しているペインのURLを保存する
 * @param {string} index 対象ペインのID
 * @param {string} url
 */
function storeUrl(index, url) {
  store.set(`boards.${currentBoardIndex}.contents.${index}.url`, url);
}

/**
 * 現在表示しているペインの拡大率を保存する
 * @param {string} index 対象ペインのID
 * @param {string} zoom
 */
function storeZoom(index, zoom) {
  store.set(`boards.${currentBoardIndex}.contents.${index}.zoom`, zoom || 1.0);
}

/**
 * 現在表示しているペインのカスタムCSSを保存する
 * @param {string} index 対象ペインのID
 * @param {string} size
 */
function storeCustomCSS(index, customCSS) {
  store.set(`boards.${currentBoardIndex}.contents.${index}.customCSS`, customCSS || []);
}

/**
 * 新規ペインを描画する
 * @param {Object}   params
 * @param {string}   params.size
 * @param {number}   params.zoom
 * @param {[string]} params.customCSS
 * @param {boolean}  init  初期描画による作成であるか
 */
function createPane({ size, url, zoom, customCSS }, init = false) {
  let divContainer = createContainerDiv(size);
  let divButtons = createButtonDiv();

  document.getElementById("main-content").appendChild(divContainer);
  divContainer.appendChild(divButtons);
  const forSmallPane = size === "small";
  const webview = createWebView(divContainer.id, { url, zoom, customCSS, forSmallPane });
  divContainer.appendChild(webview.element);

  createDraggableBar(size);
  calcWindowSize(init);
}

/**
 * ドラッグ用のボーダー要素を生成する
 * @param {string} size
 */
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

/**
 * ペイン描画用のコンテナを生成する
 * @param {string} size
 */
function createContainerDiv(size) {
  let div = document.createElement("div");
  div.id = getPaneNum();
  div.className = size;
  div.style.order = getPaneNum();
  return div;
}

/**
 * smallペイン操作用ボタンを配置するためのコンテナを生成する
 */
function createButtonDiv() {
  let div = document.createElement("div");
  div.className = "tool-buttons";

  return div;
}

/**
 * storeを元に初期描画するボードのオブジェクトを生成する
 */
function loadSettings() {
  if (store.size == 0) {
    ipcRenderer.send("initial-open");
    return;
  }
  currentBoardIndex = boardNameToIndex()
  return buildJsonObjectFromStoredData(store.get("boards")[currentBoardIndex]);
}

/**
 * Webviewオブジェクトを生成する
 * @param {string}   id オブジェクトに紐付けるユニークな文字列
 * @param {Object}   params
 * @param {string}   params.url
 * @param {number}   params.zoom
 * @param {[string]} params.customCSS
 * @param {boolean}  params.forOverlay   オーバレイ用途であるか
 * @param {boolean}  params.forSmallPane smallペイン用途であるか
 */
function createWebView(id, { url, zoom, customCSS, forOverlay, forSmallPane }) {
  const webview = new WebView({ url, zoom, customCSS });
  if (forOverlay) {
    webview.addShortcutKey("Escape", _ => removeOverlay());
    webview.addShortcutKey("meta+w", _ => removeOverlay());
  } else if (forSmallPane) {
    webview.addShortcutKey("meta+w", webview => removeSmallPane(webview.parentNode.id));
  }
  webViews[id] = webview;
  return webview;
}

/**
 * webViewのエレメントを元に、webViewインスタンスを取得する
 * TODO: main.jsがwebviewエレメントを直接参照しなくなるまでのつなぎ
 * @param {Element} webViewElement
 * @return {WebView}
 */
function convertToWebViewInstance(webViewElement) {
  const paneElm = webViewElement.parentNode;
  return paneElm ? webViews[paneElm.id] : undefined;
}

/**
 * ボード内の破棄されたペインをボードの定義から除外する
 */
function saveNewContents() {
  const contents = store.get(`boards.${currentBoardIndex}.contents`);
  let newContents = [];
  contents.forEach(function (content) {
    if (content !== null) newContents.push(content);
  });
  store.set(`boards.${currentBoardIndex}.contents`, newContents);
}

/**
 * Storeから取得したボードオブジェクトを元に描画用のボードオブジェクトを生成する
 * @param {Object} board ボードオブジェクト
 */
function buildJsonObjectFromStoredData(board) {
  let newContents = [];
  if (board === undefined) ipcRenderer.send("initial-open");
  board["contents"].forEach(function (content) {
    if (content !== null) newContents.push(content);
  });
  store.set(`boards.${currentBoardIndex}.contents`, newContents);
  let jsonObj = {
    name: board["name"],
    contents: newContents
  };

  return jsonObj;
}

/**
 * ペインの数に応じてグリッドレイアウトを再設定する
 */
function resetWindowSize() {
  const smallNum = document.getElementsByClassName("small").length;
  const main = document.getElementById("main-content");
  ratio =
    `${configWidth}% 0% ` + `${(100 - configWidth) / smallNum}% 0% `.repeat(smallNum);
  columns = `grid-template-columns: ${ratio} !important ;`;
  rows = `grid-template-rows: ${configHeight}% 0% ${100 - configHeight}% !important ;`;
  main.style = columns + rows;
  draggingBoarder.id = "";
}

/**
 * ボードの状態に応じてグリッドレイアウトの調整と設定値の更新を行う
 * @param {boolean} init 初回描画時であるか
 */
function calcWindowSize(init = false) {
  const smallNum = document.getElementsByClassName("small").length;
  const main = document.getElementById("main-content");
  const largeWidth = $(".large")[0].clientWidth;
  configWidth = (largeWidth / mainContentSize.width) * 100;
  if ($(".medium")[0] !== undefined) {
    var mediumHheight = $(".medium")[0].clientHeight;
    configHeight = (mediumHheight / mainContentSize.height) * 100;
  }
  let columns = "";
  let rows = "";
  if (draggingBoarder.id !== undefined && draggingBoarder.id !== "") {
    nextNum =
      draggingBoarder.id === "0"
        ? Number(draggingBoarder.id) + 2
        : Number(draggingBoarder.id) + 1;
    const target = document.getElementById(`${draggingBoarder.id}`);
    const next = document.getElementById(`${nextNum}`);
    let arColumns = main.style["grid-template-columns"].split(" ");
    var newSmallWidth = (target.clientWidth / mainContentSize.width) * 100;
    var nextWidth = Math.abs((next.clientWidth / mainContentSize.width) * 100);
    // Largeペインだけ特別扱い（統合したい…）
    if (draggingBoarder.id === "0") {
      arColumns[0] = `${newSmallWidth}% `;
      arColumns[2] = `${nextWidth}% `;
    } else {
      arColumns[Number(draggingBoarder.id) * 2 - 2] = `${newSmallWidth}% `;
      arColumns[Number(draggingBoarder.id) * 2] = `${nextWidth}% `;
    }
    ratio = arColumns.join(" ");
  } else {
    // リセット時の処理なので等分するだけ
    ratio =
      `${configWidth}% 0% ` + `${(100 - configWidth) / smallNum}% 0% `.repeat(smallNum);
  }
  columns = `grid-template-columns: ${ratio} !important ;`;
  rows = `grid-template-rows: ${configHeight}% 0% ${100 - configHeight}% !important ;`;
  if (init && allWidth !== undefined) columns = allWidth;
  main.style = columns + rows;
  refreshButtons();
  const panes = Array.from(document.getElementsByClassName("small"));
  panes.forEach(function (pane) {
    pane.style.width = "100%";
    pane.style.height = "100%";
  });
  if (configHeight !== undefined) {
    store.set(`boards.${currentBoardIndex}.contents.0.width`, configWidth);
    store.set(`boards.${currentBoardIndex}.contents.0.allWidth`, columns);
    store.set(`boards.${currentBoardIndex}.contents.1.height`, configHeight);
  }

  // 各ペインの検索ボックスもリサイズ
  $(".search-box").each((_, searchBoxElm) => adjustSearchBox($(searchBoxElm)));
}

/**
 *
 * @param {JQuery<HTMLElement>} $searchBox
 */
function adjustSearchBox($searchBox) {
  $searchBox.css({ width: $searchBox.parent().width() - 50, "margin-left": 25 });
}
