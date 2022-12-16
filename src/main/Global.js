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

const os = require("os");
const path = require("path");
const { app } = require("electron");

const PRODUCT_NAME = "Aperiment";
const COMPANY_NAME = "Skulaurun";

function getUserData() {
    if (!process.env.APER_DATA_HOME) {
        if (os.type() === "Windows_NT") {
            return path.join(
                os.homedir(),
                `AppData/LocalLow/${COMPANY_NAME}/${PRODUCT_NAME}`
            );
        } else if (os.type() === "Linux") {
            return path.join(
                os.homedir(),
                `.${PRODUCT_NAME.toLowerCase()}`
            );
        } else if (os.type() === "Darwin") {
            return path.join(
                app.getPath('appData'),
                PRODUCT_NAME
            )
        }
    }
    return process.env.APER_DATA_HOME || app.getPath("userData");
}

module.exports = {

    PRODUCT_NAME: PRODUCT_NAME,
    COMPANY_NAME: COMPANY_NAME,
    USER_DATA: getUserData(),

    IS_PACKAGED: app.getAppPath().includes("app.asar"),
    LEGACY_USER_DATA: path.join(app.getPath("appData"), "a-periment")

};
