/*
 *
 *   A-Periment - Custom minecraft launcher
 *   Copyright (C) 2020 Adam Charvát
 *
 *   A-Periment is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   A-Periment is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with a-periment. If not, see <https://www.gnu.org/licenses/>.
 *
 */

const uuid4 = require("uuid").v4;
const { ipcRenderer } = electron;

document.addEventListener("DOMContentLoaded", () => {

    ipcRenderer.send("app-version");

    let modpackSearchBar = document.getElementById("modpack-search-bar");
    document.getElementById("add-modpack-button").addEventListener("click", () => {

        if (modpackSearchBar.value != "") {
            ipcRenderer.send("add-modpack", modpackSearchBar.value);
        }

    });

    let modpackContainer = document.getElementById("modpack-container");
    let modpackContextMenu = document.getElementById("modpack-context-menu");
    document.addEventListener("click", () => {

        let item = modpackContainer.querySelector(".modpack-item[contextmenu=true]");
        if (item) {
            item.setAttribute("hover", false);
            item.setAttribute("contextmenu", false);
        }

        modpackContextMenu.classList.remove("active");

    });

    let modpackProperties = document.getElementById("modpack-properties");
    let modpackPropertiesTable = document.getElementById("modpack-properties-table");
    modpackProperties.show = function() {
        this.style.display = "block";
    }
    modpackProperties.hide = function() {
        this.style.display = "none";
    }
    modpackProperties.querySelector("svg").addEventListener("click", () => {
        modpackProperties.hide();
    });
    modpackProperties.querySelector(".modpack-properties-header").addEventListener("mousedown", (event) => {

        event.preventDefault();
        let element = event.currentTarget.parentElement;

        var internalWindowDrag = function(event) {

            event.preventDefault();

            let posY = element.offsetTop + event.movementY;
            let posX = element.offsetLeft + event.movementX;

            let rect1 = element.getBoundingClientRect();
            let rect2 = element.parentElement.getBoundingClientRect();

            if (posY >= 0) {

                let maxHeight = rect2.height - rect1.height;

                if (posY <= maxHeight) {
                    element.style.top = `${posY}px`;
                } else {
                    element.style.top = maxHeight;
                }

            } else {
                element.style.top = 0;
            }

            if (posX >= 0) {

                let maxWidth = rect2.width - rect1.width;

                if (posX <= maxWidth) {
                    element.style.left = `${posX}px`;
                } else {
                    element.style.left = maxWidth;
                }

            } else {
                element.style.left = 0;
            }

        };

        var stopInternalWindowDrag = function(event) {

            document.removeEventListener("mouseup", stopInternalWindowDrag);
            document.removeEventListener("mousemove", internalWindowDrag);

        };

        document.addEventListener("mouseup", stopInternalWindowDrag);
        document.addEventListener("mousemove", internalWindowDrag);

    });

    let lastWidth = window.innerWidth, lastHeight = window.innerHeight;
    window.addEventListener("resize", (event) => {

        let x = lastWidth - event.target.innerWidth;
        let y = lastHeight - event.target.innerHeight;
        let top = parseInt(modpackProperties.style.top);
        let left = parseInt(modpackProperties.style.left);

        lastWidth = event.target.innerWidth;
        lastHeight = event.target.innerHeight;

        let rect1 = modpackProperties.getBoundingClientRect();
        let rect2 = modpackProperties.parentElement.getBoundingClientRect();

        let maxWidth = rect2.width - rect1.width;
        let maxHeight = rect2.height - rect1.height;

        if (top >= maxHeight) {
            modpackProperties.style.top = `${top - y}px`;
        }

        if (left >= maxWidth) {
            modpackProperties.style.left = `${left - x}px`;
        }

    });

    Array.from(modpackPropertiesTable.querySelectorAll("input:not([readonly])")).forEach((element) => {

        let tr = (element.parentElement).parentElement;

        element.addEventListener("focusout", () => {

            let modpack = document.getElementById(tr.parentElement.getAttribute("modpack"));

            if (modpack.getAttribute("vma") != element.value) {

                ipcRenderer.send("save-modpacks", {
                    url: modpack.getAttribute("url"),
                    key: tr.getAttribute("key"),
                    value: element.value
                });

                modpack.setAttribute("vma", element.value);

            }

        });

    });

    [
        {
            "name": "Start",
            "action": function(modpack) {
                modpack.click();
            }
        },
        {
            "name": "Properties",
            "action": function(modpack) {

                Array.from(modpackPropertiesTable.children[0].children).forEach((element) => {

                    modpackPropertiesTable.children[0].setAttribute("modpack", modpack.getAttribute("id"));
                    element.children[1].children[0].value = modpack.getAttribute(element.getAttribute("key"));

                });

                modpackProperties.show();

            }
        }
    ].forEach((object) => {

        let item = document.createElement("div");
        item.classList.add("context-menu-item");
        item.textContent = object.name;
        item.onclick = () => {

            let modpack = modpackContainer.querySelector(".modpack-item[contextmenu=true]");
            
            if (modpack) {
                object.action(modpack);
            }

        };

        modpackContextMenu.appendChild(item);

    });

    document.getElementById("save-settings-button").addEventListener("click", () => {

        let settings = {};
        let settingsTable = document.getElementById("settings-table").querySelector("tbody");

        for (let i = 0; i < settingsTable.children.length; i++) {

            let setting = settingsTable.children[i];

            let key = setting.children[0].textContent;
            let value = setting.querySelector("input").value;

            switch (setting.getAttribute("data-type")) {
                case "number":
                    value = Number(value);
                    break;
                case "boolean":
                    value = (value === "true");
                    break;
            }

            settings[key] = value;

        }

        ipcRenderer.send("save-settings", settings);

    });

    document.getElementById("logout-button").addEventListener("click", () => {
        ipcRenderer.send("user-logout");
    });

    document.getElementById("menu-container").querySelectorAll(".menu-item").forEach((node) => {

        node.addEventListener("click", () => {

            if (!node.classList.contains("selected")) {

                let name = node.getAttribute("name");

                document.querySelector(".menu-item.selected").classList.remove("selected");
                document.querySelector(".menu-item[name=" + name + "]").classList.add("selected");

                document.querySelector(".page-item.visible").classList.remove("visible");
                document.querySelector(".page-item[name=" + name + "]").classList.add("visible");

            }

        });

    });
    
});

ipcRenderer.on("app-version", (event, version) => {

    let versionElement = document.getElementById("app-version");
    versionElement.textContent += version;

});

ipcRenderer.on("load-modpacks", (event, modpacks) => {

    let modpackContainer = document.getElementById("modpack-container");
    let modpackContextMenu = document.getElementById("modpack-context-menu");
    modpackContainer.innerHTML = "";

    for (let i = 0; i < modpacks.length; i++) {

        let modpack = modpacks[i];

        let item = document.createElement("div");
        item.setAttribute("id", uuid4().replace(/-/g, ""));
        item.setAttribute("name", modpack.name);
        item.setAttribute("creators", modpack.creators.join(", "));
        item.setAttribute("description", modpack.description);
        item.setAttribute("directory", modpack.name.trim().toLowerCase().replace(/ /g, "-"));
        item.setAttribute("url", modpack.url);
        item.setAttribute("vma", modpack.vma);
        item.setAttribute("hover", false);
        item.setAttribute("running", false);
        item.setAttribute("contextmenu", false);
        item.classList.add("modpack-item");
    
        let icon = document.createElement("img");
        icon.src = "../resources/images/skultech.png";
        item.appendChild(icon);

        let statusBar = document.createElement("div");
        statusBar.classList.add("status-bar");
        statusBar.appendChild(document.createElement("div")).classList.add("line", "progress");
        statusBar.appendChild(document.createElement("div")).classList.add("line", "infinite-increase");
        statusBar.appendChild(document.createElement("div")).classList.add("line", "infinite-decrease");
        statusBar.setMode = function(mode) {

            if (this.getAttribute("mode") === mode) return;
        
            switch (mode) {
    
                case "NONE":
                    this.style.display = "none";
                    this.children[0].style.display = "none";
                    this.children[1].style.display = "none";
                    this.children[2].style.display = "none";
                    break;
    
                case "PROGRESS":
                    this.style.display = "block";
                    this.children[0].style.display = "block";
                    this.children[1].style.display = "none";
                    this.children[2].style.display = "none";
                    break;
    
                case "INFINITE":
                    this.style.display = "block";
                    this.children[0].style.display = "none";
                    this.children[1].style.display = "block";
                    this.children[2].style.display = "block";
                    break;
    
                default:
                    return;
    
            }
    
            this.setAttribute("mode", mode);

        };
        statusBar.setValue = function(value) {
            this.children[0].style.width = `${value}%`;
        }
        statusBar.setMode("NONE");
        item.appendChild(statusBar);

        let statusCircle = document.createElement("div");
        statusCircle.classList.add("status-circle");
        statusCircle.setAttribute("state", "DEFAULT");
        item.appendChild(statusCircle);
    
        item.addEventListener("click", (event) => {

            let target = event.currentTarget;

            if (target.getAttribute("running") === "false") {
        
                target.querySelector(".status-bar").setMode("INFINITE");
                target.setAttribute("running", true);
    
                ipcRenderer.send("launch-modpack", {
                    id: target.getAttribute("id"),
                    vma: target.getAttribute("vma"),
                    url: target.getAttribute("url"),
                    directory: target.getAttribute("directory")
                });
    
            } else {
                ipcRenderer.send("terminate-modpack");
            }

        });

        item.addEventListener("mouseenter", () => {

            item.setAttribute("hover", true);

        });
        item.addEventListener("mouseleave", () => {

            if (item.getAttribute("contextmenu") === "false") {

                item.setAttribute("hover", false);

            }

        });

        item.addEventListener("contextmenu", (event) => {

            event.preventDefault();

            let last = modpackContainer.querySelector(".modpack-item[contextmenu=true]");
            if (last) {
                last.setAttribute("hover", false);
                last.setAttribute("contextmenu", false);
            }

            item.setAttribute("contextmenu", true);
            modpackContextMenu.classList.add("active");
            modpackContextMenu.style.top = `${item.offsetTop + event.offsetY + 1}px`;
            modpackContextMenu.style.left = `${item.offsetLeft + event.offsetX + 1}px`;

        });

        modpackContainer.appendChild(item);

    }

    let modpackCount = document.getElementById("modpack-count");
    modpackCount.textContent = modpacks.length + (modpacks.length === 1 ? " modpack" : " modpacks");

});

ipcRenderer.on("load-settings", (event, settings) => {

    settings = helper.flattenObject(settings);

    let settingsTable = document.getElementById("settings-table").querySelector("tbody");
    settingsTable.innerHTML = "";

    for (let key in settings) {

        let value = settings[key];

        let setting = document.createElement("tr");
        setting.setAttribute("data-type", typeof value);

        let keyElement = document.createElement("td");
        keyElement.textContent = key;

        let valueElement = document.createElement("td");
        let valueInputBox = document.createElement("input");
        valueInputBox.value = value;

        valueElement.appendChild(valueInputBox);
        setting.appendChild(keyElement);
        setting.appendChild(valueElement);
        settingsTable.appendChild(setting);

    }

});

ipcRenderer.on("modpack-download-progress", (event, id, progress) => {

    let modpack = document.getElementById(id);
    let percentage = (progress.loaded.size / progress.total.size) * 100;

    modpack.children[1].setMode("PROGRESS");
    modpack.children[1].setValue(percentage);

});

ipcRenderer.on("modpack-start", (event, id) => {

    let modpack = document.getElementById(id);

    modpack.children[1].setMode("INFINITE");
    modpack.children[2].setAttribute("state", "STARTING");

});

ipcRenderer.on("modpack-stdout", (event, id, data) => {

    let modpack = document.getElementById(id);

    if (data.indexOf("[FML]: Forge Mod Loader has successfully loaded") !== -1) {
        modpack.children[1].setMode("NONE");
        modpack.children[2].setAttribute("state", "RUNNING");
    }

    /*var debugOutput = document.getElementById("debug-output");
    debugOutput.textContent += data;
    debugOutput.scrollTop = debugOutput.scrollHeight;*/

});

ipcRenderer.on("modpack-stderr", (event, data) => {

    /*var debugOutput = document.getElementById("debug-output");
    debugOutput.textContent += data;
    debugOutput.scrollTop = debugOutput.scrollHeight;*/

});

ipcRenderer.on("modpack-error", (event, id, error) => {

    let modpack = document.getElementById(id);

    modpack.setAttribute("running", false);
    modpack.children[1].setMode("NONE");
    modpack.children[2].setAttribute("state", "DEFAULT");

    // PRINT ERROR INFO

});

ipcRenderer.on("modpack-exit", (event, id, code) => {

    let modpack = document.getElementById(id);

    modpack.setAttribute("running", false);
    modpack.children[1].setMode("NONE");
    modpack.children[2].setAttribute("state", "DEFAULT");

    // PRINT EXIT CODE

});
