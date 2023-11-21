/*
 *
 *   Aperiment - Custom Minecraft Launcher
 *   Copyright (C) 2020 - 2023 Adam Charvát
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

import Global from "../../components/global/Global.js";
import Popup from "../../components/popup/Popup.js";
import Instance from "../../Instance.js";
import VersionList from "../../VersionList.js";
import CustomElement from "../../CustomElement.js";
import ElementBuilder from "../../ElementBuilder.js";
import { InputBox, SelectBox, PathBox } from "../../components/input/Input.js";
import { InputType, InputValue, InstanceState, PopupType } from "../../GlobalEnum.js";

let instances = [];
let popup = new Popup();

let userInfo = {
    UUID: '25966168-dc9c-360c-8f32-ed022bfa1070',
    playerName: 'Herobrine'
};

window.addEventListener("error", ({ error }) => {
    ipcRenderer.send("renderer-error", error.stack || error);
});

document.addEventListener("DOMContentLoaded", () => {

    Global.addWindowControls([
        Global.SvgType.MinimizeButton,
        Global.SvgType.MaximizeButton,
        Global.SvgType.CloseButton
    ]);

    document.querySelector(".page-item[name=library]")
        ?.appendChild(Instance.launchOverlay.get());

    document.getElementById("browse-redirect").addEventListener("click", () => {
        document.querySelector(".menu-item[name=browse]")?.click();
    });

    document.getElementById("add-instance-button").addEventListener("click", (event) => {
        const { id: latestVersion } = Instance.versionList.getMinecraft(true)[0];
        ipcRenderer.send("new-instance", {
            name: "Untitled Instance",
            description: `❤️ Look, ${userInfo.playerName} created a new instance.\n🧊 Minecraft: ${latestVersion}\n\nClick here to edit.`,
            creators: [userInfo.playerName],
            versions: [ { id: "1.0.0", vanilla: latestVersion } ],
            _MANIFEST_VERSION_: "1.0",
            default: {
                jvmArguments: "-Xms2048M -Xmx2048M"
            }
        }, true);
        event.target.setAttribute("disabled", true);
    });

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

    popup.parent = document.querySelector(".page-item[name=browse]");

    const modpackStoreList = document.getElementById("modpack-store-list");
    const officialModpacks = {
        "SkulTech": "https://www.skulaurun.eu/skultech/manifest.json",
        "SkulTech Alpha 3.0.0": "https://www.skulaurun.eu/skultech/legacy/skultech-a3.0.0.json",
        "SkulTech Alpha 2.0.0": "https://www.skulaurun.eu/skultech/legacy/skultech-a2.0.0.json",
        "SkulTech Alpha 1.5.7": "https://www.skulaurun.eu/skultech/legacy/skultech-a1.5.7.json",
        "SkulTech Alpha 1.0.0": "https://www.skulaurun.eu/skultech/legacy/skultech-a1.0.0.json"
    };

    ElementBuilder.buildTo(modpackStoreList, Object.entries(officialModpacks).map(([name, url]) => {
        return {
            type: "div",
            classList: ["extension-entry"],
            children: [
                {
                    type: "div",
                    classList: ["entry-name"],
                    textContent: name
                },
                {
                    type: "button",
                    classList: ["add-button", "store-add-button"],
                    attributeList: { url: url },
                    listeners: {
                        click: () => { ipcRenderer.send("new-instance", url); }
                    }
                }
            ]
        };
    }));

    let modpackSearchBar = document.getElementById("modpack-search-bar");
    document.getElementById("add-modpack-button").addEventListener("click", () => {
        if (modpackSearchBar.value != "") {
            ipcRenderer.send("new-instance", modpackSearchBar.value);
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

    ipcRenderer.send("main-window-load");

});

ipcRenderer.on("main-window-load", (_, toLoad) => {

    const versionElement = document.getElementById("app-version");
    const changelogElement = document.getElementById("changelog-content");

    /* Load App Version -> Homepage */
    versionElement.textContent = toLoad["appVersion"];

    /* Load Changelog -> Homepage */
    changelogElement.innerHTML = toLoad["changelog"];
    Array.from(document.querySelectorAll(".changelog-content a")).forEach((button) => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            ipcRenderer.send("open-link", event.target.getAttribute("href"));
        });
    });

    /* Load Version List -> Instance */
    Instance.versionList = new VersionList(toLoad['versions']);

    /* Load Settings -> Aperiment Settings */
    legacyLoadSettings(toLoad["settings"]);

    /* Load Instances -> Modpack Library */
    loadInstances(toLoad);

    /* Store User Info */
    userInfo = toLoad["userInfo"];

    ipcRenderer.send("app-load-finish");

});

ipcRenderer.on("new-instance", (_, toLoad, error, isLocal) => {
    if (!error) {
        loadInstances(toLoad);
        const config = toLoad.loadedConfigs[0];
        ipcRenderer.send("new-instance-config", config);
        popup.alert(`Added '${config.manifest["name"]}' to library. 📚`, PopupType.Success);
        if (isLocal) {
            const { id } = toLoad["loadedConfigs"][0];
            document.getElementById(id)?.click();
        }
    } else {
        popup.alert(error, PopupType.Error);
        console.error(error);
    }
    if (isLocal) {
        document.getElementById("add-instance-button").removeAttribute("disabled");
    }
});

ipcRenderer.on("delete-instance", (_, id) => {
    instances.find(i => i.id === id)
        ?.destroy();
    instances = instances.filter(i => i.id !== id);
});

ipcRenderer.on("load-instances", (_, toLoad) => {
    loadInstances(toLoad);
});

ipcRenderer.on("instance-download-progress", (_, id, progress) => {

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

ipcRenderer.on("instance-start", (_, id, pid) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            state: InstanceState.Preparing,
            processId: pid,
            progressText: "Starting"
        });
    }
});

ipcRenderer.on("instance-stdout", (_, id, data) => {
    if (data.indexOf("LWJGL") !== -1) {
        const instance = instances.find(i => i.id === id);
        if (instance && instance.activeState["state"] > InstanceState.Idle) {
            instance.update({
                state: InstanceState.Running
            });
        }
    }
});

ipcRenderer.on("instance-stderr", (event, id, data) => {

});

ipcRenderer.on("instance-error", (event, id, error) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            state: InstanceState.Idle,
            exitError: error,
            progressText: `⚠️ ${error}`
        });
    }
});

ipcRenderer.on("instance-exit", (event, id, code) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            state: InstanceState.Idle,
            exitCode: code,
            progressText: `⚠️ The process exited with code ${code}`
        });
    }
});

ipcRenderer.on("instance-update", (_, id, config, icon) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        if (icon) {
            instance.setIcon(icon);
        }
        instance.reload(config);
    }
});

ipcRenderer.on("instance-active", (_, id) => {
    const instance = instances.find(i => i.id === id);
    if (instance) {
        instance.update({
            enableTerminate: true
        });
    }
});

ipcRenderer.on("force-click", (_, selector) => {
    document.querySelector(selector)?.click();
});

function loadInstances(toLoad) {

    const instanceContainer = document.getElementById("modpack-container");

    /* Load Instances -> Modpack Library */
    toLoad["loadedConfigs"].forEach((config) => {
        instances.push(new Instance(config));
    });

    instances.sort(({ config: { manifest: a } }, { config: { manifest: b } }) => {
        let nameA = a.name.toLowerCase();
        let nameB = b.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    instanceContainer.innerHTML = "";
    instances.forEach((instance) => {
        instanceContainer.appendChild(instance.icon.get());
    });

    /* Load Instance Icons -> Modpack Library */
    for (const [id, icon] of Object.entries(toLoad["loadedIcons"])) {
        if (icon) {
            const instanceIcon = instanceContainer.querySelector(
                `.instance-icon[id="${id}"] img`
            );
            instanceIcon.src = `${icon}?${new Date().getTime()}`;
        }
    }

}

function legacyLoadSettings(settings) {
    
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

};

function onSaveSettings() {

    let settings = {};
    let settingsTable = document.getElementById("settings-table").querySelector("tbody");

    for (const setting of Array.from(settingsTable.querySelectorAll("tr[data-type]"))) {

        let key = setting.getAttribute("setting-name");
        let inputId = setting.querySelector(".custom-element")?.getAttribute("custom-id");
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
