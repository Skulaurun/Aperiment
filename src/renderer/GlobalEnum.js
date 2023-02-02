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
