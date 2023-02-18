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

export const InstanceState = Object.freeze({
    "Idle": 0,
    "Preparing": 1,
    "Fetching": 2,
    "Running": 3
});

export const ProgressBarMode = Object.freeze({
    "None": 0,
    "Progress": 1,
    "Infinite": 2
});

export const InputValue = Object.freeze({
    "File": 0,
    "Directory": 1,
    "Boolean": 2,
    "Text": 3
});

export const PopupType = Object.freeze({
    "Success": "popup-success",
    "Info": "popup-info",
    "Warning": "popup-warning",
    "Error": "popup-error"
});

export const InputType = Object.freeze({

    /* Aperiment Settings */
    "launcher.autoUpdate": {
        name: "Auto Update",
        value: InputValue.Boolean
    },
    "launcher.allowPrerelease": {
        name: "Beta Versions",
        value: InputValue.Boolean
    },
    "java": {
        name: "Java Executable",
        value: InputValue.File,
        fileTypes: [
            { name: "Java Executable", extensions: ["exe"] }
        ]
    },
    "minecraftDirectory": {
        name: "Minecraft Directory",
        value: InputValue.Directory
    },

    /* Modpack Properties */
    "jvmArguments": { value: InputValue.TEXT }

});
