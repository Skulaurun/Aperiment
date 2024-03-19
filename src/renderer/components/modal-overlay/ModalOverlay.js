/*
 *
 *   Aperiment - Custom Minecraft Launcher
 *   Copyright (C) 2020 - 2024 Adam Charvát
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

import Global from "../global/Global.js";
import ProgressBar from "../progress-bar/ProgressBar.js";
import CustomElement from "../../CustomElement.js";
import { InputBox, PathBox, SelectBox } from "../../components/input/Input.js";
import { InputType, InstanceState } from "../../GlobalEnum.js";

export class ModalOverlay extends CustomElement {

    constructor(options) {
       super(options);
    }

    _createElement(children) {
        super._createElement([{
            type: "div",
            assign: "overlayElement",
            classList: ["overlay-element"],
            listeners: {
                "mousedown": (event) => {
                    if (this.overlayElement === event.target) {
                        this.hide();
                    }
                }
            },
            children: [
                {
                    type: "div",
                    assign: "displayElement",
                    classList: ["display-element"],
                    children: children
                }
            ]
        }]);
    }

    show() { this.overlayElement.classList.add("overlay-active"); }
    hide() { this.overlayElement.classList.remove("overlay-active"); }
    isActive() { return this.overlayElement.classList.contains("overlay-active"); }

}

export class MessageBox extends ModalOverlay {

    constructor() {
        super({ className: "message-box" });
    }

}

export class LaunchOverlay extends ModalOverlay {

    constructor() {
        super({ className: "launch-overlay" });
    }

    _createElement() {
        super._createElement([
            {
                element: Global.createSvg(Global.SvgType.CloseButton),
                listeners: {
                    "click": () => {
                        this.hide();
                        this.instance?.saveSettings(this.instanceSettings);
                    }
                }
            },
            {
                type: "div",
                classList: ["content-wrapper"],
                children: [
                    {
                        type: "h2",
                        classList: ["instance-title"],
                        assign: "instanceTitle",
                        attributeList: { "spellcheck": "false" },
                        listeners: {
                            "focusout": () => {
                                if (!this.instanceTitle.textContent) {
                                    this.instanceTitle.textContent = "Untitled Instance";
                                }
                                this.instance?.saveLocal({ name: this.instanceTitle.textContent });
                            }
                        }
                    },
                    {
                        type: "div",
                        classList: ["gallery-wrapper"],
                        assign: "galleryWrapper",
                        children: [
                            {
                                type: "img",
                                classList: ["gallery-image"],
                                assign: "galleryImage",
                                listeners: {
                                    "load": () => { this._loadGallery(); }
                                }
                            },
                            {
                                type: "img",
                                classList: ["next-image"],
                                attributeList: { "src": "../../assets/images/arrow.png" },
                                listeners: {
                                    "click": () => { this._traverseGallery(1); }
                                }
                            },
                            {
                                type: "img",
                                classList: ["previous-image"],
                                attributeList: { "src": "../../assets/images/arrow.png" },
                                listeners: {
                                    "click": () => { this._traverseGallery(-1); }
                                }
                            }
                        ]
                    },
                    {
                        type: "div",
                        classList: ["version-wrapper"],
                        children: [
                            { type: "div", textContent: "Version: " },
                            {
                                type: "div",
                                classList: ["instance-version"],
                                assign: "instanceVersion"
                            }
                        ]
                    },
                    {
                        type: "div",
                        classList: ["button-wrapper"],
                        children: [
                            {
                                type: "button",
                                classList: ["options-button"],
                                assign: "optionsButton",
                                children: [
                                    {
                                        type: "img",
                                        attributeList: { "src": "../../assets/images/settings.png" }
                                    }
                                ],
                                listeners: {
                                    "click": () => { this._toggleSettings(); }
                                }
                            },
                            {
                                type: "button",
                                classList: ["folder-button"],
                                assign: "folderButton",
                                children: [
                                    {
                                        type: "img",
                                        attributeList: { "src": "../../assets/images/folder.png" }
                                    }
                                ],
                                listeners: {
                                    "click": () => { this._openFolder(); }
                                }
                            },
                            {
                                type: "button",
                                classList: ["start-button", "button-green"],
                                assign: "startButton",
                                textContent: "Launch",
                                listeners: {
                                    "click": () => { this._onLaunchOrTerminate(); }
                                }
                            }
                        ]
                    },
                    {
                        type: "div",
                        classList: ["progress-wrapper"],
                        assign: "progressWrapper",
                        children: [
                            { type: "p", classList: ["progress-text"], assign: "progressText" },
                            { type: "p", classList: ["progress-size"], assign: "progressSize" },
                            { element: new ProgressBar(), assign: "progressBar" }
                        ]
                    },
                    {
                        type: "table",
                        classList: ["instance-settings", "modpack-properties-table"],
                        assign: "instanceSettings",
                        listeners: {
                            "focusout": () => { this.instance?.saveSettings(this.instanceSettings); }
                        },
                        attributeList: {
                            visible: false
                        },
                        children: [
                            {
                                type: "tr",
                                attributeList: { local: true },
                                children: [
                                    { type: "td", textContent: "Minecraft" },
                                    {
                                        element: new SelectBox({ isWritable: true, noSpell: true }),
                                        assign: "minecraftVersion"
                                    }
                                ]
                            },
                            {
                                type: "tr",
                                attributeList: { local: true },
                                children: [
                                    { type: "td", textContent: "Loader" },
                                    {
                                        element: new SelectBox({
                                            default: "None",
                                            options: {
                                                "None": "vanilla",
                                                "Forge": "forge",
                                                "Fabric": "fabric"
                                            }
                                        }),
                                        assign: "loaderType"
                                    }
                                ]
                            },
                            {
                                type: "tr",
                                attributeList: { local: true, visible: false },
                                assign: "loaderRow",
                                children: [
                                    {
                                        type: "td",
                                        textContent: "None",
                                        assign: "loaderName"
                                    },
                                    {
                                        element: new SelectBox({ isWritable: true, noSpell: true }),
                                        assign: "loaderVersion"
                                    }
                                ]
                            },
                            {
                                type: "tr",
                                attributeList: { path: "config.runtime.jvmArguments" },
                                children: [
                                    { type: "td", textContent: "JVM Arguments" },
                                    {
                                        element: new InputBox({ default: "", noSpell: true })
                                    }
                                ]
                            },
                            {
                                type: "tr",
                                attributeList: { path: "config.runtime.path" },
                                children: [
                                    { type: "td", textContent: "Java Executable" },
                                    {
                                        element: new PathBox({
                                            default: "",
                                            isDirectory: false,
                                            noSpell: true,
                                            fileTypes: InputType["java"]["fileTypes"],
                                            attributeList: {
                                                placeholder: "<Auto-Download JRE>"
                                            }
                                        })
                                    }
                                ]
                            },
                            {
                                type: "tr",
                                children: [
                                    { type: "td", textContent: "Danger Zone 🚨" },
                                    {
                                        type: "div",
                                        classList: ["danger-zone"],
                                        assign: "dangerZone",
                                        attributeList: { "visible": false },
                                        children: [
                                            {
                                                type: "p",
                                                assign: "dangerText",
                                                textContent: "Show More"
                                            },
                                            {
                                                type: "div",
                                                classList: ["danger-button"]
                                            }
                                        ],
                                        listeners: {
                                            "click": () => { this._toggleDanger(); }
                                        }
                                    }
                                ]
                            },
                            {
                                type: "tr",
                                classList: ["danger-content"],
                                children: [
                                    {
                                        type: "td",
                                        attributeList: { "colspan": "2" },
                                        children: [
                                            {
                                                type: "div",
                                                classList: ["danger-notice"],
                                                children: [
                                                    { type: "p", textContent: "🚩 Deleting the instance will erase all user data!" },
                                                    { type: "p", textContent: "These include your: worlds, screenshots, configuration, etc." }
                                                ]
                                            },
                                            {
                                                type: "button",
                                                classList: ["delete-button", "button-red"],
                                                textContent: "Delete",
                                                listeners: {
                                                    "click": () => { this._onDelete(); }
                                                }
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        type: "div",
                        classList: ["instance-description"],
                        children: [
                            {
                                type: "span",
                                classList: ["description-heading"],
                                textContent: "Description"
                            },
                            {
                                type: "p",
                                assign: "instanceDescription",
                                attributeList: { "spellcheck": "false" },
                                listeners: {
                                    "focusout": () => {
                                        this.instance?.saveLocal({ description: this.instanceDescription.textContent });
                                    }
                                }
                            },
                            {
                                type: "span",
                                classList: ["description-heading"],
                                textContent: "Creators"
                            },
                            { type: "p", assign: "instanceCreators" },
                            {
                                type: "span",
                                classList: ["description-heading"],
                                textContent: "Credits"
                            },
                            { type: "p", assign: "instanceCredits" },
                            {
                                type: "span",
                                classList: ["description-heading"],
                                textContent: "Changelog"
                            },
                            { type: "p", assign: "instanceChangelog" }
                        ]
                    }
                ]
            }
        ]);
        this.loaderType.addEventListener("change", (value, name, isInitial) => {
            this.loaderRow.setAttribute("visible", value !== "vanilla");
            this.loaderName.textContent = name;
            this._loaderChange(
                this.minecraftVersion.value()
            );
            if (!isInitial && this.loaderVersion.value()) {
                this._saveLocal();
            }
        });
        this.minecraftVersion.addEventListener("change", (value, _, isInitial) => {
            this._loaderChange(value);
            if (!isInitial && this.instance?.version?.vanilla !== value) {
                this._saveLocal();
            }
        });
        this.loaderVersion.addEventListener("change", (value, _, isInitial) => {
            if (isInitial && !value) { /* No initial loader version. */
                this.loaderType._onSelect("None");
            }
            if (!isInitial && this.instance?.version) {
                if (this.instance.version[this.loaderType.value()] !== value) {
                    this._saveLocal();
                }
            }
        });
    }

    _onLaunchOrTerminate() {
        if (this.instance) {
            const { activeState } = this.instance;
            if (activeState["state"] === InstanceState.Idle) {
                this.instance.launch();
            } else {
                this.instance.terminate();
            }
        }
    }

    _onDelete() {
        this.instance.delete(false);
    }

    _openFolder() {
        this.instance.openFolder();
    }

    _toggle(property, attribute, isOn) {
        if (typeof isOn === "undefined") {
            isOn = this[property].getAttribute(attribute) !== "true";
        }
        this[property].setAttribute(attribute, isOn);
        return isOn;
    }

    _toggleSettings(isVisible) {
        this._toggle("instanceSettings", "visible", isVisible);
    }

    _toggleDanger(isVisible) {
        if (this._toggle("dangerZone", "visible", isVisible)) {
            this.dangerText.textContent = "Show Less";
        } else {
            this.dangerText.textContent = "Show More";
        }
    }

    _traverseGallery(direction) {
        if (this.instance.traverseGallery(direction)) {
            this.galleryImage.classList.remove("visible");
        }
        this._updateGallery();
    }

    _updateGallery() {
        let { galleryIndex, config: { manifest } } = this.instance;
        if (Array.isArray(manifest["gallery"]) && manifest["gallery"].length > 0) {
            this.galleryWrapper.setAttribute("go-right", galleryIndex + 1 < manifest["gallery"].length);
            this.galleryWrapper.setAttribute("go-left", galleryIndex - 1 >= 0);
            this.galleryImage.src = manifest["gallery"][galleryIndex];
        } else {
            this.galleryImage.src = "../../assets/images/gallery-placeholder.png";
            this.galleryWrapper.setAttribute("go-left", false);
            this.galleryWrapper.setAttribute("go-right", false);
        }
    }

    _loadGallery() {
        this.galleryImage.classList.add("visible");
    }

    _firstUpdate() {
        this.galleryImage.classList.remove("visible");
        this.galleryImage.classList.add("no-duration");
        setTimeout(() => {
            this.galleryImage.classList.remove("no-duration");
        }, 100); /* If loaded in 100ms, do not show load spinner. */
        this._toggleDanger(false);
    }

    _populateMinecraft() {
        this.minecraftVersion.populate(
            this.instance.getMinecraftList()
                .map(x => x.id)
        );
    }

    _populateForge(vanilla) {
        this.loaderVersion.populate(
            this.instance.getForgeList(vanilla)
                .map(x => x.id)
        );
    }

    _populateFabric(vanilla) {
        this.loaderVersion.populate(
            this.instance.getFabricList(vanilla)
                .map(x => x.id)
        );
    }

    _loaderChange(vanilla) {
        if (this.loaderType.value() === "forge") {
            this._populateForge(vanilla);
        } else if (this.loaderType.value() === "fabric") {
            this._populateFabric(vanilla);
        }
    }

    _saveLocal() {
        let version = {
            id: "1.0.0",
            vanilla: this.minecraftVersion.value()
        };
        if (this.loaderType.value() !== "vanilla") {
            version[this.loaderType.value()] = this.loaderVersion.value();
        }
        this.instance?.saveLocal({ version });
    }

    display(instance) {
        this.instance = instance;
        this._firstUpdate();
        this.update();
        this.show();
    }

    update(eventSender) {

        const { activeState } = this.instance;

        this.instance.updateProgress(this.progressBar);

        if (activeState["state"] === InstanceState.Idle) {

            if (!eventSender || this.instance === eventSender) {
                this.instance.loadSettings(this.instanceSettings);   
            }

            /* Start Button */
            this.startButton.textContent = "Launch";
            this.startButton.classList.add("button-green");
            this.startButton.classList.remove("button-blue");
            this.startButton.removeAttribute("disabled");

            /* Progress Bar */
            this.progressWrapper.setAttribute("visible", false);

            /* Options Button */
            this.optionsButton.disabled = false;

            if (typeof activeState["exitCode"] !== "undefined" || typeof activeState["exitError"] !== "undefined") {
                this.progressWrapper.setAttribute("visible", true);
                this.progressBar.get().setAttribute("visible", false);
            }

        } else {

            /* Start Button */
            if (activeState["enableTerminate"]) {
                this.startButton.textContent = "Terminate";
                this.startButton.classList.add("button-blue");
                this.startButton.classList.remove("button-green");
                this.startButton.removeAttribute("disabled");
            } else {
                this.startButton.setAttribute("disabled", "true");
            }

            this.progressWrapper.setAttribute("visible", true);
            if (activeState["state"] === InstanceState.Running) {
                this.progressBar.get().setAttribute("visible", false);
                activeState["progressText"] = `✅ The Process is running. PID: ${activeState["processId"]}`;
            } else {
                this.progressBar.get().setAttribute("visible", true);
            }

            /* Options Button */
            this._toggleSettings(false);
            this.optionsButton.disabled = true;
            
            /* Danger Zone */
            this._toggleDanger(false);

        }

        if (activeState["state"] === InstanceState.Fetching) {
            let allowedLength = 58;
            if (typeof activeState["progressText"] === "string") {
                if (typeof activeState["progressSize"] === "string") {
                    allowedLength -= activeState["progressSize"].length;
                }
                activeState["progressText"] = activeState["progressText"].substring(0, allowedLength + 1);
            }
            if (activeState["progressValue"] == 100) {
                activeState["progressText"] = "Extracting";
            }
        } else {
            activeState["progressSize"] = "";
        }

        this.progressText.textContent = activeState["progressText"];
        this.progressSize.textContent = activeState["progressSize"];

        const { config, manifest } = this.instance.config;

        if (this.instance.isLocal) {
            [this.instanceTitle, this.instanceDescription]
                .forEach(x => x.setAttribute("contenteditable", true));
        } else {
            [this.instanceTitle, this.instanceDescription]
                .forEach(x => x.removeAttribute("contenteditable"));
        }

        this.instanceTitle.textContent = manifest["name"] || "Untitled";
        this.instanceDescription.textContent = manifest["description"] || "";
        this.instanceCreators.textContent = (manifest["creators"] || []).join(", ");
        this.instanceCredits.textContent = (manifest["credits"] || []).join(", ");

        if (!this.instance.isLocal) {
            this.instanceVersion.textContent = config["version"] || "Any";
            this.instanceSettings.setAttribute("hide-local", true);
        } else {

            this.instanceVersion.textContent = "Local";
            this.instanceSettings.setAttribute("hide-local", false);
            this._populateMinecraft();

            const { vanilla, forge, fabric } = this.instance.version;
            if (vanilla) {
                this.minecraftVersion._onSelect(vanilla);
            }
            if (forge) {
                this.loaderType._onSelect("Forge");
                this._populateForge(vanilla);
                this.loaderVersion._onSelect(forge);
            } else if (fabric) {
                this.loaderType._onSelect("Fabric");
                this._populateFabric(vanilla);
                this.loaderVersion._onSelect(fabric);
            } else {
                this.loaderType._onSelect("None");
            }

        }

        this.instanceChangelog.innerHTML = "";
        for (const version of this.instance.config.manifest["versions"]) {
            if (typeof version["changelog"] === "string") {
                this.instanceChangelog.innerHTML += `<b>${version["id"]}</b>\n${version["changelog"]}\n`;
            }
        }

        this._updateGallery();

    }

}
