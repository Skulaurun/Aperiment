import Global from "../global/Global.js";
import { CustomElement } from "../../ElementBuilder.js";
import { InputBox, PathBox } from "../../components/input/Input.js";
import ProgressBar from "../progress-bar/ProgressBar.js";
import { InputType, InstanceState } from "../../Enum.js";

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
                "click": (event) => {
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
                    { type: "h2", classList: ["instance-title"], assign: "instanceTitle" },
                    {
                        type: "div",
                        classList: ["gallery-wrapper"],
                        assign: "galleryWrapper",
                        children: [
                            {
                                type: "img",
                                classList: ["gallery-image"],
                                assign: "galleryImage"
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
                                attributeList: { path: "config.runtime.jvmArguments" },
                                children: [
                                    { type: "td", textContent: "JVM Arguments" },
                                    {
                                        element: new InputBox({ default: "" })
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
                                            fileTypes: InputType["java"]["fileTypes"]
                                        })
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
                            { type: "p", assign: "instanceDescription" },
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

    _toggleSettings(isVisible) {
        if (typeof isVisible === "undefined") {
            isVisible = this.instanceSettings.getAttribute("visible") !== "true";
        }
        this.instanceSettings.setAttribute("visible", isVisible);
    }

    _traverseGallery(direction) {
        this.instance.traverseGallery(direction);
        this.updateGallery();
    }

    updateGallery() {
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

    display(instance) {
        this.instance = instance;
        this.update();
        this.show();
    }

    update() {

        const { activeState } = this.instance;

        this.instance.updateProgress(this.progressBar);

        if (activeState["state"] === InstanceState.Idle) {

            this.instance.loadSettings(this.instanceSettings);

            /* Start Button */
            this.startButton.textContent = "Launch";
            this.startButton.classList.add("button-green");
            this.startButton.classList.remove("button-blue");

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
            this.startButton.textContent = "Terminate";
            this.startButton.classList.add("button-blue");
            this.startButton.classList.remove("button-green");

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

        }

        if (activeState["state"] === InstanceState.Fetching) {
            let allowedLength = 60;
            if (typeof activeState["progressText"] === "string") {
                if (typeof activeState["progressSize"] === "string") {
                    allowedLength -= activeState["progressSize"].length;
                }
                activeState["progressText"] = activeState["progressText"].substring(0, allowedLength + 1);
            }
        }

        if (activeState["state"] !== InstanceState.Fetching) {
            activeState["progressSize"] = "";
        }

        this.progressText.textContent = activeState["progressText"];
        this.progressSize.textContent = activeState["progressSize"];

        const { config, manifest } = this.instance.config;

        this.instanceTitle.textContent = manifest["name"] || "Untitled";
        this.instanceDescription.textContent = manifest["description"] || "";
        this.instanceCreators.textContent = (manifest["creators"] || []).join(", ");
        this.instanceCredits.textContent = (manifest["credits"] || []).join(", ");

        this.instanceVersion.textContent = config["version"] || "Any";

        this.instanceChangelog.innerHTML = "";
        for (const version of this.instance.config.manifest["versions"]) {
            if (typeof version["changelog"] === "string") {
                this.instanceChangelog.innerHTML += `<b>${version["id"]}</b>\n${version["changelog"]}\n`;
            }
        }

        this.updateGallery();

    }

}
