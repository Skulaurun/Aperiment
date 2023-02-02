import CustomElement from "./ElementBuilder.js";
import InstanceIcon from "./components/instance-icon/InstanceIcon.js";
import { LaunchOverlay } from "./components/modal-overlay/ModalOverlay.js";
import { InstanceState, ProgressBarMode } from "./GlobalEnum.js";

const { ipcRenderer } = require("electron");

export default class Instance {

    static launchOverlay = new LaunchOverlay();

    constructor(instanceConfig) {

        this.config = instanceConfig;
        this.id = this.config.id;

        this.icon = new InstanceIcon({ instanceConfig: this.config });
        this.galleryIndex = 0;

        this.activeState = {
            state: InstanceState.Idle,
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
        ipcRenderer.send("launch-instance", { id: this.id });
    }

    terminate() {
        this.update({
            state: InstanceState.Idle
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

        Instance.launchOverlay.update();

    }

    updateProgress(progressBar) {
        switch (this.activeState["state"]) {
            case InstanceState.Idle:
                progressBar.setMode(ProgressBarMode.None);
                break;
            case InstanceState.Preparing:
                progressBar.setMode(ProgressBarMode.Infinite);
                break;
            case InstanceState.Fetching:
                progressBar.setMode(ProgressBarMode.Progress);
                progressBar.setValue(this.activeState["progressValue"] || 0);
                break;
            case InstanceState.Running:
                progressBar.setMode(ProgressBarMode.None);
                break;
        }
    }

    traverseGallery(direction) {
        if (direction > 0) {
            if (this.galleryIndex + 1 < (this.config.manifest["gallery"] || []).length) {
                this.galleryIndex++;
            }
        } else {
            if (this.galleryIndex - 1 >= 0) {
                this.galleryIndex--;
            }
        }
    }

    openFolder() {
        ipcRenderer.send("open-instance-folder", this.id);
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
                if (input.hasAttribute("input-id")) {
                    let inputId = element.querySelector(".custom-element")
                        ?.getAttribute("custom-id");
                    CustomElement.registry.find(x => inputId && x.id == inputId)
                        ?.save();
                }
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

    destroy() {
        this.instanceIcon.remove();
    }
    
}
