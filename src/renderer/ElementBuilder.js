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

export default class ElementBuilder {

    static build(buildTemplate, assignObject) {
        if (Array.isArray(buildTemplate)) {
            return buildTemplate.map((item) => {
                return ElementBuilder.build(item, assignObject);
            });
        } else if (typeof buildTemplate === "object") {
            let element = {};
            if (buildTemplate["type"]) {
                element = document.createElement(buildTemplate["type"]);
            } else if (buildTemplate["element"]) {
                if (buildTemplate["element"] instanceof CustomElement) {
                    element = buildTemplate["element"].get();
                } else {
                    element = buildTemplate["element"];
                }
            } else {
                element = document.createElement("div");
            }
            Object.entries(buildTemplate["attributeList"] || {}).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
            buildTemplate["classList"]?.forEach((className) => {
                element.classList.add(className);
            });
            buildTemplate["children"]?.forEach((child) => {
                element.appendChild(ElementBuilder.build(child, assignObject));
            });
            Object.entries(buildTemplate["listeners"] || {}).forEach(([event, listener]) => {
                element.addEventListener(event, listener);
            });
            ["id", "style", "value", "innerHTML", "textContent"].forEach((property) => {
                if (buildTemplate[property]) {
                    element[property] = buildTemplate[property];
                }
            });
            if (buildTemplate["assign"]) {
                if (buildTemplate["element"] instanceof CustomElement) {
                    assignObject[buildTemplate["assign"]] = buildTemplate["element"];
                } else {
                    assignObject[buildTemplate["assign"]] = element;
                }
            }
            return element;
        }
    }

    static buildTo(parentElement, buildTemplate, assignObject) {
        [...ElementBuilder.build(buildTemplate, assignObject)].forEach((element) => {
            parentElement.appendChild(element);
        });
    }

}
