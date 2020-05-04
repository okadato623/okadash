const Content = require("./content");

/**
 * ウィンドウに表示するボード
 */
class Board {
  /**
   * @param {Object} params
   * @param {string} params.name
   * @param {[Content]} params.contents
   */
  constructor({ name, contents = [] }) {
    this.name = name;
    this.contents = contents;
  }
}
module.exports = Board;
