const ElectronStore = require("electron-store");
const Board = require("./models/board");
const Content = require("./models/content");
const electronStore = new ElectronStore();

/**
 * ElectronStoreで永続化した設定ファイルの読み書きを行う
 * 原則として全てのコードでsingletonを利用し、設定ファイルを直接操作しない
 * TODO: allWidthをどう扱うのか
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

  /**
   * オブジェクトが持っている最新の設定情報を元に永続化
   */
  saveAllSettings() {
    electronStore.set({
      version: this.version,
      boards: this.usingBoardList.map(board => board.toObject()),
      options: this.definedBoardList.map(board => board.toObject())
    });
  }

  /**
   * 定義済みボードの内容で使用中ボードを更新する
   */
  syncDefinedBoardToUsingBoard() {
    this.usingBoardList = this.definedBoardList.map(board => {
      return new Board({
        name: board["name"],
        contents: board["contents"].map(content => new Content(content))
      });
    });
  }

  /**
   * 設定ファイルを元に新規ボードを追加
   * @param {string} name
   * @param {[object]} contents
   */
  addBoardFromObject(name, contents) {
    const newBoard = new Board({ name, contents: contents.map(c => new Content(c)) });
    this.definedBoardList.push(newBoard);
    this.usingBoardList.push(newBoard);
  }

  /**
   * ボード名を指定してボードを削除する
   * このメソッドは定義済みボードを探索し、使用中ボードもまとめて削除する
   * @param {string} name
   * @return {boolean} ボードが見つからない場合 false
   */
  deleteBoard(name) {
    const index = this.definedBoardList.findIndex(board => board.name === name);
    if (index === -1) return false;

    this.definedBoardList.splice(index, 1);
    this.usingBoardList.splice(index, 1);
    this.saveAllSettings();
    return true;
  }

  /**
   * ボード名を元に定義済みボードを取得する
   * @param {string} name
   */
  findDefinedBoard(name) {
    return this.definedBoardList.find(board => board.name === name);
  }

  /**
   * ボード名を元に使用中ボードを取得する
   * @param {string} name
   */
  findUsingBoard(name) {
    return this.usingBoardList.find(board => board.name === name);
  }
}

module.exports = Store;
