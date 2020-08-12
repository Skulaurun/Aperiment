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

const { ipcRenderer } = electron;

document.addEventListener("DOMContentLoaded", () => {

    ipcRenderer.send("app-version");

    let modpackSearchBar = document.getElementById("modpack-search-bar");
    document.getElementById("add-modpack-button").addEventListener("click", () => {

        if (modpackSearchBar.value != "") {
            ipcRenderer.send("add-modpack", modpackSearchBar.value);
        }

    });

    document.getElementById("save-settings-button").addEventListener("click", () => {

        let settings = {};
        let settingsTable = document.getElementById("settings-table").querySelector("tbody");

        for (let i = 0; i < settingsTable.children.length; i++) {

            let setting = settingsTable.children[i];

            let key = setting.children[0].textContent;
            let value = setting.querySelector("input").value;

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

    window.addEventListener("click", () => {

        let item = modpackContainer.querySelector(".modpack-item[contextmenu=true]");
        if (item) {
            item.setAttribute("hover", false);
            item.setAttribute("contextmenu", false);
        }

        modpackContextMenu.classList.remove("active");

    });

    for (let i = 0; i < modpacks.length; i++) {

        let modpack = modpacks[i];

        let item = document.createElement("div");
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
        item.appendChild(statusCircle);
    
        item.addEventListener("click", (event) => {

            let target = event.currentTarget;

            if (target.getAttribute("running") === "false") {
        
                target.querySelector(".status-bar").setMode("INFINITE");
                target.setAttribute("running", true);
    
                ipcRenderer.send("launch-modpack", {
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

    [
        {
            "name": "Start",
            "action": function(modpack) {
                modpack.click();
            }
        },
        {
            "name": "View Console [WIP]",
            "action": function(modpack) {}
        },
        {
            "name": "Go To Store Page [WIP]",
            "action": function(modpack) {}
        },
        {
            "name": "Open Minecraft Folder [WIP]",
            "action": function(modpack) {}
        },
        {
            "name": "Properties [WIP]",
            "action": function(modpack) {}
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

    let modpackCount = document.getElementById("modpack-count");
    modpackCount.textContent = modpacks.length + (modpacks.length === 1 ? " modpack" : " modpacks");

});

ipcRenderer.on("load-settings", (event, settings) => {

    settings = helper.flattenObject(settings);

    let settingsTable = document.getElementById("settings-table").querySelector("tbody");

    for (let key in settings) {

        let value = settings[key];

        let setting = document.createElement("tr");
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

ipcRenderer.on("download-progress", (event, progress) => {

    let percentage = (progress.loaded.size / progress.total.size) * 100;

    /*progressBar.setMode("PROGRESS");
    progressBar.setValue(percentage);
    progressBar.setText(`DOWNLOADING: ${progress.file}`);*/

});

ipcRenderer.on("modpack-start", () => {

    // STARTING CIRCLE, BLINK BETWEEN GREEN AND BLUE

    /*progressBar.setText("");
    progressBar.setMode("NONE");
    launchButton.textContent = "STOP";*/

});

ipcRenderer.on("modpack-stdout", (event, data) => {

    if (data.indexOf("[FML]: Forge Mod Loader has successfully loaded") !== -1) {
        // FML LOAD FINISHED
        // SET STATUS CIRCLE TO GREEN
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

ipcRenderer.on("modpack-error", (event, error) => {

    /*launchButton.setAttribute("running", false);
    launchButton.textContent = "LAUNCH";*/

    // PRINT ERROR INFO

});

ipcRenderer.on("modpack-exit", (event, code) => {

    /*launchButton.setAttribute("running", false);
    launchButton.textContent = "LAUNCH";*/

    // PRINT EXIT CODE

});
