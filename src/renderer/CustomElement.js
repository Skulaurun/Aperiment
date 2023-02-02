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
