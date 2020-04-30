const ContextMenu = require("electron-context-menu");
const ElectronSearchText = require("electron-search-text");

/**
 * webview要素のラッパークラス
 * Web画面の設定、管理、操作を行う
 * このクラスはWebview要素自身以外(e.g.親要素)には一切関心を持たない
 */
class WebView {
  /**
   * オブジェクト生成時に完成したWebViewを生成する
   * @param {Object}   params
   * @param {string}   params.url
   * @param {number}   params.zoom
   * @param {[string]} params.customCSS
   */
  constructor({ url, zoom, customCSS }) {
    this.url = url || "";
    this.zoom = zoom || 1.0;
    this.customCSS = customCSS || [];
    this.element = createWebViewElement(url);
    this.shortcutKeyMap = {
      "meta+[": element => element.goBack(),
      "meta+]": element => element.goForward()
    };
    this.seacher = null;
    this.disposeContextMenu = null;

    this.initialize();
  }

  /**
   * Webview要素の初期設定を行う
   */
  initialize() {
    if (isValidURL(this.url)) this.element.src = this.url;
    this.element.autosize = "on";
    this.element.addEventListener("dom-ready", () => {
      this.apply();
      this.initializeContextMenu();
      this.element
        .getWebContents()
        .on("before-input-event", (_, e) => this.execShortcutKey(e));
    });
  }

  /**
   * プロパティの内容に応じてWebView要素の設定を更新する
   */
  apply() {
    this.element.insertCSS(this.customCSS.join(" "));
    this.element.setZoomFactor(Number(this.zoom) || 1.0);
    this.element.focus();
  }

  /**
   * ショートカットキーを実行する
   * @param {any} event キーボードイベント
   */
  execShortcutKey(event) {
    const keyLabel = `${event.meta ? "meta+" : ""}${event.key}`;
    const f = this.shortcutKeyMap[keyLabel];
    if (f) f(this.element);
  }

  /**
   * ショートカットキーを追加する
   * @param {string} label ショートカットキーを表す文字列(e.g."meta+w")
   * @param {function(Electron.WebviewTag)} callback
   */
  addShortcutKey(label, callback) {
    this.shortcutKeyMap[label] = callback;
  }

  /**
   * Webviewに検索機能を埋め込む
   * @param {Object} params
   * @param {string} inputSelector 検索ワード入力欄のセレクタ
   * @param {string} countSelector 検索マッチ数欄のセレクタ
   * @param {string} boxSelector   検索UIのラッパ要素のセレクタ
   * @param {string} visibleClass  検索UI表示時に適用するセレクタ
   */
  initializeTextSeacher({ inputSelector, countSelector, boxSelector, visibleSelector }) {
    this.seacher = new ElectronSearchText({
      target: `#${this.element.id}`,
      delay: 150,
      input: inputSelector,
      count: countSelector,
      box: boxSelector,
      visibleClass: visibleSelector
    });
    this.seacher.on("did-press-escape", () => this.element.focus());
    this.addShortcutKey("meta+f", () => {
      this.seacher.emit("show");
      this.seacher.findInPage();
    });
  }

  /**
   * Webviewに右クリックメニューを埋め込む
   */
  initializeContextMenu() {
    this.disposeContextMenu = ContextMenu({
      window: this.element,
      prepend: (_, params) => [
        {
          label: "Go Back",
          visible: this.element.canGoBack(),
          click: () => this.element.goBack()
        },
        {
          label: "Go Forward",
          visible: this.element.canGoForward(),
          click: () => this.element.goForward()
        },
        {
          type: "separator"
        },
        {
          label: "Open in external browser",
          visible: isValidURL(params.linkURL),
          click: () => {
            openExternal(params.linkURL);
          }
        }
      ]
    });
  }

  /**
   * WebViewを安全に破棄する
   * 生成したWebviewElementを破棄する際は必ずこのメソッドを通すこと
   */
  dispose() {
    if (this.disposeContextMenu) {
      this.disposeContextMenu();
    }
    this.element.remove();
  }
}

module.exports = WebView;

/**
 * Webview要素を生成する
 * @param {string} url
 */
function createWebViewElement(url) {
  const element = document.createElement("webview");
  element.src = "about:blank";
  element.id = `webview-${Math.random().toString(32).substring(2)}`;
  element.url = url;
  element.addEventListener("new-window", event => openExternal(event.url));
  element.style.height = "100%";
  return element;
}

/**
 * アプリケーションの外側でURLを開く
 * @param {string} url
 */
function openExternal(url) {
  if (isValidURL(url)) shell.openExternal(url);
}

/**
 * 正当なURLであるかを評価する
 * @param {string} url
 */
function isValidURL(url) {
  const protocol = require("url").parse(url).protocol;
  return protocol === "http:" || protocol === "https:" || protocol === "file:";
}
