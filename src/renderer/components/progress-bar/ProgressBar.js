/*
 *
 *   Aperiment - Custom Minecraft Launcher
 *   Copyright (C) 2020 - 2024 Adam Charvát
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
import { ProgressBarMode } from "../../GlobalEnum.js";

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
