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
const fs = require("fs");
const crypto = require("crypto");
const { Readable } = require("stream");
const fileType = require("file-type");
const { default: axios } = require("axios");
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
        title: "A-Periment",
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

    loadWindow.loadFile("src/load.html");

    loadWindow.once("ready-to-show", () => {

        loadWindow.show();

        config = new Storage({
            data: {
                "aper": {
                    "autoUpdate": true,
                    "allowPrerelease": true
                },
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

        if (!DEVELOPER_MODE && config.get("aper.autoUpdate", true)) {
            autoUpdater.allowPrerelease = config.get("aper.allowPrerelease", true);
            autoUpdater.checkForUpdates().catch((error) => {
                log.error(`Could not check for updates.\n ${error.loggify()}`);
                ipcMain.emit("app-start");
            });
        } else {
            ipcMain.emit("app-start");
        }

    });

});

ipcMain.once("app-start", () => {

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    loginWindow = new BrowserWindow({
        title: "A-Periment",
        width: Math.round(width / 4),
        height: Math.round(height / 2),
        show: false,
        frame: false,
        resizable: false,
        webPreferences: {
            devTools: DEVELOPER_MODE,
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    mainWindow = new BrowserWindow({
        title: "A-Periment",
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
    
    loginWindow.once("ready-to-show", () => {

        mainWindow.once("ready-to-show", () => {

            mainWindow.send("load-settings", config.get());
            mainWindow.send("load-modpacks", modpacks.get());

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
    
    if (manifest.hasOwnProperty("icon") && validUrl.isUri(manifest["icon"])) {
        let directory = modpack.name.trim().toLowerCase().replace(/ /g, "-");
        fetchIcon(manifest["icon"], directory).catch(()=>{});
    }

    modpacks.set(modpacks.size(), modpack);
    modpacks.save();

    mainWindow.send("load-modpacks", modpacks.get());

});

let activeModpacks = {};

ipcMain.on("launch-modpack", (event, options) => { // TODO: Add logging.

    if (activeModpacks[options.id]) {
        return;
    }
    
    let localJava = new Java(java.path, options.vma);
    let modpack = new MinecraftModpack(config.get("minecraft"), options.directory, options.url, user, localJava);

    modpack.on("ready", () => {

        if (!modpack.isUpToDate()) {
            modpack.update();
        }

        let iconUrl = modpack.getIconUrl();
        if (iconUrl) { fetchIcon(iconUrl, modpack.name).catch(()=>{}); }
    
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
        if (activeModpacks[options.id]) {
            delete activeModpacks[options.id];
        }
        event.sender.send("modpack-exit", options.id, code);
    });

    activeModpacks[options.id] = modpack;

});

ipcMain.on("terminate-modpack", (event, id) => {

    let modpack = activeModpacks[id];
    if (!modpack) return;

    if (!modpack.running) {
        modpack.removeAllListeners();
        event.sender.send("modpack-exit", id, "job-cancelled");
    } else {
        modpack.terminate("SIGKILL");
    }

    delete activeModpacks[id];
    
});

ipcMain.on("save-settings", (event, settings) => {

    for (let key in settings) {
        config.set(key, settings[key]);
    }

    config.save();
    event.sender.send("load-settings", config.get());

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

ipcMain.on("load-icons", async (event, modpacks) => {

    const iconDirectory = `${config.get("minecraft")}/cache/icons`;
    const supportedMimeTypes = [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif"
    ];

    try {

        await fs.promises.access(iconDirectory);

        let icons = {};
        for (const modpack of modpacks) {
            try {
                const type = await fileType.fromFile(`${iconDirectory}/${modpack}`);
                if (supportedMimeTypes.includes(type.mime)) {
                    icons[modpack] = `${iconDirectory}/${modpack}`;
                }
            } catch {}
        }

        event.sender.send("load-icons", icons);

    } catch {}

});

async function fetchIcon(url, modpack) {

    const computeHash = (hash, stream) => {
        return new Promise((resolve, reject) => {
            stream.pipe(crypto.createHash(hash).setEncoding("hex"))
                .on("finish", function() {
                    resolve(this.read());
                }).on("error", reject);
        });
    };

    const streamToBuffer = (stream) => {
        return new Promise((resolve, reject) => {
            let buffer = [];
            stream.on("data", (chunk) => { buffer.push(chunk); });
            stream.on("end", () => resolve(Buffer.concat(buffer)));
            stream.on("error", reject);
        });
    };

    let fileHash = null;
    let remoteHash = null;
    let streamBuffer = null;

    const iconDirectory = `${config.get("minecraft")}/cache/icons`;
    const iconPath = `${iconDirectory}/${modpack}`;

    try {
        let { data: stream } = await axios({
            url: url,
            method: "GET",
            responseType: "stream"
        });
        streamBuffer = await streamToBuffer(stream);
        remoteHash = await computeHash("sha256", Readable.from(streamBuffer));
    } catch { return; }

    try {
        await fs.promises.access(iconPath);
        fileHash = await computeHash("sha256", fs.createReadStream(iconPath));
    } catch {}

    if (remoteHash != null && fileHash != remoteHash) {

        await fs.promises.mkdir(iconDirectory, { recursive: true });

        try {

            const writeStream = Readable.from(streamBuffer);
            const writer = fs.createWriteStream(iconPath);
            writeStream.pipe(writer);

            writer.on("finish", () => {
                ipcMain.emit("load-icons", { sender: mainWindow }, [modpack]);
            });

        } catch {}

    }

}
