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

const { ipcRenderer } = electron;

document.addEventListener("DOMContentLoaded", () => {

    var username = document.getElementById("username");
    var password = document.getElementById("password");
    var submit = document.getElementById("submit");
    var modeMenu = document.getElementById("mode-menu");

    submit.addEventListener("click", () => {

        var online = modeMenu.selectedIndex === 0 ? true : false;
        
        if (username.value != "" && (password.value != "" || !online)) {
            ipcRenderer.send("user-login", online, username.value, password.value);
        }

    });

});
