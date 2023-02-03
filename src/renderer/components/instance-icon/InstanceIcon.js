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

import CustomElement from "../../CustomElement.js";
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

    updateNoCache(url) {
        this.imageIcon.src = `${url}?${new Date().getTime()}`;
    }

}
