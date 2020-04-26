/**
 * ボード内の各ペインに表示する、okadashの構成要素の最小単位
 */
class Content {
  /**
   * @param {object} params
   */
  constructor(params = {}) {
    this.name = params.name || "";
    this.url = params.url || "";
    this.zoom = params.zoom || 1.0;
    this.size = params.size || "small";
    this.width = params.width || undefined;
    this.height = params.height || undefined;
    this.customCSS = params.customCSS || [];
  }

  /**
   * Name属性が保存可能な内容であるかチェックする
   * @throws バリデーション違反の場合
   */
  validateName() {
    if (this.name === "") throw "Item Name Needed";
    if (/\"/.test(this.name)) throw `Cannot use " in Item (${this.name})`;
    return true;
  }

  /**
   * URL属性が保存可能な内容であるかチェックする
   * @throws バリデーション違反の場合
   */
  validateUrl() {
    const re = /^(https?|file)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)$/;
    if (this.url == "") throw "URL is Needed";
    if (!this.url.match(re)) throw `Invalid URL: (${this.url})`;
    if (/\"/.test(this.url)) throw `Cannot use " in Item (${url})`;
    return true;
  }

  /**
   * Zoom属性が保存可能な内容であるかチェックする
   * @throws バリデーション違反の場合
   */
  validateZoom() {
    const zoomNum = Number(this.zoom);
    if (this.zoom == "") throw "Zoom is Needed";
    if (isNaN(zoomNum) || zoomNum < 0.25 || zoomNum > 5.0) {
      throw "Zoom must be a number between 0.25 and 5.0";
    }
    return true;
  }

  /**
   * JSONに変換可能なオブジェクトを取得する
   */
  toObject() {
    return {
      name: this.name,
      url: this.url,
      zoom: this.zoom,
      size: this.size,
      width: this.width,
      height: this.height,
      customCSS: this.customCSS
    };
  }

  /**
   * JSON文字列にして戻す
   */
  toJSON() {
    return JSON.stringify(this.toObject());
  }
}
module.exports = Content;
