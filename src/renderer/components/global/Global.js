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

export default class Global {

    static SvgNS = "http://www.w3.org/2000/svg";
    static SvgType = Object.freeze({ "CloseButton": 0, "MaximizeButton": 1, "MinimizeButton": 2 });

    static createSvg(type) {
        const svg = document.createElementNS(Global.SvgNS, "svg");
        switch (type) {
            case Global.SvgType.CloseButton:
                const line1 = document.createElementNS(Global.SvgNS, "line");
                const line2 = document.createElementNS(Global.SvgNS, "line");
                Object.entries({"x1": "30%", "y1": "30%", "x2": "70%", "y2": "70%"})
                    .forEach(([key, value]) => { line1.setAttribute(key, value); });
                Object.entries({"x1": "70%", "y1": "30%", "x2": "30%", "y2": "70%"})
                    .forEach(([key, value]) => { line2.setAttribute(key, value); });
                svg.classList.add("close-button");
                svg.appendChild(line1);
                svg.appendChild(line2);
                return svg;
            case Global.SvgType.MaximizeButton:
                const rect = document.createElementNS(Global.SvgNS, "rect");
                Object.entries({"x": "30%", "y": "30%", "width": "40%", "height": "40%", "fill": "none"})
                    .forEach(([key, value]) => { rect.setAttribute(key, value); });
                svg.classList.add("maximize-button");
                svg.appendChild(rect);
                return svg;
            case Global.SvgType.MinimizeButton:
                const line = document.createElementNS(Global.SvgNS, "line");
                Object.entries({"x1": "30%", "y1": "50%", "x2": "70%", "y2": "50%"})
                    .forEach(([key, value]) => { line.setAttribute(key, value); });
                svg.classList.add("minimize-button");
                svg.appendChild(line);
                return svg;
        }
        return null;
    }

    static addWindowControls(controls) {

        const controlObject = {};
        controls.forEach((control) => {
            switch (control) {
                case Global.SvgType.MinimizeButton:
                    controlObject["window-minimize"] = Global.createSvg(control);
                    break;
                case Global.SvgType.MaximizeButton:
                    controlObject["window-maximize"] = Global.createSvg(control);
                    break;
                case Global.SvgType.CloseButton:
                    controlObject["window-close"] = Global.createSvg(control);
                    break;
            }
        });

        Object.entries(controlObject).forEach(([event, element]) => {
            element.addEventListener("click", () => {
                ipcRenderer.send(event);
            });
            document.getElementById("window-controls")
                ?.appendChild(element);
        });

    }

}
