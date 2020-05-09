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

  /**
   * ボードにコンテンツを追加する
   * @param {Content} content
   */
  addContent(content = new Content()) {
    this.contents.push(content);
    return content;
  }

  /**
   * ボード内のコンテンツを削除する
   * @param {number} index
   */
  removeContent(index) {
    this.contents.splice(index, 1);
  }

  /**
   * オブジェクトを生成する
   */
  toObject() {
    return {
      name: this.name,
      contents: this.contents.map(content => content.toObject())
    };
  }
}
module.exports = Board;
