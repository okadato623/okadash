var { remote } = require("electron");
var { dialog } = remote;
const fs = require("fs");
const Store = require("electron-store");
const store = new Store();
const app = remote.app;

readFile();

function readFile() {
  fs.readFile(app.getPath("userData") + "/config.json", (error, data) => {
    if (error != null) {
      importNewBoard("./settings_sample.json", "Default Board", true);
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
      showBoardContents(board, aElem);
    };
    aElem.innerHTML = board["name"];
    liElem.appendChild(aElem);
    container.appendChild(liElem);
  }
  if (container.firstChild === null)
    importNewBoard("./settings_sample.json", "Default Board", true);
  container.firstChild.querySelector("a").click();
}

function showBoardContents(board, self) {
  const boardsContainer = document.getElementById("boards-container");
  boardsContainer.childNodes.forEach(function(node) {
    node.classList.remove("active");
  });
  self.parentElement.classList.add("active");
  window.scrollTo(0, 0);
  document.getElementById("board-name-textbox").innerText = board["name"];
  const container = document.getElementById("items-container");
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  for (i in board["contents"]) {
    const content = board["contents"][i];
    const divElem = document.createElement("div");
    divElem.className = "item-box";

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
    urlTextElem.type = "url";
    urlTextElem.className = "content-textbox";
    urlTextElem.value = content["url"];
    if (/workspace/.test(content["url"])) urlTextElem.style.background = "#fdd";
    urlElem.appendChild(urlTextElem);

    const cssElem = document.createElement("p");
    const tAreaElem = document.createElement("textarea");
    cssElem.innerHTML = "Custom CSS";
    tAreaElem.id = content["name"];
    tAreaElem.className = "textarea-ccss";
    tAreaElem.value = content["customCSS"].join("\n");
    cssElem.appendChild(tAreaElem);

    const btnElem = document.createElement("button");
    btnElem.className = "btn btn-outline-danger";
    btnElem.innerHTML = "Delete item [ " + content["name"] + " ]";
    btnElem.onclick = function() {
      if (!confirm("Sure?")) return;
      btnElem.parentElement.remove();
    };

    const hrElem = document.createElement("hr");
    hrElem.style = "margin: 30px;";

    divElem.appendChild(nameElem);
    divElem.appendChild(urlElem);
    divElem.appendChild(cssElem);
    divElem.appendChild(btnElem);
    divElem.appendChild(hrElem);

    container.appendChild(divElem);
  }

  const addBtnElem = document.createElement("button");
  addBtnElem.className = "add-board-btn";
  addBtnElem.innerHTML = "+";
  addBtnElem.onclick = function() {
    createNewItem(addBtnElem);
  };
  container.appendChild(addBtnElem);
}

function createNewItem(self) {
  self.remove();
  const container = document.getElementById("items-container");
  const divElem = document.createElement("div");
  divElem.className = "item-box";

  const nameElem = document.createElement("p");
  const nameTextElem = document.createElement("input");
  nameElem.innerHTML = "Name";
  nameTextElem.type = "textbox";
  nameTextElem.className = "content-textbox";
  nameElem.appendChild(nameTextElem);

  const urlElem = document.createElement("p");
  const urlTextElem = document.createElement("input");
  urlElem.innerHTML = "URL";
  urlTextElem.type = "textbox";
  urlTextElem.className = "content-textbox";
  urlElem.appendChild(urlTextElem);

  const cssElem = document.createElement("p");
  const tAreaElem = document.createElement("textarea");
  cssElem.innerHTML = "Custom CSS";
  tAreaElem.className = "textarea-ccss";
  cssElem.appendChild(tAreaElem);

  const btnElem = document.createElement("button");
  btnElem.className = "btn btn-outline-danger";
  btnElem.innerHTML = "Delete this item";
  btnElem.onclick = function() {
    btnElem.parentElement.remove();
  };

  const hrElem = document.createElement("hr");
  hrElem.style = "margin: 30px;";

  divElem.appendChild(nameElem);
  divElem.appendChild(urlElem);
  divElem.appendChild(cssElem);
  divElem.appendChild(btnElem);
  divElem.appendChild(hrElem);

  container.appendChild(divElem);
  container.appendChild(self);
}

function writeAppConfigFile(data) {
  fs.writeFile(app.getPath("userData") + "/config.json", data, error => {
    if (error != null) {
      alert("save error.");
      return;
    }
  });
  console.log(data);
}

function openFileAndSave() {
  const win = remote.getCurrentWindow();
  remote.dialog.showOpenDialog(
    win,
    {
      properties: ["openFile"],
      filters: [
        {
          name: "settings",
          extensions: ["json"]
        }
      ]
    },
    filePath => {
      if (filePath) {
        showModalDialogElement(filePath[0]);
      }
    }
  );
}

function showModalDialogElement(filePath) {
  return new Promise((resolve, reject) => {
    const dlg = document.querySelector("#input-dialog");
    dlg.style.display = "block";
    dlg.addEventListener("cancel", event => {
      event.preventDefault();
    });
    dlg.showModal();
    function onClose() {
      if (dlg.returnValue === "ok") {
        const inputValue = document.querySelector("#input").value;
        if (checkDuplicateNameExists(inputValue)) {
          alert(`Board name '${inputValue}' is already in use`);
          remote.getCurrentWindow().reload();
        } else {
          resolve(importNewBoard(filePath, inputValue));
        }
      } else {
        reject();
        remote.getCurrentWindow().reload();
      }
    }
    dlg.addEventListener("close", onClose, { once: true });
  });
}

function importNewBoard(jsonPath, boardName, init = false) {
  const settings = JSON.parse(fs.readFileSync(jsonPath));
  if (!validateJson(settings)) {
    return null;
  }

  const newOption = { name: boardName, contents: settings["contents"] };
  let optList = store.get("options");
  let brdList = store.get("boards");
  if (optList) {
    optList.push(newOption);
    brdList.push(newOption);
    store.set(`options`, optList);
    store.set(`boards`, brdList);
  } else {
    store.set(`options`, [newOption]);
    store.set(`boards`, [newOption]);
  }
  remote.getCurrentWindow().reload();
}

function checkDuplicateNameExists(boardName) {
  var found = false;
  const container = document.getElementById("boards-container");
  container.childNodes.forEach(function(node) {
    if (boardName == node.querySelector("a").innerText) found = true;
  });

  return found;
}

function getBoardNum() {
  if (store.get("options") !== undefined) {
    return Object.keys(store.get("options")).length;
  }
  return undefined;
}

function validateJson(jsonObj) {
  if (!jsonObj.contents) {
    alert("Error in settings: contents is invalid");
    return false;
  }
  jsonObj.contents.forEach(function(content) {
    if (content["customCSS"] === undefined) content["customCSS"] = [];
  });

  return true;
}

function getSelectingBoard() {
  var res = "";
  document
    .getElementById("boards-container")
    .childNodes.forEach(function(node) {
      if (node.classList.contains("active")) {
        res = node.querySelector("a").innerText;
      }
    });
  return res;
}

function deleteBoard() {
  const targetBoard = getSelectingBoard();
  const allBoards = store.get("boards");
  const allOptions = store.get("options");
  if (
    !confirm(
      `Delete board name '${
        document.getElementById("board-name-textbox").innerText
      }'. OK?`
    )
  )
    return;

  for (i in allOptions) {
    if (targetBoard == allOptions[i]["name"]) {
      allOptions.splice(i, 1);
      allBoards.splice(i, 1);
    }
  }
  store.set("options", allOptions);
  store.set("boards", allBoards);
  remote.getCurrentWindow().reload();
}

function exportBoard(asIs = false) {
  const targetBoard = document.getElementById("board-name-textbox").innerText;
  let usingBoard = "";
  if (asIs) {
    for (i in store.get("boards")) {
      if (store.get("boards")[i]["name"] == targetBoard) {
        usingBoard = store.get("boards")[i];
      }
    }
  } else {
    for (i in store.get("options")) {
      if (store.get("options")[i]["name"] == targetBoard) {
        usingBoard = store.get("options")[i];
      }
    }
  }
  delete usingBoard.name;
  const win = remote.getCurrentWindow();
  dialog.showSaveDialog(
    win,
    {
      defaultPath: document.getElementById("board-name-textbox").innerText,
      properties: ["openFile"],
      filters: [
        {
          name: "Documents",
          extensions: ["json"]
        }
      ]
    },
    fileName => {
      if (fileName) {
        const data = JSON.stringify(usingBoard, null, 2);
        writeFile(fileName, data);
      }
    }
  );
}

function writeFile(path, data) {
  fs.writeFile(path, data, error => {
    if (error != null) {
      alert("save error.");
      return;
    }
  });
}

function saveBoardSetting() {
  const targetBoard = document.getElementById("board-name-textbox").innerText;
  const container = document.getElementById("items-container");
  const items = [];
  let error = false;
  container.querySelectorAll(".item-box").forEach(function(node) {
    let item = {};
    node.querySelectorAll("p").forEach(function(elem) {
      switch (elem.innerText) {
        case "Name":
          item.name = elem.querySelector("input").value;
          if (items.length === 0) {
            item.size = "large";
          } else if (items.length === 1) {
            item.size = "medium";
          }
          if (
            !isValidName(
              elem.querySelector("input").value,
              elem.querySelector("input")
            )
          )
            error = true;
          break;
        case "URL":
          item.url = elem.querySelector("input").value;
          if (
            !isValidURL(
              elem.querySelector("input").value,
              elem.querySelector("input")
            )
          )
            error = true;
          break;
        case "Custom CSS":
          item.customCSS = elem.querySelector("textarea").value.split("\n");
          items.push(item);
          break;
      }
    });
  });

  if (!error) {
    let options = store.get("options");
    for (i in options) {
      if (targetBoard == options[i]["name"]) {
        options[i]["contents"] = items;
        break;
      }
    }
    store.set("options", options);
    store.set("boards", options);
    document.getElementById("save-btn").innerText = "Saved!";
    const reloadMessage = function() {
      document.getElementById("save-btn").innerText = "Save Board Setting";
    };
    setTimeout(reloadMessage, 2000);
  } else {
    document.getElementById("save-btn").innerText = "Save failed...";
    document.getElementById("save-btn").className = "btn btn-danger";
    const reloadMessage = function() {
      document.getElementById("save-btn").innerText = "Save Board Setting";
      document.getElementById("save-btn").className = "btn btn-primary";
    };
    setTimeout(reloadMessage, 2000);
  }
}

function isValidName(name, elem) {
  if (name == "") {
    alert("Item Name Needed");
    elem.style.background = "#fdd";
    return false;
  }
  if (/\"/.test(name)) {
    alert(`Cannot use " in Item (${name})`);
    elem.style.background = "#fdd";
    return false;
  }
  elem.style.background = "#fff";
  return true;
}

function isValidURL(url, elem) {
  if (url == "") {
    alert("URL is Needed");
    elem.style.background = "#fdd";
    return false;
  }
  if (
    !url.match(/^(https?|file)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)$/)
  ) {
    alert(`Invalid URL: (${url})`);
    elem.style.background = "#fdd";
    return false;
  }
  if (/\"/.test(url)) {
    alert(`Cannot use " in Item (${url})`);
    elem.style.background = "#fdd";
    return false;
  }
  elem.style.background = "#fff";
  return true;
}
