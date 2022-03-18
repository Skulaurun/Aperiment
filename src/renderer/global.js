/*
 *
 *   A-Periment - Custom minecraft launcher
 *   Copyright (C) 2020 Adam Charvát
 *
 *   A-Periment is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   A-Periment is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with a-periment. If not, see <https://www.gnu.org/licenses/>.
 *
 */

const electron = require("electron");
const { ipcRenderer } = electron;

function removeEmptyNodes(node) {

    for(let i = 0; i < node.childNodes.length; i++) {

        let child = node.childNodes[i];

        if (child.nodeType === 8 || (child.nodeType === 3 && !/\S/.test(child.nodeValue))) {
            node.removeChild(child);
            i--;
        }
        else if (child.nodeType === 1) {
            removeEmptyNodes(child);
        }
        
    }

}

document.addEventListener("DOMContentLoaded", () => {

    removeEmptyNodes(document);

    let minimizeButton = document.querySelector(".window-controls > svg[name=minimize]");
    if (minimizeButton) {
        minimizeButton.addEventListener("click", () => {
            ipcRenderer.send("window-minimize");
        });
    }

    let maximizeButton = document.querySelector(".window-controls > svg[name=maximize]");
    if (maximizeButton) {
        maximizeButton.addEventListener("click", () => {
            ipcRenderer.send("window-maximize");
        });
    }

    let closeButton = document.querySelector(".window-controls > svg[name=close]");
    if (closeButton) {
        closeButton.addEventListener("click", () => {
            ipcRenderer.send("window-close");
        });
    }

});
