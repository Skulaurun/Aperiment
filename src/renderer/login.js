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

document.addEventListener("DOMContentLoaded", () => {

    let username = document.getElementById("username");
    let password = document.getElementById("password");
    let submit = document.getElementById("submit");
    let modeMenu = document.getElementById("mode-menu");

    submit.addEventListener("click", () => {

        let online = modeMenu.selectedIndex === 0 ? true : false;
        
        if (username.value != "" && (password.value != "" || !online)) {
            ipcRenderer.send("user-login", online, username.value, password.value);
        }

    });

    let process = function(event) {

        switch (event.key) {

            case "ArrowDown":
                if (event.target.id == "username") {
                    password.focus();
                }
                break;

            case "ArrowUp":
                if (event.target.id == "password") {
                    username.focus();
                }
                break;

            case "Enter":
                submit.click();
                break;
        }

    };

    username.addEventListener("keydown", process);
    password.addEventListener("keydown", process);

    username.focus();

});
