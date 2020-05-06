const ElectronStore = require("electron-store");
const electronStore = new ElectronStore();
const Board = require("./models/board");

/**
 * ElectronStoreで永続化した設定ファイルの読み書きを行う
 */
class Store {
  constructor() {
    this.loadDefinedBoards();
    console.log(this);
  }

  /**
   * ElectronStoreから最新の設定情報を読み込み、全ての設定値を更新する
   */
  loadAllSettings() {
    this.settings = electronStore.store;
    this.version = this.settings["version"];
    this.usingBoards = this.loadUsingBoards();
    this.definedBoards = this.loadDefinedBoards();
  }

  /**
   * 設定ファイルを元に使用中ボードの一覧を取得
   * @return {[Board]}
   */
  loadUsingBoards() {
    return this.settings["boards"].map(board => {
      return new Board({ name: board["name"], contents: board["contents"] });
    });
  }

  /**
   * 設定ファイルを元に定義済みボードの一覧を取得
   * @return {[Board]}
   */
  loadDefinedBoards() {
    return this.settings["options"].map(board => {
      return new Board({ name: board["name"], contents: board["contents"] });
    });
  }
}

module.exports = Store;
