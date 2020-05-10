const Content = require("../models/content");

class ContentForm {
  /**
   *
   * @param {Content} content
   * @param {function(ContentForm):void} onClickDeleteButton
   */
  constructor(content, onClickDeleteButton = null) {
    this.id = Math.random();
    this.content = content;
    this.onClickDeleteButton = onClickDeleteButton;
    this.$element = this.createElement();
  }

  /**
   * Contentの内容に応じたフォームUIを生成する
   */
  createElement() {
    const ua = {
      default: "",
      iPhone13: "Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1",
      Pixel4: "Mozilla/5.0 (Linux; Android 10; Pixel 4 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.62 Mobile Safari/537.36"
    }

    const { name, url, zoom, customCSS, customUA } = this.content.toObject();
    const $element = $(`
      <div class="item-box">
        <p>
          Name
          <input value="${name}" type="textbox" class="name content-textbox" />
        </p>
        <p>
          URL
          <input value="${url}" type="url" class="url content-textbox" />
        </p>
        <p>
          Zoom
          <input value="${zoom}" type="textbox" class="zoom content-textbox" />
        </p>
        <p>
          Custom UserAgent
          <select class="customUA content-selectbox">
            <option ${customUA === "" ? "selected" : ""}>default</option>
            <option value="${ua.iPhone13}" ${customUA === ua.iPhone13 ? "selected": ""}
            >iPhone iOS13</option>
            <option value="${ua.Pixel4}" ${customUA === ua.Pixel4 ? "selected" : ""}
            >Pixel4 Android10</option>
          </select>
        </p>
        <p>
          Custom CSS
          <textarea class="custom-css textarea-ccss">${customCSS.join("\n")}</textarea>
        </p>
        <button class="btn btn-outline-danger">${this.removeButtonLabel()}</button>
        <hr style="margin: 30px" />
      </div>
    `);

    $element.children("button").click(() => this.onClickDeleteButton(this));
    $element.find("input,textarea").on("blur", () => this.syncToContent());
    $element.find("select").on("change", () => this.syncToContent())
    return $element;
  }

  /**
   * フォームの内容をバリデーションする
   * @return {[string]} エラーメッセージ一覧
   */
  validate() {
    const errors = [];
    this.$element.find("input,textarea").css("backgroundColor", "#fff");

    const validationResult = {
      name: this.content.validateName(),
      url: this.content.validateUrl(),
      zoom: this.content.validateZoom()
    };

    if (validationResult.name !== true) {
      this.$element.find("input.name").css("backgroundColor", "#fdd");
      errors.push(validationResult.name);
    }
    if (validationResult.url !== true) {
      this.$element.find("input.url").css("backgroundColor", "#fdd");
      errors.push(validationResult.url);
    }
    if (validationResult.zoom !== true) {
      this.$element.find("input.zoom").css("backgroundColor", "#fdd");
      errors.push(validationResult.zoom);
    }

    return errors;
  }

  /**
   * フォームの入力内容をContentモデルに同期する
   */
  syncToContent() {
    this.content.name = this.$element.find("input.name").val();
    this.content.url = this.$element.find("input.url").val();
    this.content.zoom = this.$element.find("input.zoom").val();
    this.content.customUA = this.$element.find("select.customUA").val();
    this.content.customCSS = this.$element.find("textarea.custom-css").val().split("\n");
  }

  /**
   * Contentモデルのうち、このフォームで扱ってる要素のみのオブジェクトを戻す
   * @params {object} options マージするオブジェクト
   */
  toObject(options = {}) {
    const { name, url, zoom, customCSS ,customUA} = this.content.toObject();
    return { name, url, zoom, customCSS, customUA, ...options };
  }

  /**
   * 削除ボタン用のラベルを取得する
   */
  removeButtonLabel() {
    if (this.content.name) {
      return `Delete item [ ${this.content.name} ]`;
    } else {
      return "Delete this item";
    }
  }
}

module.exports = ContentForm;
