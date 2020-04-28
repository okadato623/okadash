const Content = require("../models/content");

class ContentForm {
  /**
   * @param {Content} content
   */

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

  createElement() {
    const { name, url, zoom, customCSS } = this.content.toObject();
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
          Custom CSS
          <textarea class="custom-css textarea-ccss">${customCSS.join("\n")}</textarea>
        </p>
        <button class="btn btn-outline-danger">${this.removeButtonLabel()}</button>
        <hr style="margin: 30px" />
      </div>
    `);

    $element.children("button").click(() => this.onClickDeleteButton(this));
    $element.find("input,textarea").on("blur", () => this.syncToContent());
    return $element;
  }

  syncToContent() {
    this.content.name = this.$element.find("input.name").val();
    this.content.url = this.$element.find("input.url").val();
    this.content.zoom = this.$element.find("input.zoom").val();
    this.content.customCSS = this.$element.find("textarea.custom-css").val();
  }

  removeElement() {
    this.element.remove();
  }

  removeButtonLabel() {
    if (this.content.name) {
      return `Delete item [ ${this.content.name} ]`;
    } else {
      return "Delete this item";
    }
  }
}

module.exports = ContentForm;
