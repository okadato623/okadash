var { remote } = require("electron");
const fs = require("fs");
const app = remote.app;

readFile();

function readFile() {
  fs.readFile(app.getPath("userData") + "/config.json", (error, data) => {
    if (error != null) {
      alert("file open error.");
      return;
    }

    createBoardList(data);
  });
}

function createBoardList(data) {
  const boards = JSON.parse(data);
  const container = document.getElementById("boards-container");
  for (i in boards["options"]) {
    const board = boards["options"][i];
    const liElem = document.createElement("li");
    const aElem = document.createElement("a");
    aElem.onclick = function() {
      showBoardContents(board);
    };
    aElem.innerHTML = board["name"];
    liElem.appendChild(aElem);
    container.appendChild(liElem);
  }
  container.firstChild.querySelector("a").click();
}

function showBoardContents(board) {
  document.getElementById("board-name-textbox").value = board["name"];
  const container = document.getElementById("items-container");
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  for (i in board["contents"]) {
    const content = board["contents"][i];

    const nameElem = document.createElement("p");
    const nameTextElem = document.createElement("input");
    nameElem.innerHTML = "Name";
    nameTextElem.type = "textbox";
    nameTextElem.className = "content-textbox";
    nameTextElem.value = content["name"];
    nameElem.appendChild(nameTextElem);

    const urlElem = document.createElement("p");
    const urlTextElem = document.createElement("input");
    urlElem.innerHTML = "URL";
    urlTextElem.type = "textbox";
    urlTextElem.className = "content-textbox";
    urlTextElem.value = content["url"];
    urlElem.appendChild(urlTextElem);

    const cssElem = document.createElement("p");
    const btnElem = document.createElement("button");
    cssElem.innerHTML = "Custom CSS";
    btnElem.className = "btn btn-outline-info";
    btnElem.style = "margin-left: 20px;";
    btnElem.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    cssElem.appendChild(btnElem);

    const hrElem = document.createElement("hr");
    hrElem.style = "margin: 30px;";

    container.appendChild(nameElem);
    container.appendChild(urlElem);
    container.appendChild(cssElem);
    container.appendChild(hrElem);
  }

  const addBtnElem = document.createElement("button");
  addBtnElem.className = "add-board-btn";
  addBtnElem.innerHTML = "+";
  container.appendChild(addBtnElem);
}

function save() {
  writeFile(data);
}

function writeFile(data) {
  fs.writeFile(app.getPath("userData") + "/config.json", data, error => {
    if (error != null) {
      alert("save error.");
      return;
    }
  });
  console.log(data);
}
