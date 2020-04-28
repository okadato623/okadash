const Content = require("../models/content");

class ContentForm {
  /**
   * @param {Content} content
   */

  /**
   *
   * @param {Content} content
   * @param {function(Element):void} onClickDeleteButton
   */
  constructor(content, onClickDeleteButton = null) {
    this.content = content;
    this.onClickDeleteButton = onClickDeleteButton;
    this.element = this.createElement()[0];
  }

  createElement() {
    const $element = $(`
      <div class="item-box">
        <p>
          Name
          <input value="${this.content.name}" type="textbox" class="content-textbox" />
        </p>
        <p>
          URL
          <input value="${this.content.url}" type="url" class="content-textbox" />
        </p>
        <p>
          Zoom
          <input value="${this.content.zoom}" type="textbox" class="content-textbox" />
        </p>
        <p>
          Custom CSS
          <textarea class="textarea-ccss">${this.content.customCSS.join("\n")}</textarea>
        </p>
        <button class="btn btn-outline-danger">${this.removeButtonLabel()}</button>
        <hr style="margin: 30px" />
      </div>
    `);
    $element.children("button").click(() => this.onClickDeleteButton(this.element));
    return $element;
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
