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

import CustomElement from "./CustomElement.js";
import InstanceIcon from "./components/instance-icon/InstanceIcon.js";
import { LaunchOverlay } from "./components/modal-overlay/ModalOverlay.js";
import { InstanceState, ProgressBarMode } from "./GlobalEnum.js";

/*
    Electron does not support ES6 modules,
    so we need to use CommonJS require() here.
*/
const { ipcRenderer } = require("electron");

export default class Instance {

    static versionList = null;
    static launchOverlay = new LaunchOverlay();

    constructor(instanceConfig) {

        this.config = instanceConfig;
        this.id = this.config.id;

        this.isLocal = !this.config.config.remote;
        this.version = this.config.manifest.versions[0];

        this.icon = new InstanceIcon({ instanceConfig: this.config });
        this.galleryIndex = 0;

        this.activeState = {
            state: InstanceState.Idle,
            enableTerminate: false,
            processId: null,
            progressSize: null,
            progressValue: null,
            progressText: null
        };

        this.icon.get().addEventListener("click", () => {
            Instance.launchOverlay.display(this);
        });

    }

    launch() {
        this.update({
            state: InstanceState.Preparing,
            progressText: "Preparing"
        });
        ipcRenderer.send("launch-instance", this.id);
    }

    terminate() {
        this.update({
            state: InstanceState.Idle,
            enableTerminate: false,
            progressText: `⚠️ The process exited with code internal-error`
        });
        ipcRenderer.send("terminate-instance", this.id);
    }

    reload(config) {
        this.config = config;
        Instance.launchOverlay.update();
    }

    update(updateObject) {

        for (const [key, value] of Object.entries(updateObject)) {
            this.activeState[key] = value;
        }

        switch (this.activeState["state"]) {
            case InstanceState.Idle:
                this.icon.statusCircle.setAttribute("state", "default");
                break;
            case InstanceState.Preparing:
            case InstanceState.Fetching:
                this.icon.statusCircle.setAttribute("state", "starting");
                break;
            case InstanceState.Running:
                this.icon.statusCircle.setAttribute("state", "running");
                break;
        }
        this.updateProgress(this.icon.progressBar);

        Instance.launchOverlay.update(this);

    }

    updateProgress(progressBar) {
        switch (this.activeState["state"]) {
            case InstanceState.Idle:
                progressBar.setMode(ProgressBarMode.None);
                progressBar.setValue(0);
                break;
            case InstanceState.Preparing:
                progressBar.setMode(ProgressBarMode.Infinite);
                progressBar.setValue(0);
                break;
            case InstanceState.Fetching:
                progressBar.setMode(ProgressBarMode.Progress);
                progressBar.setValue(this.activeState["progressValue"] || 0);
                break;
            case InstanceState.Running:
                progressBar.setMode(ProgressBarMode.None);
                progressBar.setValue(0);
                break;
        }
    }

    traverseGallery(direction) {
        if (direction > 0) {
            if (this.galleryIndex + 1 < (this.config.manifest["gallery"] || []).length) {
                this.galleryIndex++;
                return true;
            }
        } else {
            if (this.galleryIndex - 1 >= 0) {
                this.galleryIndex--;
                return true;
            }
        }
    }

    openFolder() {
        ipcRenderer.send("open-instance-folder", this.id);
    }

    setIcon(url) {
        this.icon.updateNoCache(url);
    }

    loadSettings(settingsElement) {
        Array.from(settingsElement.querySelectorAll("tr:has(input)"))
            .filter(e => e.hasAttribute("path"))
            .forEach((element) => {
                let path = element.getAttribute("path").split(".");
                let input = element.querySelector("input");
                let currentObject = this.config;
                for (const key of path) {
                    if (typeof currentObject !== "object" || !currentObject.hasOwnProperty(key)) {
                        currentObject = undefined;
                        break;
                    }
                    currentObject = currentObject[key];
                }
                if (Array.isArray(currentObject)) {
                    currentObject = currentObject.join(", ");
                }
                if (typeof currentObject !== "undefined") {
                    input.value = currentObject;
                } else {
                    input.value = "None";
                }
                let inputId = element.querySelector(".custom-element")
                    ?.getAttribute("custom-id");
                CustomElement.registry.find(x => inputId && x.id == inputId)
                    ?.save();
        });
    }

    saveSettings(settingsElement) {

        let didChange = false;

        Array.from(settingsElement.querySelectorAll("tr:has(input:not([readonly]))"))
            .filter(e => e.hasAttribute("path"))
            .forEach((element) => {

                let input = element.querySelector(".custom-element");
                let inputId = input.getAttribute("custom-id");
                let inputElement = CustomElement.registry.find(x => inputId && x.id == inputId);

                let currentObject = this.config;
                let path = element.getAttribute("path").split(".");
                for (let i = 0; i < path.length - 1; i++) {
                    if (!currentObject.hasOwnProperty(path[i])) {
                        currentObject[path[i]] = {};
                    }
                    currentObject = currentObject[path[i]];
                }

                if (inputElement.previousValue != inputElement.value()) {
                    currentObject[path[path.length - 1]] = inputElement.value();
                    inputElement.save();
                    didChange = true;
                }

            });

        if (didChange) {
            ipcRenderer.send("save-instance-config", this.config);
        }

    }

    saveLocal(object) {
        if (object.version) {
            this.version = object.version;
            this.config.manifest.versions = [object.version];
        }
        if (object.name) {
            this.icon.get().querySelector(".instance-icon")
                ?.setAttribute("name", object.name);
            this.config.manifest.name = object.name;
        }
        if (object.description || object.description == "") {
            this.config.manifest.description = object.description;
        }
        ipcRenderer.send("save-instance-manifest", this.config);
    }

    getMinecraftList() {
        /* 1.0 - 1.18.2+ */
        return (Instance.versionList?.getMinecraft(true) || []);
    }

    getFabricList(version) {
        /* 0.1.0.48 - 0.14.10+ */
        return (Instance.versionList?.getFabric(version, false) || []);
    }

    getForgeList(version) {
        /* 1.4.0-5.0.0.320 - 40.1.84+ */
        return (Instance.versionList?.getForge(version, true) || []);
    }

    delete(keepFiles) {
        ipcRenderer.send("delete-instance", this.id, keepFiles);
    }

    destroy() {
        this.icon.remove();
        if (Instance.launchOverlay.instance === this) {
            Instance.launchOverlay.hide();
        }
    }
    
}
