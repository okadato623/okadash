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
}

module.exports = WebView;

/**
 * Webview要素を生成する
 * @param {string} url
 */
function createWebViewElement(url) {
  const element = document.createElement("webview");
  element.src = "about:blank";
  element.id = "normal";
  element.url = url;
  element.addEventListener("new-window", event => openExternal(event.url));
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
