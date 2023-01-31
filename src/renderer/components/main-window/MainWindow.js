/*
 *
 *   Aperiment - Custom Minecraft Launcher
 *   Copyright (C) 2020 - 2022 Adam Charvát
 *
 *   Aperiment is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Aperiment is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Aperiment. If not, see <https://www.gnu.org/licenses/>.
 *
 */

/*
    Electron does not support ES6 modules,
    so we need to use CommonJS require() here.
*/
const { ipcRenderer } = require("electron");

import Popup from "../popup/Popup.js";
import Global from "../global/Global.js";
import { Instance } from "../../Instance.js";
import { CustomElement } from "../../ElementBuilder.js";
import { InputType, InputValue, InstanceState } from "../../Enum.js";
import { InputBox, SelectBox, PathBox } from "../input/Input.js";

let instances = [];

document.addEventListener("DOMContentLoaded", () => {

    Global.addWindowControls([
        Global.SvgType.MinimizeButton,
        Global.SvgType.MaximizeButton,
        Global.SvgType.CloseButton
    ]);

    document.querySelector(".page-item[name=library]")
        ?.appendChild(Instance.launchOverlay.get());

    Array.from(document.querySelectorAll("tr td.writable-input")).forEach((element) => {
        const inputType = InputType[element.getAttribute("input-type")];
        if (inputType["value"] === InputValue.File || inputType["value"] === InputValue.Directory) {
            element.appendChild(
                new PathBox({
                    default: "",
                    isDirectory: inputType["value"] === InputValue.Directory,
                    fileTypes: inputType["fileTypes"]
                }).get()
            );
        } else if (inputType["value"] === InputValue.Text) {
            element.appendChild(
                new InputBox({
                    default: ""
                }).get()
            );
        }
    });

    Array.from(document.querySelectorAll(".footer-button.href")).forEach((button) => {
        button.addEventListener("click", (event) => {
            ipcRenderer.send("open-link", event.target.getAttribute("href"));
        });
    });

    Popup.parent = document.querySelector(".page-item[name=browse]");

    const modpackStoreList = document.getElementById("modpack-store-list");
    const officialModpacks = {
        "SkulTech": "https://www.skulaurun.eu/skultech/manifest.json",
        "SkulTech Alpha 1.0.0": "https://www.skulaurun.eu/skultech/legacy/skultech-a1.0.0.json",
        "SkulTech Alpha 1.5.7": "https://www.skulaurun.eu/skultech/legacy/skultech-a1.5.7.json",
        "SkulTech Alpha 2.0.0": "https://www.skulaurun.eu/skultech/legacy/skultech-a2.0.0.json"
    };

    for (const [name, url] of Object.entries(officialModpacks)) {
        let title = document.createElement("div");
        title.classList.add("entry-name");
        title.textContent = name;
        let button = document.createElement("button");
        button.classList.add("settings-button", "store-add-button");
        button.textContent = "+";
        button.setAttribute("url", title);
        button.addEventListener("click", () => {
            ipcRenderer.send("add-modpack", url);
        });
        let entry = document.createElement("div");
        entry.classList.add("modpack-entry");
        entry.appendChild(title);
        entry.appendChild(button);
        modpackStoreList.appendChild(entry);
    }

    ipcRenderer.send("app-version");

    let modpackSearchBar = document.getElementById("modpack-search-bar");
    document.getElementById("add-modpack-button").addEventListener("click", () => {
        if (modpackSearchBar.value != "") {
            ipcRenderer.send("add-modpack", modpackSearchBar.value);
        }
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

ipcRenderer.on("app-version", (_, version) => {
    let versionElement = document.getElementById("app-version");
    versionElement.textContent += version;
});

ipcRenderer.on("load-modpacks", (_, configs) => {

    const instanceContainer = document.getElementById("modpack-container");

    /* In case of a reload */
    instances.forEach((instance) => {
        instance.destroy();
    });
    instances.length = 0;

    configs.forEach((config) => {
        instances.push(new Instance(config));
    });

    instances.sort(({ config: { manifest: a } }, { config: { manifest: b } }) => {
        let nameA = a.name.toLowerCase();
        let nameB = b.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    instances.forEach((instance) => {
        instanceContainer.appendChild(instance.icon.get());
    });

    ipcRenderer.send("load-icons");

});

ipcRenderer.on("load-icons", (_, icons) => {

    let modpackContainer = document.getElementById("modpack-container");
    for (const [id, icon] of Object.entries(icons)) {
        const modpackIcon = modpackContainer.querySelector(
            `.instance-icon[id="${id}"] img`
        );
        modpackIcon.src = `${icon}?${new Date().getTime()}`;
    }

    ipcRenderer.send("app-load-finish");

});

ipcRenderer.on("load-settings", (event, settings) => {
    
    let settingCategory = {
        "general": "General",
        "launcher": "Launcher"
    };
    let inputList = [];
    settings = flattenObject(settings);

    let settingsTable = document.getElementById("settings-table").querySelector("tbody");
    settingsTable.innerHTML = "";

    for (let key in settings) {

        let value = settings[key];

        let setting = document.createElement("tr");
        setting.setAttribute("setting-name", key);
        setting.setAttribute("data-type", typeof value);

        /*
            Be aware: Doesn't support nested categories!
            This piece of code is dependent on setting order.
        */
        let category = key.indexOf(".") != -1 ? key.split(".")[0] : "general";
        if (settingCategory.hasOwnProperty(category)) {
            let categoryRow = document.createElement("tr");
            categoryRow.classList.add("category-row");
            let categoryLabel = document.createElement("td");
            categoryLabel.textContent = settingCategory[category];
            categoryLabel.setAttribute("colspan", 2);
            categoryRow.appendChild(categoryLabel);
            settingsTable.appendChild(categoryRow);
            delete settingCategory[category];
        }

        let keyElement = document.createElement("td");
        keyElement.textContent = InputType.hasOwnProperty(key) ? InputType[key]["name"] : key;

        let valueInputBox = null;
        let valueElement = document.createElement("td");

        if (InputType.hasOwnProperty(key)) {
            if (InputType[key]["value"] === InputValue.Boolean) {
                valueInputBox = new SelectBox({
                    default: value,
                    options: {
                        "Enabled": true,
                        "Disabled": false
                    }
                });
            } else if (InputType[key]["value"] === InputValue.Directory || InputType[key]["value"] === InputValue.File) {
                valueInputBox = new PathBox({
                    default: value,
                    isDirectory: InputType[key]["value"] === InputValue.Directory,
                    fileTypes: InputType[key]["fileTypes"]
                });
            }
        } else {
            valueInputBox = new InputBox({ default: value });
        }

        setting.appendChild(keyElement);
        setting.appendChild(valueElement);
        settingsTable.appendChild(setting);
        valueElement.appendChild(valueInputBox.get());

        inputList.push(valueInputBox);
        valueInputBox.save();

    }

    let saveButton = document.createElement("button");
    saveButton.classList.add("save-button");
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", onSaveSettings);

    let revertButton = document.createElement("button");
    revertButton.classList.add("revert-button");
    revertButton.textContent = "Revert";
    revertButton.addEventListener("click", () => {
        onRevertSettings(inputList);
    });

    let buttonRow = document.createElement("tr");
    buttonRow.classList.add("button-row");

    let buttonContainer = document.createElement("td");
    buttonContainer.setAttribute("colspan", 2);
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(revertButton);

    buttonRow.appendChild(buttonContainer);
    settingsTable.appendChild(buttonRow);

    onSaveSettings();

});

ipcRenderer.on("modpack-download-progress", (_, id, progress) => {

    let progressPercentage = (progress.loaded.size / progress.total.size) * 100;

    let loadedMB = (progress.loaded.size / 1000000).toFixed(2);
    let totalMB = (progress.total.size / 1000000).toFixed(2);

    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            state: InstanceState.Fetching,
            progressSize: `${loadedMB} / ${totalMB} MB`,
            progressValue: progressPercentage,
            progressText: progress.file
        });
    }

});

ipcRenderer.on("modpack-start", (_, id, pid) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            processId: pid,
            progressText: "Starting"
        });
    }
});

ipcRenderer.on("modpack-stdout", (_, id, data) => {
    if (data.indexOf("LWJGL") !== -1) {
        const instance = instances.find(i => i.id === id);
        if (instance && instance.activeState["state"] > InstanceState.Idle) {
            instance.update({
                state: InstanceState.Running
            });
        }
    }
});

ipcRenderer.on("modpack-stderr", (event, id, data) => {

});

ipcRenderer.on("modpack-error", (event, id, error) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            state: InstanceState.Idle,
            exitError: error,
            progressText: `⚠️ ${error}`
        });
    }
});

ipcRenderer.on("modpack-exit", (event, id, code) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            state: InstanceState.Idle,
            exitCode: code,
            progressText: `⚠️ The process exited with code ${code}`
        });
    }
});

ipcRenderer.on("modpack-add", (event, modpack, error) => {
    if (!error) {
        Popup.alert(`Added '${modpack.name}' to library. 📚`, Popup.type.SUCCESS);
    } else {
        Popup.alert(error, Popup.type.ERROR);
    }
});

ipcRenderer.on("load-changelog", (event, html) => {

    // this is wrong

    document.getElementById("changelog-content").innerHTML = html;

    Array.from(document.querySelectorAll(".changelog-content a")).forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            ipcRenderer.send("open-link", event.target.getAttribute("href"));
        });
    });

});

ipcRenderer.on("force-click", (_, selector) => {
    document.querySelector(selector)?.click();
});

function onSaveSettings() {

    let settings = {};
    let settingsTable = document.getElementById("settings-table").querySelector("tbody");

    for (const setting of Array.from(settingsTable.querySelectorAll("tr[data-type]"))) {

        let key = setting.getAttribute("setting-name");
        let inputId = setting.querySelector("input")?.getAttribute("input-id");
        let inputElement = CustomElement.registry.find(x => inputId && x.id == inputId);

        if (inputElement) {
            let value = inputElement.value();
            inputElement.save();
            settings[key] = value;
        }

    }

    ipcRenderer.send("save-settings", settings);
    
}

function onRevertSettings(inputList) {
    for (const input of inputList) {
        input.revert();
    }
}

function flattenObject(target, parent, separator = ".") {
    let object = {};
    for (const [key, value] of Object.entries(target)) {
        let path = parent ? (parent + separator + key) : key;
        if (Object.prototype.toString.call(value) === "[object Object]") {
            Object.assign(object, flattenObject(value, path));
        } else {
            object[path] = value;
        }
    }
    return object;
}
