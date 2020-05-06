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

  toObject() {
    return {
      name: this.name,
      contents: this.contents.map(content => content.toObject())
    };
  }
}
module.exports = Board;
