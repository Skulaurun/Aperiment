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

/*
 *  This code was taken from Gamebook 2 (2019),
 *  I honor this project with all my mighty power!
 *  - https://www.skulaurun.eu/gamebook2
 */

import { PopupType } from "../../GlobalEnum.js";

export default class Popup {
    
    static MaxQueueLength = 5;
    static AlertDuration = 6;

    constructor(parent) {
        this.parent = parent || document.body;
        this.queue = [];
    }

    popElement(element) {

        element = element || this.queue.pop();

        if (element) {

            element.classList.remove("shown");
            element.classList.add("hidden");
    
            setTimeout(() => {
    
                element.remove();

                if (this.queue.length == 0) {
                    let root = document.getElementById("popup-queue");
                    if (root != null) { root.remove(); }
                }
    
            }, 250);
    
        }

        return element;

    }

    injectElement(element) {

        let root = document.getElementById("popup-queue");

        if (!root) {
            root = document.createElement("div");
            root.classList.add("popup-queue");
            root.id = "popup-queue";
            this.parent.appendChild(root);
        }

        if (this.queue.length >= Popup.MaxQueueLength) {
            this.popElement();
        }

        root.insertBefore(element, root.firstChild);
        setTimeout(() => {
            element.classList.remove("hidden");
            element.classList.add("shown");
        }, 250);
        this.queue.unshift(element);

        setTimeout(() => {
            this.popElement();
        }, Popup.AlertDuration * 1000);

        element.addEventListener("click", (e) => {
            e = e || window.event;
            let target = e.target || e.srcElement;
            this.popElement(target);
        });

    }

    alert(content, type) {
        
        let box = document.createElement("div");
        box.classList.add("unselectable");
        box.classList.add("popup-alert");
        box.classList.add("hidden");
        box.classList.add(type || PopupType.Info);
        box.textContent = content;

        this.injectElement(box);

    }

}
