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

const fs = require("fs");
const path = require("path");
const http = require("http");
const axios = require("axios");
const { parse: parseUrl } = require("url");
const { autoUpdater } = require("electron-updater");
const { app, screen, ipcMain, shell, dialog, BrowserWindow } = require("electron");

const Global = require("./Global.js");
const Log = require("./Log.js");
const Config = require("./Config.js");
const User = require("./auth/User.js");
const InstanceManager = require("./minecraft/InstanceManager.js");

const DEVELOPER_MODE = process.argv.includes("--dev");
const log = Log.getLogger("main");

function exitHandler(code) {
    log.info(`Exited with code ${code}.\n`);
}

process.once("exit", exitHandler);
process.once("SIGINT", exitHandler);
process.once("SIGUSR1", exitHandler);
process.once("SIGUSR2", exitHandler);

function crashHandler(error) {

    try {
        dialog.showMessageBoxSync(null, {
            type: "error",
            title: "Aperiment",
            message: "Fatal error has been encountered and the application cannot continue!",
            detail: `${error.stack}`
        });
    } catch {}

    log.fatal(error);
    process.exitCode = 1;

    Log.onShutdown(() => {
        process.emit("exit", process.exitCode);
        app.exit(process.exitCode);
    });

}

process.on("uncaughtException", crashHandler);
process.on("unhandledRejection", crashHandler);

let isLoaded = false;
let commandQueue = [];
let instanceManager, config, user;
let loadWindow, loginWindow, mainWindow;

function findWindow(id) {
    if (mainWindow.webContents.id === id) {
        return mainWindow;
    } else if (loginWindow.webContents.id === id) {
        return loginWindow;
    } else if (loadWindow.webContents.id === id) {
        return loadWindow;
    } else {
        return null;
    }
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

function processArguments(arguments) {

    const url = arguments.find((argument) => {
        return argument.toLowerCase().startsWith("aperiment:")
    });

    if (url) {
        const command = () => {
            try {
                const { host, query } = parseUrl(url, true);
                switch(host) {
                    case 'launch':
                        const instanceConfig = instanceManager.findRemote(query["remote"]);
                        const open = (loadedId) => {
                            mainWindow?.send("force-click", `.menu-item[name=library]`);
                            mainWindow?.send("force-click", `[id='${loadedId}']`);
                        };
                        if (instanceConfig) {
                            open(instanceConfig["id"]);
                        } else {
                            ipcMain.emit("new-instance", {}, query["remote"]);
                            ipcMain.once("new-instance-config", (_, instanceConfig) => {
                                if (instanceConfig && instanceConfig["config"]["remote"] === query["remote"]) {
                                    open(instanceConfig["id"]);
                                }
                            });
                        }
                        break;
                }
            } catch (error) {
                log.error(`Failed to execute command '${url}' with error. ${error}`);
            }
        };
        if (isLoaded) { command(); }
        else { commandQueue.push(command); }
    }

}

app.on("second-instance", (_, argv) => {

    processArguments(argv);

    [loadWindow, loginWindow, mainWindow].forEach((window) => {
        if (window && window.isVisible()) {
            if (window.isMinimized()) {
                window.restore();
            }
            window.focus();
        }
    });

});

app.once("ready", () => {

    fs.promises.mkdir(Global["USER_DATA"], { recursive: true });

    log.info(`Aperiment v.${app.getVersion()} started.`);
    
    loadWindow = new BrowserWindow({
        title: "Aperiment",
        width: 256,
        height: 276,
        frame: false,
        show: false,
        resizable: false,
        minimizable: false,
        maximizable: false,
        transparent: true,
        webPreferences: {
            devTools: DEVELOPER_MODE,
            contextIsolation: false,
            nodeIntegration: true
        }
    });
    
    loadWindow.once("closed", () => {
        loadWindow = null;
    });

    loadWindow.loadFile(
        "src/renderer/views/load-window/LoadWindow.html"
    );

    loadWindow.once("ready-to-show", async () => {

        loadWindow.show();

        const isLegacy = await migrateLegacyConfig(
            path.join(Global["USER_DATA"], "config.json"),
            path.join(Global["LEGACY_USER_DATA"], "config.json")
        );

        config = new Config({
            data: {
                "launcher": {
                    "autoUpdate": true,
                    "allowPrerelease": true
                },
                "minecraftDirectory": path.normalize(Global["USER_DATA"])
            },
            path: path.join(Global["USER_DATA"], "config.json")
        });
        config.isLegacy = () => { return isLegacy; };

        user = new User(path.join(Global["USER_DATA"], "user.json"));
        instanceManager = new InstanceManager(config.get('minecraftDirectory'));
        instanceManager.setDefaultConfig({
            "runtime": {
                "path": "",
                "jvmArguments": ""
            }
        });
        
        autoUpdater.once("update-downloaded", () => {
            loadWindow.send("update-downloaded");
            autoUpdater.quitAndInstall(true, true);
        });

        autoUpdater.once("update-not-available", () => {
            ipcMain.emit("app-start");
        });

        autoUpdater.once("update-available", () => {
            loadWindow.send("update-available");
        });

        autoUpdater.on("download-progress", (progress) => {
            loadWindow.send("update-download-progress", progress);
        });

        if (!DEVELOPER_MODE && config.get("launcher.autoUpdate", true)) {
            autoUpdater.allowPrerelease = config.get("launcher.allowPrerelease", true);
            autoUpdater.checkForUpdates().catch((error) => {
                log.error(`Could not check for updates.\n ${error.stack}`);
                ipcMain.emit("app-start");
            });
        } else {
            ipcMain.emit("app-start");
        }

    });

});

ipcMain.once("app-start", () => {

    processArguments(process.argv);

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    loginWindow = new BrowserWindow({
        title: "Aperiment",
        width: Math.round(width / 4),
        height: Math.round(height / 2),
        show: false,
        frame: false,
        resizable: false,
        webPreferences: {
            devTools: DEVELOPER_MODE,
            contextIsolation: false,
            nodeIntegration: true,
            webviewTag: true
        }
    });

    const server = http.createServer(async (req, res) => {

        if (user.isAuthenticated) {
            return;
        }

        const query = parseUrl(req.url, true).query;
        if (query["code"]) {
            try {

                await user.login(query["code"], true);
                loginWindow.send("auth-success");

                mainWindow.show();
                loginWindow.hide();
                log.info(`Successfully authenticated as ${user.nickname}.`);

            } catch (error) {
                loginWindow.send("auth-error", error);
            }
        } else if (query["error"]) {
            loginWindow.send("auth-cancel", query["error"]);
        }

        res.writeHead(200);
        res.end();

    });
    server.listen(46969);

    mainWindow = new BrowserWindow({
        title: "Aperiment",
        width: Math.round(width / 1.5),
        height: Math.round(height / 1.5),
        minWidth: 800,
        minHeight: 440,
        show: false,
        frame: false,
        webPreferences: {
            devTools: DEVELOPER_MODE,
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    loginWindow.once("closed", () => {
        loginWindow = null;
        app.quit();
    });

    mainWindow.once("closed", () => {
        loginWindow = null;
        mainWindow = null;
        app.quit();
    });

    loginWindow.once("ready-to-show", () => {
        mainWindow.loadFile(
            "src/renderer/views/main-window/MainWindow.html"
        );
    });

    loginWindow.loadFile(
        "src/renderer/views/login-window/LoginWindow.html"
    );

});

ipcMain.on("main-window-load", async () => {

    let configList = await instanceManager.loadConfigs();
    configList = Object.values(configList);

    let loadedIcons = await instanceManager.loadIcons();
    let changelogHTML = await loadChangelog() || "Failed to load CHANGELOG.txt!";

    const toSend = {
        appVersion: app.getVersion(),
        loadedConfigs: configList,
        loadedIcons: loadedIcons,
        settings: config.get(),
        changelog: changelogHTML
    };

    if (configList.length > 0) {
        log.info(`Successfully loaded ${configList.length} modpacks.`);
    } else {
        log.info("No modpacks to load.");
    }

    if (config.isLegacy()) {
        const minecraftPath = config.get('minecraftDirectory');
        try {
            await migrateLegacyFiles(minecraftPath);
        } catch (error) {
            log.error(`Failed to migrate instances at '${minecraftPath}'. ${error}`);
        }
    }

    mainWindow?.send("main-window-load", toSend);

});

ipcMain.on("app-load-finish", () => {

    user.loginFromMemory().then(() => {
        mainWindow.show();
        log.info(`Successfully reauthenticated as '${user.nickname}'.`);
    }).catch((error) => {
        loginWindow.show();
        log.error(`Could not reauthenticate user. ${error}`);
    }).finally(() => {
        loadWindow.destroy();
    });

    if (!isLoaded) {
        const loadFinish = () => {
            commandQueue.forEach((command) => {
                command();
            });
            isLoaded = true;
            commandQueue = [];
        };
        if (mainWindow.isVisible()) {
            loadFinish();
        } else {
            mainWindow.once("show", () => {
                loadFinish();
            });
        }
    }

});

ipcMain.on("renderer-error", (_, error) => {
    Log.getLogger("renderer").error(
        `An unhandled exception occurred in renderer process. ${error}`
    );
});

ipcMain.on("window-close", (event) => {
    findWindow(event.sender.id).close();
});
ipcMain.on("window-minimize", (event) => {
    findWindow(event.sender.id).minimize();
});
ipcMain.on("window-maximize", (event) => {
    const currentWindow = findWindow(event.sender.id);
    if (currentWindow.isMaximized()) {
        currentWindow.unmaximize();
    } else {
        currentWindow.maximize();
    }
});

ipcMain.on("user-login", async (event, username) => {

    try {

        await user.login(username, false);
        loginWindow.send("auth-success");

        mainWindow.show();
        loginWindow.hide();
        log.info(`Successfully authenticated as ${user.nickname}.`);

    } catch (error) {
        log.error(`Could not authenticate user. ${error}`);
    }

});

ipcMain.on("user-logout", (event) => {

    user.logout();

    loginWindow.show();
    mainWindow.hide();

});

ipcMain.on("new-instance", async (_, url) => {

    if (instanceManager.findRemote(url)) {
        mainWindow.send("new-instance", null, `A modpack with the same remote URL already exists in the library!`);
        return;
    }

    try {
        const instanceConfig = await instanceManager.addFromRemote(url);
        const iconPath = await instanceManager.fetchIcon(instanceConfig['id'])
            .catch((error) => {
                log.error(`Could not fetch icon for modpack '${instanceConfig['id']}'. ${error}`);
            });
        instanceManager.saveConfig(instanceConfig['id']);
        mainWindow.send('new-instance', {
            loadedConfigs: [instanceConfig],
            loadedIcons: {
                [instanceConfig['id']]: iconPath
            }
        });
    } catch (error) {
        mainWindow.send('new-instance', null, `${error}`);
    }

});

ipcMain.on("launch-instance", async (_, id) => {

    if (!instanceManager.isActive(id)) {

        instanceManager.setUserInfo({
            "UUID": user.id,
            "playerName": user.nickname,
            "accessToken": user.accessToken || "{}"
        });

        const eventEmitter = await instanceManager.createInstance(id);
        const iconPath = await instanceManager.fetchIcon(id).catch((error) => {
            log.error(`Could not fetch icon for modpack '${id}'. ${error}`);
        });

        /* Instance Config is fetched by InstanceManager.js */
        mainWindow?.send("instance-update", id, instanceManager.loadedConfigs[id], iconPath);

        /*
            Modpack download progress is currently displayed in the form of a green progress bar,
            which is insufficient for debugging purposes.
            The names of the files currently being downloaded should be logged into a special debug window.
        */
        eventEmitter.on('download-progress', (progress) => {
            mainWindow?.send("instance-download-progress", id, progress);
        });
        eventEmitter.on('process-start', (pid) => {
            mainWindow?.send("instance-start", id, pid);
        });
        /*
            Errors generated by Java process and sent to stdout/stderr,
            should be displayed/logged into a special debug window.
        */
        eventEmitter.on('process-stdout', (data) => {
            mainWindow?.send("instance-stdout", id, data.toString());
        });
        eventEmitter.on('process-stderr', (data) => {
            mainWindow?.send("instance-stderr", id, data.toString());
        });
        eventEmitter.on('process-exit', (code) => {
            if (instanceManager.isActive(id)) {
                /* destroyInstance triggers another process-exit event */
                instanceManager.destroyInstance(id);
            }
            mainWindow?.send("instance-exit", id, code);
        });
        eventEmitter.on('internal-error', (error) => {
            if (error.name !== "AbortError" && !axios.isCancel(error)) {
                error = `${error.stack}`;
                let instanceName = instanceManager.loadedConfigs[id]?.manifest?.name;
                log.error(`Modpack '${instanceName || id}' has encountered an unexpected error. ${error}`);
                mainWindow?.send("instance-error", id, error);
            } else {
                /* TODO: Get abort reason from abortSignal. */
                mainWindow?.send("instance-error", id, "Error: The operation was aborted (user-request)");
                eventEmitter.emit('process-exit', 'user-request');
            }
            eventEmitter.emit('process-exit', 'internal-error');
        });

        instanceManager.runInstance(id);

    }

});

ipcMain.on("terminate-instance", (event, id) => {
    if (instanceManager.isActive(id)) {
        instanceManager.destroyInstance(id, 'user-request');
    }
});

ipcMain.on("save-instance-config", (event, instanceConfig) => {
    if (instanceManager.isLoaded(instanceConfig['id'])) {
        instanceManager.setConfig(
            instanceConfig['id'],
            instanceConfig['config']
        );
        instanceManager.saveConfig(instanceConfig['id']);
    }
});

ipcMain.on("open-instance-folder", (_, loadedId) => {
    try {
        let instancePath = instanceManager.getInstancePath(loadedId);
        ipcMain.emit("open-in-explorer", {}, instancePath, true);
    } catch (error) {
        log.error(`Failed to open instance folder for ID '${loadedId}'. ${error}`);
    }
});

ipcMain.on("open-in-explorer", async (_, location, ensureExists) => {
    if (ensureExists) {
        await fs.promises.mkdir(location, { recursive: true });
    }
    const error = await shell.openPath(location);
    if (error) {
        log.error(`Failed to open path '${location}'.`);
    }
});

ipcMain.on("open-link", (_, link) => {
    shell.openExternal(link);
});

ipcMain.on("open-file", async (event, inputId, dialogType, fileTypes) => {
    const result = await dialog.showOpenDialog(findWindow(event.sender.id), {
        title: `Aperiment Select ${dialogType ? "Folder" : "File"}`,
        properties: [dialogType ? "openDirectory" : "openFile"],
        buttonLabel: "Select",
        filters: !dialogType ? fileTypes : []
    });
    if (!result.canceled) {
        event.sender.send("open-file", inputId, result.filePaths[0]);
    }
});

ipcMain.on("save-settings", (event, settings) => {
    for (let key in settings) {
        config.set(key, settings[key]);
    }
    config.save();
});

async function loadChangelog() {
    try {

        const changelogPath = Global["IS_PACKAGED"]
            ? path.join(path.dirname(process.resourcesPath), "CHANGELOG.txt")
            : path.join(__dirname, "../../CHANGELOG.txt");
        const changelog = (await fs.promises.readFile(changelogPath)).toString();

        let listOpen = false;
        let outputHTMLBuffer = "";
        for (let line of changelog.split("\n")) {
            line = line.trim();
            if (line) {
                if (line.startsWith("#")) {
                    line = line.substring(1).trim();
                    if (listOpen) { outputHTMLBuffer += "</div>"; }
                    outputHTMLBuffer += `<h5 class='version-title'>${line}</h5>`;
                    outputHTMLBuffer += `<div class='version-changelog'>`;
                    listOpen = true;
                } else if (line.startsWith("-")) {
                    line = line.substring(1).trim();
                    let commitHTMLBuffer = "";
                    let commits = line.match(/\b([a-f0-9]{40})\b/g);
                    if (Array.isArray(commits)) {
                        for (const commit of commits) {
                            line = line.replace(commit, "");
                            commitHTMLBuffer += `<a href='https://github.com/Skulaurun/Aperiment/commit/${commit}'>${commit.substring(0, 7)}</a>`;
                        }
                    }
                    line = line.trim();
                    outputHTMLBuffer += `<div class='changelog-line'>`;
                    outputHTMLBuffer += `<div class='flex-wrapper'><span>${line}</span>${commitHTMLBuffer}</div>`;
                    outputHTMLBuffer += `</div>`;
                }
            }
        }

        if (listOpen) { outputHTMLBuffer += "</div>"; }
        return outputHTMLBuffer;
        
    } catch (error) {
        log.error(`Failed to load a changelog. ${error}`);
    }
}

async function migrateLegacyConfig(configPath, legacyConfigPath) {

    try {
        await fs.promises.access(configPath);
        return false;
    } catch {}

    try {
        
        const legacyConfig = JSON.parse(
            await fs.promises.readFile(legacyConfigPath)
        );

        const newConfig = {
            "launcher": {
                "autoUpdate": legacyConfig["aper"]["autoUpdate"],
                "allowPrerelease": legacyConfig["aper"]["allowPrerelease"]
            },
            "minecraftDirectory": legacyConfig["minecraft"]
        };

        await fs.promises.writeFile(configPath, JSON.stringify(newConfig, null, 4));
        await fs.promises.unlink(legacyConfigPath);
        return true;

    } catch { return false; }

}

async function migrateLegacyFiles(minecraftPath) {

    const instancePath = path.join(minecraftPath, 'instances');
    const entryList = (await fs.promises.readdir(instancePath, { withFileTypes: true }))
        .filter(e => e.isDirectory());

    let modpackList = [];
    try {
        const loadedModpackList = JSON.parse(
            await fs.promises.readFile(
                path.join(Global["LEGACY_USER_DATA"], 'modpacks.json')
            )
        );
        if (Array.isArray(modpackList) && modpackList.every(x => typeof x === 'object')) {
            modpackList = loadedModpackList;
        }
    } catch {}

    for (const entry of entryList) {
        try {
            const metaPath = path.join(
                instancePath,
                `${entry.name}/meta.json`
            );
            let metaManifest = JSON.parse(
                await fs.promises.readFile(metaPath)
            );
            const instanceConfig = instanceManager.addFromManifest(metaManifest);
            if (typeof instanceConfig['manifest']['currentVersion'] === 'string') {
                instanceConfig['config']['version'] = instanceConfig['manifest']['currentVersion'];
            }
            if (typeof instanceConfig['manifest']['currentVersion'] !== 'undefined') {
                delete instanceConfig['manifest']['currentVersion'];
            }
            instanceManager.fetchIcon(instanceConfig['id'])
                .then((iconPath) => {
                    if (iconPath) {
                        mainWindow?.send("load-icons", {
                            [instanceConfig['id']]: iconPath
                        });
                    }
                })
                .catch(()=>{});
            const candidateModpack = modpackList.find((modpack) => {
                let normalizedName = (modpack['name'] || '')
                    .trim()
                    .toLowerCase()
                    .replace(/ /g, '-');
                return normalizedName === entry.name;
            });
            if (candidateModpack && candidateModpack['url']) {
                instanceConfig['config']['remote'] = candidateModpack['url'];
            }
            await fs.promises.rename(
                path.join(instancePath, entry.name),
                path.join(instancePath, instanceConfig['id'])
            );
            await fs.promises.mkdir(instanceManager.pathConfig['manifests'], { recursive: true });
            await instanceManager.saveConfig(instanceConfig['id']);
            await fs.promises.unlink(path.join(
                instancePath,
                `${instanceConfig['id']}/meta.json`
            ));
        } catch (error) {
            log.error(`There was an error during migration of '${entry.name}'. ${error}`);
        }
    }

    mainWindow?.send('load-modpacks', Object.values(instanceManager.loadedConfigs));

}
