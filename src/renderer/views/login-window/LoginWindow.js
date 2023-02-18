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

import Global from "../../components/global/Global.js";

/*
    Electron does not support ES6 modules,
    so we need to use CommonJS require() here.
*/
const { ipcRenderer } = require("electron");

document.addEventListener("DOMContentLoaded", () => {

    Global.addWindowControls([
        Global.SvgType.MinimizeButton,
        Global.SvgType.CloseButton
    ]);

    let username = document.getElementById("name-field");
    let submit = document.getElementById("submit-button");

    let microsoftButton = document.getElementById("login-with-microsoft");
    let internetButton = document.getElementById("i-dont-have-internet");

    let loginIntroduction = document.getElementById("login-introduction");

    let option1 = document.getElementById("option-1");
    let option2 = document.getElementById("option-2");

    let goBack = () => {
        loginIntroduction.classList.remove("option-hidden");
        option1.classList.add("option-hidden");
        option2.classList.add("option-hidden");
    };

    document.getElementById("back-button").addEventListener("click", goBack);

    microsoftButton.addEventListener("click", () => {

        loginIntroduction.classList.add("option-hidden");
        option1.classList.remove("option-hidden");

        const element = option1.querySelector("webview");
        if (element) {
            element.remove();
        }

        const webview = document.createElement("webview");
        webview.classList.add("microsoft-web");
        webview.src = "https://login.live.com/oauth20_authorize.srf?client_id=c1348caf-f18f-49d9-b63a-8e5cb0f7dd3b&redirect_uri=http://localhost:46969/&response_type=code&scope=XboxLive.signin%20XboxLive.offline_access&prompt=select_account&cobrandid=8058f65d-ce06-4c30-9559-473c9275a65d";

        option1.appendChild(webview);

    });

    internetButton.addEventListener("click", () => {
        loginIntroduction.classList.add("option-hidden");
        option2.classList.remove("option-hidden");
        username.focus();
    });

    microsoftButton.focus();

    submit.addEventListener("click", () => {
        if (username.value) {
            ipcRenderer.send("user-login", username.value);
        }
    });

    let process = function(event) {
        switch (event.key) {
            case "Enter":
                submit.click();
                break;
        }
    };

    username.addEventListener("keydown", process);

    ipcRenderer.on("auth-cancel", (event, error) => {
        goBack();
    });

    ipcRenderer.on("auth-success", () => {
        goBack();
    });

});
