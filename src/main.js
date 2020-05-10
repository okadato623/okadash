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

const Content = require("./models/content");

/**
 * このウィンドウが表示しているボードのインデックス
 */
let currentBoardIndex = 0;

/**
 * アプリケーションのバージョン情報
 */
const VERSION = "1.7.0";

/**
 * アプリケーションの設定
 */
const Setting = require("./setting");
const setting = new Setting(VERSION);

/**
 * ボード全体のサイズ
 */
const mainContentSize = {
  width: document.getElementById("main-content").clientWidth,
  height: document.getElementById("main-content").clientHeight
};

// TODO: 仕様整理してグローバル変数やめる
let sizeInfo;
if (setting.validate()) {
  sizeInfo = getCurrentBoard().getSizeInfo();
  console.log(sizeInfo);
}

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

/**
 * 初期化
 */
initialize();

/**
 * 現在フォーカス中ボードのインデックスを取得する
 */
function boardNameToIndex() {
  const currentBoardName = remote.getCurrentWindow().boardName;
  if (currentBoardName) {
    const index = setting.findUsingBoardIndex(currentBoardName);
    return index === -1 ? 0 : index; // 存在しないボードを参照したときには 0 番目を返す
  } else {
    return 0;
  }
}

/**
 * 現在フォーカス中ボードを取得する
 */
function getCurrentBoard() {
  const index = boardNameToIndex();
  return setting.usingBoardList[index];
}

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
  if (!setting.validate()) {
    ipcRenderer.send("initial-open");
    return;
  }
  getLatestVersion();

  remote.getCurrentWindow().on("focus", () => {
    initializeMenu(menu.menuTemplate);
  });
  initializeMenu(menu.menuTemplate);

  // 使用中のボードをStoreから参照し、ペインの初期描画を行う
  const contents = getCurrentBoard().contents;
  contents.forEach(content => createPane(content, true));

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
  request.open("GET", "https://api.github.com/repos/konoyono/okadash/releases/latest");
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
  const contents = setting.definedBoardList[currentBoardIndex].contents;
  return createContextMenuItems(contents, index);
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
  const contents = setting.definedBoardList[currentBoardIndex].contents;
  const additionalPaneMenuItems = createAdditionalPaneMenuItems(contents);

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
  const usingBoardObject = getCurrentBoard().toObject();
  delete usingBoardObject.name;

  // jsonにしたものをファイルに吐き出す
  // allWidthとかとってこれる？
  const win = remote.getCurrentWindow();
  dialog
    .showSaveDialog(win, {
      properties: ["openFile"],
      filters: [
        {
          name: "Documents",
          extensions: ["json"]
        }
      ]
    })
    .then(result => {
      const fileName = result.filePath;
      if (fileName) {
        const data = JSON.stringify(usingBoardObject, null, 2);
        writeFile(fileName, data);
      }
    });
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
  return setting.definedBoardList.map((definedBoard, index) => {
    return new MenuItem({
      index,
      label: definedBoard.name,
      accelerator: `CommandOrControl+Option+${index}`,
      click() {
        openNewWindow(index);
      }
    });
  });
}

/**
 * 選択したボードを使用中ボードに切り替える
 * @param {number} index 選択されたボードのインデックス
 */
function openNewWindow(index) {
  const boardName = setting.definedBoardList[index].name;
  ipcRenderer.send("subwindow-open", boardName);
}

/**
 * ボード内のアイテムリスト情報を元に、ペイン追加用のメニューアイテムを生成する
 * @param {[Content]} contents
 */
function createAdditionalPaneMenuItems(contents) {
  return contents.map((content, index) => {
    return new MenuItem({
      label: content.name,
      accelerator: `CommandOrControl+${index + 1}`,
      click() {
        loadAdditionalPage(content);
      }
    });
  });
}

/**
 * アイテムリストを元に、ペイン再生性用のメニューアイテムを作成する
 * @param {[Content]}  contents
 * @param {string} index 対象ペイン要素のID
 */
function createContextMenuItems(contents, index) {
  const contextMenuItems = contents.map(function (content) {
    return new MenuItem({
      label: content.name,
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
      openNewPaneFromUrlDialog(index);
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
      const newContent = new Content({
        name: dlg.querySelector(".name").value,
        url: dlg.querySelector(".url").value,
        zoom: 1,
        customCSS: []
      });

      if (index !== null) {
        recreateSelectedPane(index, newContent);
      } else {
        loadAdditionalPage(newContent);
      }
    } else {
      dlg.close();
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
function replacePaneFromUrlDialog(event) {
  const { url, id } = event.detail;
  const dlg = document.querySelector("#create-new-pane-dialog");

  const index = getWebviews().findIndex(webView => {
    return webView.id === id;
  });
  const content = getCurrentBoard().contents[index];
  dlg.querySelector(".url").value = url;
  dlg.querySelector(".name").value = content.name;

  openNewPaneFromUrlDialog(index);
}
window.addEventListener("openReplaceUrlDialog", replacePaneFromUrlDialog);

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

  getCurrentBoard().removeContent(index);
  setting.saveAllSettings();

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
  const fromPane = document.getElementById(fromIndex);
  const toPane = document.getElementById(toIndex);

  // 両ペインの定義済み設定を交換
  getCurrentBoard().swapContent(fromIndex, toIndex);
  setting.saveAllSettings();

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
  const webview = createWebView(div.id, new Content({ url }), true);
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
 * URL変更ダイアログを開く
 * @param {Element} webview
 */
function openUrlChangeDialog(webview) {
  const url = webview.getURL();
  const ev = new CustomEvent("openReplaceUrlDialog", {
    detail: { url, id: webview.id }
  });
  window.dispatchEvent(ev);
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
 * @param {Content} content
 */
function loadAdditionalPage(content) {
  resetWindowSize();
  content.size = "small";

  getCurrentBoard().addContent(content);
  setting.saveAllSettings();
  createPane(content);

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
 * @param {Content} content
 */
function recreateSelectedPane(index, content) {
  const div = document.getElementById(`${index}`);
  const webViewElm = div.querySelector("webview");
  convertToWebViewInstance(webViewElm).dispose();

  getCurrentBoard().replaceContent(index, content);
  setting.saveAllSettings();

  const webview = createWebView(div.id, content);
  div.appendChild(webview.element);
  addSearchbox(webview);
}

/**
 * 新規ペインを描画する
 * @param {Content}  content
 * @param {boolean}  init  初期描画による作成であるか
 */
function createPane(content, init = false) {
  let divContainer = createContainerDiv(content.size);
  let divButtons = createButtonDiv();

  document.getElementById("main-content").appendChild(divContainer);
  divContainer.appendChild(divButtons);
  const forSmallPane = content.size === "small";
  const webview = createWebView(divContainer.id, content);
  divContainer.appendChild(webview.element);

  createDraggableBar(content.size);
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
 * Webviewオブジェクトを生成する
 * @param {string}   id オブジェクトに紐付けるユニークな文字列
 * @param {Content}  content
 * @param {Boolean}  forOverlay オーバレイ用途であるか
 */
function createWebView(id, content, forOverlay = false) {
  const webview = new WebView(content);
  webview.addShortcutKey("meta+l", openUrlChangeDialog);
  if (forOverlay) {
    webview.addShortcutKey("Escape", _ => removeOverlay());
    webview.addShortcutKey("meta+w", _ => removeOverlay());
  } else if (content.size === "small") {
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
    `${sizeInfo.configWidth}% 0% ` +
    `${(100 - sizeInfo.configWidth) / smallNum}% 0% `.repeat(smallNum);
  columns = `grid-template-columns: ${ratio} !important;`;
  rows = `
    grid-template-rows: ${sizeInfo.configHeight}%
    0%
    ${100 - sizeInfo.configHeight}%
    !important;
  `;
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
  sizeInfo.configWidth = (largeWidth / mainContentSize.width) * 100;
  if ($(".medium")[0] !== undefined) {
    var mediumHheight = $(".medium")[0].clientHeight;
    sizeInfo.configHeight = (mediumHheight / mainContentSize.height) * 100;
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
      `${sizeInfo.configWidth}% 0% ` +
      `${(100 - sizeInfo.configWidth) / smallNum}% 0% `.repeat(smallNum);
  }
  columns = `grid-template-columns: ${ratio} !important;`;
  rows = `
    grid-template-rows: ${sizeInfo.configHeight}%
    0%
    ${100 - sizeInfo.configHeight}%
    !important;
  `;
  if (init && sizeInfo.allWidth !== undefined) columns = sizeInfo.allWidth;
  main.style = columns + rows;
  refreshButtons();
  const panes = Array.from(document.getElementsByClassName("small"));
  panes.forEach(function (pane) {
    pane.style.width = "100%";
    pane.style.height = "100%";
  });
  if (sizeInfo.configHeight !== undefined) {
    getCurrentBoard().updateSizeInfo(
      columns,
      sizeInfo.configWidth,
      sizeInfo.configHeight
    );
    setting.saveAllSettings();
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
