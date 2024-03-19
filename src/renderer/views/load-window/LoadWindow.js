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

/*
    Electron does not support ES6 modules,
    so we need to use CommonJS require() here.
*/
const { ipcRenderer } = require("electron");

let statusBar = null;
document.addEventListener("DOMContentLoaded", () => {

    statusBar = document.getElementById("status-bar");
    statusBar.setValue = function(value) {
        this.children[0].style.width = `${value}%`;
    }
    statusBar.show = function() {
        this.style.display = "block";
    }

});

ipcRenderer.on("update-available", () => {
    statusBar.show();
});

ipcRenderer.on("update-downloaded", () => {
    statusBar.setValue(100);
});

ipcRenderer.on("update-download-progress", (event, progress) => {
    statusBar.setValue(Math.round(progress.percent));
});
