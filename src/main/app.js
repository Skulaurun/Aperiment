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

const os = require("os");
const axios = require("axios").default;
const validUrl = require("valid-url");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");
const { app, screen, ipcMain, BrowserWindow } = require("electron");

const Storage = require("./storage.js");
const User = require("./user.js");
const Java = require("./java.js");
const { MinecraftModpack } = require("./minecraft.js");

const USER_DATA = app.getPath("userData").replace(/\\/g, "/");
const DEVELOPER_MODE = process.argv.includes("--dev");

require("../common/overrides.js");

log.transports.console.format = "[{h}:{i}:{s}.{ms}] [{level}]: {text}";
log.transports.file.format = "[{d}-{m}-{y} {h}:{i}:{s}.{ms}] [{level}]: {text}";
log.hooks.push((message) => { message.level = message.level.toUpperCase(); return message; });

function exitHandler(code) {
    log.info(`Exited with code ${code}.\n`);
}

process.once("exit", exitHandler);
process.once("SIGINT", exitHandler);
process.once("SIGUSR1", exitHandler);
process.once("SIGUSR2", exitHandler);

function crashHandler(error) {

    let errorInfo = error.stack.toString();
    let cpuUsage = Math.round(process.getCPUUsage().percentCPUUsage);
    let totalMemory = Math.round(os.totalmem() / 1048576);
    let loadedMemory = totalMemory - Math.round(os.freemem() / 1048576);
    let message = [
        `Fatal error has been encountered and the application cannot continue.`,
        ` ---===[ System Info ]===---`,
        `  * OS: ${os.type()} ${os.arch()}`,
        `  * CPU: ${cpuUsage}%`,
        `  * Memory: ${loadedMemory} MB / ${totalMemory} MB`,
        ` ---===[ Error Info ]===---`,
        `  ${errorInfo}`
    ];

    log.variables.level = "CRASH";
    log.error(message.join("\n"));
    log.variables.level = "{level}";

    process.emit("exit", 1);
    process.exit(1);

}

process.getCPUUsage();
process.on("uncaughtException", crashHandler);
process.on("unhandledRejection", crashHandler);

let config, user, java, modpacks;
let loadWindow, loginWindow, mainWindow;

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

app.on("second-instance", () => {

    let windows = [loadWindow, loginWindow, mainWindow];
    for (let i = 0; i < windows.length; i++) {

        let window = windows[i];
        if (window && window.isVisible()) {
            
            if (window.isMinimized()) {
                window.restore();
            }

            window.focus();

        }

    }

});

app.once("ready", () => {

    log.info(`A-Periment v.${app.getVersion()} started.`);
    
    loadWindow = new BrowserWindow({
        width: 256,
        height: 256,
        frame: false,
        show: false,
        resizable: false,
        transparent: true,
        alwaysOnTop: true,
        webPreferences: {
            devTools: DEVELOPER_MODE
        }
    });
    
    loadWindow.once("closed", () => {
        loadWindow = null;
    });

    loadWindow.loadFile("src/load.html");

    loadWindow.once("ready-to-show", (event) => {

        loadWindow.show();

        config = new Storage({
            data: {
                "java": "java",
                "minecraft": `${USER_DATA}/minecraft`
            },
            path: `${USER_DATA}/config.json`
        });

        modpacks = new Storage({
            data: [],
            path: `${USER_DATA}/modpacks.json`
        });

        java = new Java(config.get("java"));
        user = new User(`${USER_DATA}/user.json`);

        java.getVersion().then((version) => {
            log.info(`Detected Java Runtime Environment v.${version}.`);
        }).catch(() => {
            if (java.path === "java") {
                log.warn("Could not detect any installed java version.");
            } else {
                log.warn("The java path specified in the config file is not a valid java executable.");
            }
        });
        
        autoUpdater.once("update-downloaded", () => {
            autoUpdater.quitAndInstall(true, true);
        });

        autoUpdater.once("update-not-available", () => {
            ipcMain.emit("app-start");
        });

        if (!DEVELOPER_MODE) {
            autoUpdater.allowPrerelease = true;
            autoUpdater.checkForUpdates().catch((error) => {
                log.error(`Could not check for updates.\n ${error.loggify()}`);
                ipcMain.emit("app-start");
            });
        } else {
            ipcMain.emit("app-start");
        }

    });

});

ipcMain.once("app-start", (event) => {

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    loginWindow = new BrowserWindow({
        width: Math.round(width / 4),
        height: Math.round(height / 2),
        show: false,
        frame: false,
        resizable: false,
        webPreferences: {
            devTools: DEVELOPER_MODE,
            nodeIntegration: true
        }
    });

    mainWindow = new BrowserWindow({
        width: Math.round(width / 1.5),
        height: Math.round(height / 1.5),
        minWidth: 800,
        minHeight: 440,
        show: false,
        frame: false,
        webPreferences: {
            devTools: DEVELOPER_MODE,
            nodeIntegration: true
        }
    });
    
    loginWindow.once("ready-to-show", (event) => {

        mainWindow.once("ready-to-show", (event) => {

            event.sender.send("load-settings", config.get());
            event.sender.send("load-modpacks", modpacks.get());

            if (modpacks.size() > 0) log.info(`Successfully loaded ${modpacks.size()} modpacks.`);
            else log.info("No modpacks to load.");

            user.reauthenticate().then(() => {
    
                mainWindow.show();

                log.info(`Successfully reauthenticated as ${user.nickname}.`);
        
            }).catch((error) => {
    
                loginWindow.show();
    
                log.error(`Could not reauthenticate user.\n ${error.code}: ${error.message}`);
    
            }).finally(() => {
    
                loadWindow.destroy();
    
            });

        });

        mainWindow.loadFile("src/main.html");

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

    loginWindow.loadFile("src/login.html");

});

ipcMain.on("app-version", (event) => {

    let sender = event.sender;
    if (!sender) return;

    sender.send("app-version", app.getVersion());

});

ipcMain.on("user-login", (event, online, username, password) => {

    user.online = online;

    user.authenticate(username, password).then(() => {

        mainWindow.show();
        loginWindow.hide();

        log.info(`Successfully authenticated as ${user.nickname}.`);

    }).catch((error) => {
        log.error(`Could not authenticate user.\n ${error.code}: ${error.message}`);
    });

});

ipcMain.on("user-logout", (event) => {

    user.invalidate();

    loginWindow.show();
    mainWindow.hide();

});

ipcMain.on("add-modpack", async (event, url) => { // TODO: Stricter rules for valid url.

    if (!validUrl.isUri(url)) {
        return; // TODO: Show messagebox. [INVALID URL]
    }

    let manifest = (await axios.get(url)).data;

    if ((typeof manifest !== "object" || !manifest.hasOwnProperties("name", "creators", "description", "versions", "vma")) ||
        (!Array.isArray(manifest.versions) || manifest.versions.length === 0 || typeof manifest.versions[0] !== "object") ||
        (!manifest.versions[0].hasOwnProperties("id", "size", "forge", "url") || !validUrl.isUri(manifest.versions[0].url))) {
        return; // TODO: Show messagebox. [INVALID MANIFEST]
    }

    let modpack = {
        name: manifest.name,
        creators: manifest.creators,
        description: manifest.description,
        url: url,
        vma: manifest.vma
    }

    if (modpacks.get().some(m => m.url === url)) {
        return; // TODO: Show messagebox. [ALREADY EXISTS]
    }

    modpacks.set(modpacks.size(), modpack);
    modpacks.save();

    mainWindow.send("load-modpacks", modpacks.get());

});

ipcMain.on("launch-modpack", (event, options) => { // TODO: Add logging.
    
    java.vma = options.vma;
    var modpack = new MinecraftModpack(config.get("minecraft"), options.directory, options.url, user, java);

    ipcMain.once("terminate-modpack", () => {

        if (!modpack.running) {

            modpack.removeAllListeners();
            event.sender.send("modpack-exit", options.id, "job-cancelled");
            
        } else {
            modpack.terminate("SIGKILL");
        }

        modpack = null;
        
    });

    modpack.on("ready", () => {

        if (!modpack.isUpToDate()) {
            modpack.update();
        }
    
        modpack.download((progress) => {
            event.sender.send("modpack-download-progress", options.id, progress);
        }).then(() => {
            modpack.launch().then(() => {
                event.sender.send("modpack-start", options.id);
            });
        });
    
    });

    modpack.on("error", (error) => {
        event.sender.send("modpack-error", options.id, error);
    });
    
    modpack.on("stdout-data", (data) => {
        event.sender.send("modpack-stdout", options.id, data.toString());
    });
    
    modpack.on("stderr-data", (data) => {
        event.sender.send("modpack-stderr", options.id, data.toString());
    });
    
    modpack.on("exit", (code) => {
        event.sender.send("modpack-exit", options.id, code);
    });

});

ipcMain.on("save-settings", (event, settings) => {

    for (let key in settings) {
        config.set(key, settings[key]);
    }

    config.save();

});

ipcMain.on("save-modpacks", (event, object) => {

    for (let i = 0; i < modpacks.size(); i++) {

        let item = modpacks.get(i);
        if (item.url === object.url) {

            item[object.key] = object.value;

            modpacks.set(i, item);

        }

    }

    modpacks.save();

});
