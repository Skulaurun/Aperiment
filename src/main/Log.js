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

const path = require("path");
const log4js = require("log4js");

const Global = require("./Global.js");

log4js.configure({
    appenders: {
        console: {
            type: "stdout",
            layout: {
                type: "pattern",
                pattern: "[%r] [%c] [%[%p%]]: %m"
            }
        },
        file: {
            type: "dateFile",
            fileNameSep: "-",
            filename: path.join(
                Global["USER_DATA"],
                `logs/${Global["PRODUCT_NAME"].toLowerCase()}.log`
            ),
            pattern: "yyyy-MM-dd",
            keepFileExt: true,
            compress: true,
            layout: {
                type: "pattern",
                pattern: "[%r] [%c] [%p]: %m"
            }
        }
    },
    categories: {
        default: { appenders: ["console", "file"], level: "info", enableCallStack: true }
    }
});

module.exports = class Log {
    static getLogger(category) {
        return log4js.getLogger(category);
    }
    static onShutdown(callback) {
        log4js.shutdown(callback);
    }
};
