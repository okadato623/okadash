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
   * コンテンツの場所を入れ替える
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  swapContent(fromIndex, toIndex) {
    [this.contents[fromIndex], this.contents[toIndex]] = [
      this.contents[toIndex],
      this.contents[fromIndex]
    ];
  }

  /**
   * ボード全体のサイズ情報を取得する
   * TODO: この辺り謎なので整理したい
   */
  getSizeInfo() {
    if (this.contents.length > 1) {
      return {
        allWidth: this.contents[0].allWidth,
        configWidth: this.contents[0].width,
        configHeight: this.contents[1].height
      };
    } else {
      return { allWidth: "", configWidth: "", configHeight: "" };
    }
  }

  /**
   * ボード全体のサイズ情報を更新する
   * @param {string} allWidth
   * @param {string} width
   * @param {string} height
   */
  updateSizeInfo(allWidth, width, height) {
    this.contents[0].allWidth = allWidth;
    this.contents[0].width = width;
    this.contents[1].height = height;
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
