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

class InputElement {

    static lastId = 0;
    static registry = [];

    constructor(className, options) {
        this.id = InputElement.lastId++;
        this.className = className;
        this.options = options;
        this._createElement();
    }

    _createElement() {

        this.parentElement = document.createElement("div");
        this.parentElement.classList.add(
            "input-parent-element",
            `input-${this.className}`
        );

        this.inputBox = document.createElement("input");
        this.inputBox.setAttribute("input-id", this.id);
        this.inputBox.setAttribute("type", "text");
        this.inputBox.classList.add("input-box");
        this.previousValue = null;

        if (this.options["default"]) {
            this.inputBox.value = this.options["default"];
        }

        this.parentElement.appendChild(this.inputBox);
        InputElement.registry.push(this);

    }

    save() {
        this.previousValue = this.value();
    }

    revert() {
        if (this.previousValue !== null) {
            this.inputBox.value = this.previousValue;
        }
    }

    insert(position, targetElement) {
        targetElement.insertAdjacentElement(position, this.parentElement);
    }

    put(otherElement) {
        otherElement.appendChild(this.parentElement);
    }

    destroy() {
        this.parentElement.remove();
        InputElement.registry = InputElement.registry.filter(element => element !== this);
    }

    value() { return this.inputBox.value; }

}

class SelectBox extends InputElement {

    static visibleMenu = null;

    /*
        Options Example
        options: { "Enabled": true, "Disabled": false }
    */
    constructor(options) {
        super("select-box", options);
        this.isMenuOpen = false;
        this.hasFocus = false;
    }

    _createElement() {

        super._createElement();
        this.inputBox.setAttribute("readonly", true);

        const arrowDown = document.createElement("div");
        arrowDown.addEventListener("click", () => { this.hasFocus = true; });
        arrowDown.classList.add("arrow-down");

        this.selectMenu = document.createElement("div");
        this.selectMenu.classList.add("select-menu");

        let firstOption = null;
        let defaultOption = null;
        for (const [label, value] of Object.entries(this.options["options"])) {
            const option = document.createElement("div");
            option.classList.add("menu-option");
            option.textContent = label;
            this.selectMenu.appendChild(option);
            if (firstOption == null) { firstOption = option; }
            if (this.options["default"] == value) {
                defaultOption = option;
            }
        }

        if (defaultOption) {
            this._onSelect(defaultOption);
        } else {
            if (firstOption) {
                this._onSelect(firstOption);
            }
        }

        this.parentElement.appendChild(arrowDown);
        this.parentElement.appendChild(this.selectMenu);

        const changeState = () => {
            this.isMenuOpen ? this._hideMenu() : this._showMenu();
            if (this.isMenuOpen) {
                SelectBox.visibleMenu = this;
            }
        }

        this.parentElement.addEventListener("click", (event) => {
            if (event.target && event.target.classList.contains("menu-option")) {
                this._onSelect(event.target);
            }
            changeState();
        });

        this.parentElement.addEventListener("focusin", () => { this.hasFocus = true; });
        this.parentElement.addEventListener("focusout", () => { this.hasFocus = false; });

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
        this.inputBox.value = option.textContent;
        this.selectedValue = this.options["options"][option.textContent];
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
    InputElement.registry.filter(element => element.className === "select-box").forEach((selectBox) => {
        if (SelectBox.visibleMenu != selectBox || !selectBox.hasFocus) {
            selectBox._hideMenu();
        }
    });
});

class PathBox extends InputElement {

    /*
        Options Example
        options: { isDirectory: true, fileTypes: [] }
    */
    constructor(options) {
        super("path-box", options);
    }

    _createElement() {

        super._createElement();

        const browseButton = document.createElement("div");
        browseButton.classList.add("browse-button");
        browseButton.textContent = "...";

        browseButton.addEventListener("click", this.openDialog.bind(this));

        this.parentElement.appendChild(browseButton);

    }

    _onChange(filePath) {
        this.inputBox.value = filePath;
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
    InputElement.registry.find(x => x.id === inputId)?._onChange(filePath);
});
