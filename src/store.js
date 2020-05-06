const ElectronStore = require("electron-store");
const Board = require("./models/board");
const Content = require("./models/content");

/**
 * ElectronStoreで永続化した設定ファイルの読み書きを行う
 * 原則として全てのコードでsingletonを利用し、設定ファイルを直接操作しない
 */
class Store {
  static singleton = new Store();

  constructor() {
    this.loadAllSettings();
    console.log(this);
  }

  /**
   * ElectronStoreから最新の設定情報を読み込み、全ての設定値を更新する
   */
  loadAllSettings() {
    const electronStore = new ElectronStore();
    this.settings = electronStore.store;
    this.version = this.settings["version"];
    this.usingBoardList = this.loadUsingBoardList();
    this.definedBoardList = this.loadDefinedBoardList();
  }

  /**
   * 使用中ボード一覧を生成する
   * @return {[Board]}
   */
  loadUsingBoardList() {
    return this.loadBoardList("boards");
  }

  /**
   * 定義済みボードの一覧を生成する
   * @return {[Board]}
   */
  loadDefinedBoardList() {
    return this.loadBoardList("options");
  }

  /**
   * 設定ファイルの内容を元に、ボードの一覧を生成する
   * @param {string} key
   * @return {[Board]}
   */
  loadBoardList(key) {
    return this.settings[key].map(board => {
      return new Board({
        name: board["name"],
        contents: board["contents"].map(content => new Content(content))
      });
    });
  }
}

module.exports = Store;
