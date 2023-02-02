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

const { ipcRenderer } = require("electron");

import CustomElement from "../../CustomElement.js";
export class InputBox extends CustomElement {

    constructor(options) {
        super(
            Object.assign({ className: "input-box" }, options)
        );
    }

    _createElement(children = []) {

        super._createElement([
            {
                type: "input",
                attributeList: {
                    "type": "text"
                },
                classList: ["input-box"],
                assign: "inputBox"
            },
            ...children
        ]);

        this.previousValue = null;
        if (this.options["default"]) {
            this.inputBox.value = this.options["default"];
        }

    }

    save() {
        this.previousValue = this.value();
    }

    revert() {
        if (this.previousValue !== null) {
            this.inputBox.value = this.previousValue;
        }
    }

    value() {
        return this.inputBox.value;
    }

}

export class SelectBox extends InputBox {

    static visibleMenu = null;

    /*
        Options Example
        options: { "Enabled": true, "Disabled": false }
    */
    constructor(options) {
        super(
            Object.assign({ className: "select-box" }, options)
        );
        this.isMenuOpen = false;
        this.hasFocus = false;
    }

    _createElement() {

        super._createElement([
            {
                type: "div",
                classList: ["arrow-down"],
                listeners: {
                    "click": () => { this.hasFocus = true; }
                }
            },
            {
                type: "div",
                classList: ["select-menu"],
                assign: "selectMenu",
                children: Object.keys(this.options["options"]).map((label) => {
                    return {
                        type: "div",
                        classList: ["menu-option"],
                        textContent: label
                    }
                })
            }
        ]);

        const firstOption = Object.keys(this.options["options"])
            .shift();
        const [defaultOption, _] = Object.entries(this.options["options"])
            .find(([_, value]) => this.options["default"] === value );

        if (defaultOption) {
            this._onSelect(defaultOption);
        } else {
            if (firstOption) {
                this._onSelect(firstOption);
            }
        }

        const changeState = () => {
            this.isMenuOpen ? this._hideMenu() : this._showMenu();
            if (this.isMenuOpen) {
                SelectBox.visibleMenu = this;
            }
        }

        this.inputBox.setAttribute("readonly", true);
        this.customElement.addEventListener("click", (event) => {
            if (event.target && event.target.classList.contains("menu-option")) {
                this._onSelect(event.target.textContent);
            }
            changeState();
        });

        this.customElement.addEventListener("focusin", () => { this.hasFocus = true; });
        this.customElement.addEventListener("focusout", () => { this.hasFocus = false; });

    }

    _showMenu() {
        this.isMenuOpen = true;
        this.selectMenu.classList.add("select-visible");
    }

    _hideMenu() {
        this.isMenuOpen = false;
        this.selectMenu.classList.remove("select-visible");
    }

    _onSelect(option) {
        this.inputBox.value = option;
        this.selectedValue = this.options["options"][option];
    }

    save() {
        super.save();
        this.previousLabel = this.inputBox.value;
    }

    revert() {
        if (this.previousValue !== null) {
            this.selectedValue = this.previousValue;
            this.inputBox.value = this.previousLabel;
        }
    }

    value() {
        return this.selectedValue;
    }

}

document.addEventListener("click", () => {
    CustomElement.registry.filter(element => element.className === "select-box").forEach((selectBox) => {
        if (SelectBox.visibleMenu != selectBox || !selectBox.hasFocus) {
            selectBox._hideMenu();
        }
    });
});

export class PathBox extends InputBox {

    /*
        Options Example
        options: { isDirectory: true, fileTypes: [] }
    */
    constructor(options) {
        super(
            Object.assign({ className: "path-box" }, options)
        );
    }

    _createElement() {
        super._createElement([{
            type: "div",
            classList: ["browse-button"],
            textContent: "...",
            listeners: {
                "click": this.openDialog.bind(this)
            }
        }]);
    }

    _onChange(filePath) {
        this.inputBox.value = filePath;
        this.inputBox.focus();
    }

    openDialog() {
        ipcRenderer.send(
            "open-file",
            this.id,
            this.options["isDirectory"],
            this.options["fileTypes"]
        );
    }

}

ipcRenderer.on("open-file", (_, inputId, filePath) => {
    CustomElement.registry.find(x => x.id === inputId)?._onChange(filePath);
});
