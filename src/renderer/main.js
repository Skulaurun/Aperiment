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

var modpackRunning = false;
document.addEventListener("DOMContentLoaded", () => {

    ipcRenderer.send("app-version");

    var modpackUrl = document.getElementById("modpack-url");
    var addButton = document.getElementById("add-modpack");
    addButton.addEventListener("click", () => {
        ipcRenderer.send("add-modpack", modpackUrl.value);
    });

    var saveButton = document.getElementById("save-button");
    saveButton.addEventListener("click", () => {

        var settings = {};
        var settingsTable = document.getElementById("settings-table").querySelector("tbody");

        for (var i = 0; i < settingsTable.children.length; i++) {

            var setting = settingsTable.children[i];

            var key = setting.children[0].textContent;
            var value = setting.querySelector("input").value;

            settings[key] = value;

        }

        ipcRenderer.send("save-settings", settings);

    });

    var launchButton = document.getElementById("launch-button");
    launchButton.addEventListener("click", () => {

        if (!modpackRunning) {

            let selectedModpack = document.querySelector(".library-item.selected");
            
            if (selectedModpack) {

                modpackRunning = true;
    
                var debugProgress = document.getElementById("debug-progress");
                debugProgress.textContent = "PREPARING";
                launchButton.textContent = "CANCEL";
                launchButton.disabled = true;
        
                ipcRenderer.send("launch-modpack", {
                    vma: selectedModpack.getAttribute("vma"),
                    url: selectedModpack.getAttribute("url"),
                    directory: selectedModpack.getAttribute("directory")
                });
                
            }

        } else {
            ipcRenderer.send("terminate-modpack");
        }

    });

    var logoutButton = document.getElementById("logout-button");
    logoutButton.addEventListener("click", () => {
        ipcRenderer.send("user-logout");
    });

    var menuContainer = document.getElementById("menu-container");
    menuContainer.querySelectorAll(".menu-item").forEach((node) => {

        node.children[0].setAttribute("draggable", false);

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

    var versionElement = document.getElementById("app-version");
    versionElement.textContent += version;

});

ipcRenderer.on("load-modpacks", (event, modpacks) => {

    var libraryContainer = document.getElementById("library-container");
    libraryContainer.innerHTML = "";

    for (var i = 0; i < modpacks.length; i++) {

        let modpack = modpacks[i];

        var item = document.createElement("div");
        item.setAttribute("name", modpack.name);
        item.setAttribute("creators", modpack.creators.join(", "));
        item.setAttribute("description", modpack.description);
        item.setAttribute("directory", modpack.name.trim().toLowerCase().replace(/ /g, "-"));
        item.setAttribute("url", modpack.url);
        item.setAttribute("vma", modpack.vma);
        item.classList.add("library-item");
    
        var icon = document.createElement("img");
        icon.setAttribute("draggable", false);
        icon.src = "../icon.png";
    
        var name = document.createElement("p");
        name.textContent = modpack.name;
    
        item.appendChild(icon);
        item.appendChild(name);
        libraryContainer.appendChild(item);

    }

    libraryContainer.childNodes[0].classList.add("selected");

    var modpackName = document.getElementById("modpack-name");
    var modpackCreators = document.getElementById("modpack-creators");
    var modpackDescription = document.getElementById("modpack-description");
    modpackName.textContent = "Name: " + libraryContainer.childNodes[0].getAttribute("name");
    modpackCreators.textContent = "Creators: " + libraryContainer.childNodes[0].getAttribute("creators");
    modpackDescription.textContent = "Description: " + libraryContainer.childNodes[0].getAttribute("description");

    libraryContainer.childNodes.forEach((node) => {

        node.addEventListener("click", () => {

            if (!node.classList.contains("selected")) {

                document.querySelector(".library-item.selected").classList.remove("selected");
                node.classList.add("selected");

                modpackName.textContent = "Name: " + node.getAttribute("name");
                modpackCreators.textContent = "Creators: " + node.getAttribute("creators");
                modpackDescription.textContent = "Description: " + node.getAttribute("description");

            }

        });

    });

});

ipcRenderer.on("load-settings", (event, settings) => {

    settings = helper.flattenObject(settings);

    var settingsTable = document.getElementById("settings-table").querySelector("tbody");

    for (var key in settings) {

        var value = settings[key];

        var setting = document.createElement("tr");
        var keyElement = document.createElement("td");
        keyElement.textContent = key;

        var valueElement = document.createElement("td");
        var valueInputBox = document.createElement("input");
        valueInputBox.value = value;

        valueElement.appendChild(valueInputBox);
        setting.appendChild(keyElement);
        setting.appendChild(valueElement);
        settingsTable.appendChild(setting);

    }

});

ipcRenderer.on("download-progress", (event, progress) => {

    var percentage = (progress.loaded.size / progress.total.size) * 100;

    var progressBar = document.getElementById("download-progress").querySelector(".line.progress");
    var debugProgress = document.getElementById("debug-progress");

    progressBar.style.width = `${percentage}%`;
    debugProgress.textContent = `DOWNLOADING: ${progress.file}`;

});

ipcRenderer.on("modpack-start", () => {

    var debugProgress = document.getElementById("debug-progress");
    debugProgress.textContent = "RUNNING";

    var launchButton = document.getElementById("launch-button");
    launchButton.textContent = "STOP";
    launchButton.disabled = false;

});

ipcRenderer.on("modpack-stdout", (event, data) => {

    var debugOutput = document.getElementById("debug-output");
    debugOutput.textContent += data;
    debugOutput.scrollTop = debugOutput.scrollHeight;

});

ipcRenderer.on("modpack-stderr", (event, data) => {

    var debugOutput = document.getElementById("debug-output");
    debugOutput.textContent += data;
    debugOutput.scrollTop = debugOutput.scrollHeight;

});

ipcRenderer.on("modpack-error", (event, error) => {

    modpackRunning = false;

    var launchButton = document.getElementById("launch-button");
    launchButton.disabled = false;

});

ipcRenderer.on("modpack-exit", (event, code) => {

    modpackRunning = false;

    var debugProgress = document.getElementById("debug-progress");
    debugProgress.textContent = "EXITED: " + code.toString();

    var debugOutput = document.getElementById("debug-output");
    debugOutput.textContent = "";

    var launchButton = document.getElementById("launch-button");
    launchButton.textContent = "LAUNCH";
    launchButton.disabled = false;

});
