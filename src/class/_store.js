const Store = require("electron-store");

class _Store {
  constructor() {
    // TODO: StoreのSchema定義ちゃんとやる
    this.store = new Store();
  }

  isEmpty() {
    return this.store.size === 0;
  }
}

module.exports = new _Store();
