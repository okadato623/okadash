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
   * ボード内のコンテントを新しいコンテントで置き換える
   * @param {number} index
   * @param {Content} newContent
   */
  replaceContent(index, newContent) {
    Content.configuableFields.forEach(key => {
      this.contents[index][key] = newContent[key];
    });
  }

  /**
   * ボード内のコンテンツを削除する
   * @param {number} index
   */
  removeContent(index) {
    this.contents.splice(index, 1);
  }

  /**
   * コンテンツの内容を入れ替える
   * NOTE: 内容のみ入れ替えるのでオブジェクトごとの交換でなく入れ替え可能属性のみ交換する
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  swapContent(fromIndex, toIndex) {
    const from = this.contents[fromIndex];
    const to = this.contents[toIndex];

    Content.configuableFields.forEach(key => {
      [from[key], to[key]] = [to[key], from[key]];
    });
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
