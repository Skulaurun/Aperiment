import { CustomElement } from "../../ElementBuilder.js";
import ProgressBar from "../progress-bar/ProgressBar.js";

export default class InstanceIcon extends CustomElement {

    constructor(options) {
        super(
            Object.assign({ className: "instance-icon" }, options)
        );
    }

    _createElement() {
        super._createElement([{
            type: "div",
            classList: ["instance-icon"],
            attributeList: {
                "id": this.options["instanceConfig"]["id"],
                "name": this.options["instanceConfig"]["manifest"]["name"]
            },
            children: [
                {
                    type: "img",
                    attributeList: {
                        "src": "../../assets/images/modpack.png"
                    },
                    assign: "imageIcon"
                },
                {
                    type: "div",
                    classList: ["status-circle"],
                    attributeList: {
                        "state": "default"
                    },
                    assign: "statusCircle"
                },
                {
                    element: new ProgressBar(),
                    assign: "progressBar"
                }
            ]
        }]);
    }

}
