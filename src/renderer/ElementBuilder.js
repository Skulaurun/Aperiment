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
