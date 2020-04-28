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
    return $element;
  }

  syncToContent() {
    this.content.name = this.$element.children("input.name").val();
    this.content.url = this.$element.children("input.url").val();
    this.content.zoom = this.$element.children("input.zoom").val();
    this.content.customCSS = this.$element.children("textarea.custom-css").text();
    console.log(this.content.name);
    console.log(this.content.toObject());
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
