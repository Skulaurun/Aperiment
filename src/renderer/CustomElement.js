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

import ElementBuilder from "./ElementBuilder.js";

export default class CustomElement {

    static lastId = 0;
    static registry = [];

    constructor(options) {
        this.options = options;
        this.className = options["className"] || "default";
        this.id = CustomElement.lastId++;
        this._createElement();
    }

    _createElement(children) {
        ElementBuilder.build({
            type: "div",
            assign: "customElement",
            classList: ["custom-element", `custom-${this.className}`],
            attributeList: { "custom-id": this.id },
            children: children
        }, this);
        CustomElement.registry.push(this);
    }

    remove() {
        CustomElement.registry = CustomElement.registry
            .filter(x => x.id !== this.id);
        this.customElement.remove();
    }

    appendChild(element) {
        this.customElement.appendChild(element);
    }

    get() { return this.customElement; }

}
