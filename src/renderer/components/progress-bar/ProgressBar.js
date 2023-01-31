import { CustomElement } from "../../ElementBuilder.js";
import { ProgressBarMode } from "../../Enum.js";

export default class ProgressBar extends CustomElement {

    constructor() {
        super({ className: "progress-bar" });
    }

    _createElement() {
        super._createElement([{
            type: "div",
            assign: "progressBar",
            classList: ["progress-bar"],
            children: [
                { type: "div", classList: ["line", "infinite-increase"] },
                { type: "div", classList: ["line", "infinite-decrease"] },
                { type: "div", classList: ["line", "progress"], assign: "progressLine" }
            ]
        }]);
        this.setValue(0);
        this.setMode(ProgressBarMode.None);
    }

    setMode(mode) {
        switch (mode) {
            case ProgressBarMode.None: mode = "none"; break;
            case ProgressBarMode.Progress: mode = "progress"; break;
            case ProgressBarMode.Infinite: mode = "infinite"; break;
        }
        this.progressBar.setAttribute("mode", mode);
    }

    setValue(value) {
        this.progressLine.style.width = `${value}%`;
    }

}
