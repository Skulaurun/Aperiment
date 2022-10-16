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
const url = require("url");
const path = require("path");
const { EventEmitter } = require("events");
const arch = require("arch");
const axios = require("axios").default;
const rimraf = require("rimraf");
const unzipper = require("unzipper");
const compareVersions = require("compare-versions");

const VANILLA_ASSETS_URL = "https://resources.download.minecraft.net";
const VANILLA_LIBRARIES_URL = "https://libraries.minecraft.net";
const FORGE_LIBRARIES_URL = "https://files.minecraftforge.net/maven";
const VERSION_MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

async function isPathAccessible(location) {

    try {

        await fs.promises.access(location);
        return true;
        
    } catch (error) {
        return false;
    }

}

async function writeStream(stream, location) {

    let writer = fs.createWriteStream(location);

    stream.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

}

class Minecraft extends EventEmitter {

    constructor(path, name, version, user, java) {

        super();

        if (path && name && version && user && java) {
            this._init(path, name, version, user, java);
        }

    }

    _init(path, name, version, user, java) {

        if (compareVersions(version, "1.5.2") !== 1) {
            throw new Error("Unsupported version!");
        }
        
        this.user = user;
        this.java = java;
        this.name = name;
        this.running = false;
        this.version = version;

        this.cache = `${path}/cache`;
        this.path = `${path}/instances/${name}`;

        this._getVersionManifest().then(() => {
            this.emit("ready");
        }).catch((error) => {
            this.emit("error", error);
        });

    }

    async _getAssetIndex(versionManifest) {

        let assetIndex = `${this.cache}/assets/indexes/${versionManifest["assetIndex"].id}.json`;

        try {

            let content = await fs.promises.readFile(assetIndex);

            return JSON.parse(content);
            
        }
        catch (error) {

            let content = (await axios.get(versionManifest["assetIndex"].url)).data;
            await fs.promises.mkdir(path.dirname(assetIndex), { recursive: true });
            await fs.promises.writeFile(assetIndex, JSON.stringify(content, null, 4));
            
            return content;

        }

    }

    async _getVersionManifest() {

        let versionManifest = `${this.cache}/${this.version}.json`;

        try {

            let content = JSON.parse(await fs.promises.readFile(versionManifest));
            content["assetIndex"]["objects"] = (await this._getAssetIndex(content))["objects"];

            this._manifest = content;

        } catch (error) {

            let response = await axios.get(VERSION_MANIFEST_URL);
            let versions = response.data["versions"];

            for (let i = 0; i < versions.length; i++) {

                let version = versions[i];

                if (version.id == this.version) {

                    let content = (await axios.get(version.url)).data;
                    await fs.promises.mkdir(path.dirname(versionManifest), { recursive: true });
                    await fs.promises.writeFile(versionManifest, JSON.stringify(content, null, 4));
                    content["assetIndex"]["objects"] = (await this._getAssetIndex(content))["objects"];

                    this._manifest = content;

                    return;

                }

            }

            throw new Error("Version not found.");

        }

    }

    _getLibraries() {

        let files = [];

        let libraries = this._manifest["libraries"];
        for (let i = 0; i < libraries.length; i++) {

            let library = libraries[i];
            let system = ({ "Windows_NT": "windows", "Linux": "linux", "Darwin": "osx" })[os.type()];

            let allowed = {
                windows: false,
                linux: false,
                osx: false
            };

            if (library.hasOwnProperty("rules")) {

                for (let j = 0; j < library.rules.length; j++) {

                    let rule = library.rules[j];
                    let action = rule.action == "allow" ? true : false;

                    if (rule.hasOwnProperty("os")) {
                        allowed[rule["os"]["name"]] = action;
                    } else {
                        for (let key in allowed) {
                            allowed[key] = action;
                        }
                    }

                }

            } else {
                for (let key in allowed) {
                    allowed[key] = true;
                }
            }

            if(!allowed[system]) {
                continue;
            }

            if (library["downloads"].hasOwnProperty("classifiers")) {

                let classifiers = library["downloads"]["classifiers"];

                let natives = null;
                if (library.hasOwnProperty("natives") && library["natives"].hasOwnProperty(system)) {
                    
                    natives = library["natives"][system];
                    natives = natives.replace("${arch}", arch() == "x86" ? "32" : "64");

                }

                for (let key in classifiers) {

                    let classifier = classifiers[key];

                    if (key == natives) {
                        files.push({
                            name: library.name,
                            size: classifier.size,
                            path: `${this.cache}/libraries/${classifier.path}`,
                            url: classifier.url,
                            extract: true
                        });
                    }

                }

            } else if (library["downloads"].hasOwnProperty("artifact")) {
                
                let artifact = library["downloads"]["artifact"];

                files.push({
                    name: library.name,
                    size: artifact.size,
                    path: `${this.cache}/libraries/${artifact.path}`,
                    url: artifact.url
                });
                
            }

        }

        return files;

    }

    _getAssets() {

        let files = [];

        let assets = this._manifest["assetIndex"]["objects"];

        for (let key in assets) {

            let asset = assets[key];
            let filename = `${asset.hash.substring(0, 2)}/${asset.hash}`;

            files.push({
                name: path.basename(key),
                size: asset.size,
                path: `${this.cache}/assets/objects/${filename}`,
                url: `${VANILLA_ASSETS_URL}/${filename}`
            });

        }

        return files;

    }

    _getJars() {

        let files = [];

        let client = this._manifest["downloads"]["client"];

        files.push({
            name: `${this._manifest["id"]}.jar`,
            size: client.size,
            path: `${this.cache}/bin/${this._manifest["id"]}.jar`,
            url: client.url
        });

        return files;
        
    }

    async _verifyFileIntegrity() {

        let queue = [], files = [];
        files = files.concat(this._getJars());
        files = files.concat(this._getAssets());
        files = files.concat(this._getLibraries());

        for (let i = 0; i < files.length; i++) {

            let file = files[i];

            let stat = await fs.promises.stat(file.path).catch(() => {
                return null;
            });

            if (!(stat && stat["size"] === file.size)) {
                queue.push(file);
            }

        }

        return queue;

    }

    async download(progressCallback) {

        try {

            let queue = await this._verifyFileIntegrity();

            let total = 0;
            for (let i = 0; i < queue.length; i++) {
                total += queue[i].size;
            }
    
            let loaded = 0;
            for (let i = 0; i < queue.length; i++) {
    
                let file = queue[i];
    
                await fs.promises.mkdir(path.dirname(file.path), { recursive: true });

                let response = await axios({
                    url: file.url,
                    method: "GET",
                    responseType: "stream"
                });
                
                response.data.on("data", (data) => {

                    loaded += Buffer.byteLength(data);

                    progressCallback({
                        file: file.name,
                        loaded: {
                            count: i + 1,
                            size: loaded
                        },
                        total: {
                            count: queue.length,
                            size: total
                        }
                    });

                });
            
                await writeStream(response.data, file.path);
    
            }

        } catch (error) {
            this.emit("error", error);
        }

    }

    async _grabNatives(directory) {

        await fs.promises.mkdir(directory, { recursive: true });

        let libraries = this._getLibraries();
        for (let i = 0; i < libraries.length; i++) {

            let library = libraries[i];
            if (library.hasOwnProperty("extract") && library.extract) {

                let zip = fs.createReadStream(library.path).pipe(unzipper.Parse({ forceStream: true }));

                for await (let entry of zip) {

                    if (!entry.path.startsWith("META-INF/")) {
                        await writeStream(entry, `${directory}/${entry.path}`);
                    } else {
                        entry.autodrain();
                    }

                }

            }

        }

    }

    async _grabAssets(directory) {

        await fs.promises.rmdir(directory, { recursive: true });
        await fs.promises.mkdir(directory, { recursive: true });

        for (const [ filepath, { hash } ] of Object.entries(this._manifest["assetIndex"]["objects"])) {
            const destination = `${directory}/${filepath}`;
            await fs.promises.mkdir(path.dirname(destination), { recursive: true });
            await fs.promises.copyFile(`${this.cache}/assets/objects/${hash.substr(0, 2)}/${hash}`, destination);
        }

    }

    _buildLibraryString() {

        let string = "";

        let libraries = this._getLibraries();
        for (let i = 0; i < libraries.length; i++) {

            let library = libraries[i];

            if (!library.hasOwnProperty("extract") && !library.extract) {
                string += library.path;
            }

            if (i != libraries.length - 1) {
                string += process.platform === "win32" ? ";" : ":";
            }

        }

        return string;

    }

    _getMinecraftArguments() {

        return {
            "auth_uuid": this.user.id,
            "auth_player_name": this.user.nickname,
            "auth_access_token": this.user.accessToken,
            "assets_root": `${this.cache}/assets`,
            "game_assets": `${this.cache}/assets/virtual/legacy`,
            "assets_index_name": this._manifest["assetIndex"].id,
            "version_name": this._manifest["id"],
            "version_type": this._manifest["type"],
            "game_directory": this.path,
            "user_type": "mojang"
        };

    }

    _getJavaArguments() {
        
        let mainClass = this._manifest["mainClass"];
        let libraries = this._buildLibraryString();
        let minecraftJar = this._getJars()[0].path;

        return [
            `-Dminecraft.applet.TargetDirectory=${this.path}`,
            `-Djava.library.path=${this.path}/natives`,
            `-Dminecraft.client.jar=${minecraftJar}`,
            "-cp", `${libraries};${minecraftJar}`,
            mainClass
        ];

    }

    _buildLaunchArguments(template) {

        let minecraftArguments = this._getMinecraftArguments();
        let javaArguments = this._getJavaArguments();
        
        template = template.split(" ");
        for (let i = 0; i < template.length; i += 2) {
            
            let key = template[i];
            let value = template[i + 1];

            if (value.startsWith("${") && value.endsWith("}")) {

                let search = value.substring(2, value.length - 1);

                if (minecraftArguments.hasOwnProperty(search)) {
                    template[i + 1] = minecraftArguments[search];
                } else {
                    template[i + 1] = "{}";
                }

            }

        }

        return javaArguments.concat(template);

    }

    async _launch(launchArguments) {

        await fs.promises.mkdir(this.path, { recursive: true });
        await this._grabNatives(`${this.path}/natives`);

        if (compareVersions(this.version, "1.7.2") !== 1) {
            await this._grabAssets(`${this.cache}/assets/virtual/legacy`);
        }

        this.running = true;
        this.java.exec(launchArguments, { cwd: this.path });

        this.java.process.stdout.on("data", (data) => { this.emit("stdout-data", data); });
        this.java.process.stderr.on("data", (data) => { this.emit("stderr-data", data); });

        this.java.process.on("exit", (code) => {

            rimraf(`${this.path}/natives`, (error) => {
                if (error) {
                    this.emit("error", error);
                }
            });

            this.running = false;
            this.emit("exit", code);

        });

    }

    async launch() {

        try {

            if (compareVersions(this.version, "1.13") !== -1) {
                this._manifest["minecraftArguments"] = this._manifest["arguments"]["game"].filter(x => typeof x === "string").join(" ");
            }

            let launchArguments = this._buildLaunchArguments(this._manifest["minecraftArguments"]);

            await this._launch(launchArguments);

        } catch (error) {
            this.emit("error", error);
        }
        
    }

    terminate(signal) {

        try {

            if (this.running) {

                this.java.process.kill(signal);
                this.java.process.emit("exit", "forced-shutdown");
                
            }

        } catch (error) {
            this.emit("error", error);
        }

    }

}

class MinecraftForge extends Minecraft {

    constructor(path, name, version, user, java) {

        super();

        if (path && name && version && user && java) {
            this._init(path, name, version, user, java);
        }

    }

    _init(path, name, version, user, java) {

        let vanillaVersion = version.split("-")[0];

        super._init(path, name, vanillaVersion, user, java);

        this.forgeVersion = version;

    }

    _splitDescriptor(descriptor) {

        let parts = descriptor.split(":");
        let domain = parts[0].replace(/\./g, "/");
        let name = parts[1]; let version = parts[2];
        let jar = `${name}-${version}.jar`;

        let path = `${domain}/${name}/${version}/${jar}`;

        return { domain, name, version, jar, path };

    }

    async _refactorForgeManifest(forgeManifest) { // Edited to run Forge 1.13 and higher, this is a temporary solution!

        let libraries = forgeManifest["libraries"];
        let installLibraries = forgeManifest["installLibraries"];

        if (compareVersions(this.version, "1.13.2") !== -1) {

            libraries.push({
                name: "io.github.zekerzhayard:ForgeWrapper:1.5.5",
                downloads: {
                    artifact: {
                        size: 34331,
                        path: "io/github/zekerzhayard/ForgeWrapper/1.5.5/ForgeWrapper-1.5.5.jar",
                        url: "https://github.com/ZekerZhayard/ForgeWrapper/releases/download/1.5.5/ForgeWrapper-1.5.5.jar"
                    }
                }
            });

            let additionalLibraries = [
                {
                    url: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-launcher.jar`,
                    size: 0
                },
                {
                    url: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`,
                    size: 0
                },
                {
                    url: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`,
                    size: 0
                }
            ];
            for (const library of additionalLibraries) {
                let response = await axios.request({
                    url: library["url"],
                    method: "HEAD"
                });
                library["size"] = parseInt(response.headers["content-length"]);
            }

            libraries.push({
                name: `net.minecraftforge:forge:${this.forgeVersion}:launcher`,
                downloads: {
                    artifact: {
                        size: additionalLibraries[0]["size"],
                        path: `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-launcher.jar`,
                        url: additionalLibraries[0]["url"]
                    }
                }
            });
            libraries.push({
                name: `net.minecraftforge:forge:${this.forgeVersion}:universal`,
                downloads: {
                    artifact: {
                        size: additionalLibraries[1]["size"],
                        path: `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`,
                        url: additionalLibraries[1]["url"]
                    }
                }
            });
            installLibraries.push({
                name: `net.minecraftforge:forge:${this.forgeVersion}:installer`,
                downloads: {
                    artifact: {
                        size: additionalLibraries[2]["size"],
                        path: `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`,
                        url: additionalLibraries[2]["url"]
                    }
                }
            });

            forgeManifest["forgeInstaller"] = `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`;

        }

        for (let i = 0; i < libraries.length; i++) {

            let library = libraries[i];
            let { domain, name, version, jar, path } = this._splitDescriptor(library.name);
            
            if (path.includes(this.forgeVersion)) {
                path = path.replace(jar, `${name}-${version}-universal.jar`);
            }

            let url = library.hasOwnProperty("url") ? `${FORGE_LIBRARIES_URL}/${path}` : `${VANILLA_LIBRARIES_URL}/${path}`;
            if (compareVersions(this.version, "1.13.2") !== -1) {
                if (library.hasOwnProperty("downloads") && library["downloads"].hasOwnProperty("artifact")
                    && library.downloads.artifact.hasOwnProperty("url") && library.downloads.artifact.url != "") {
                    library["size"] = library.downloads.artifact.size;
                    library["path"] = library.downloads.artifact.path;
                    library["url"] = library.downloads.artifact.url;
                    continue;
                } else { url = null; library.url = ""; }
            }

            if (url) {
                let response = await axios.request({
                    url: url,
                    method: "HEAD"
                });
                library["size"] = parseInt(response.headers["content-length"]);
                library["path"] = path;
                library["url"] = url;
            }

        }

    }

    async _getForgeManifest() {

        let forgeManifest = `${this.cache}/forge-${this.forgeVersion}.json`;

        try {

            let content = await fs.promises.readFile(forgeManifest);

            this._forgeManifest = JSON.parse(content);
            
        }
        catch (error) {

            // Edited to run Forge 1.13 and higher, this is a temporary solution!
            let response = compareVersions(this.version, "1.13") !== -1 ? await axios.get(`${FORGE_LIBRARIES_URL}/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`, {
                responseType: "arraybuffer"
            }) : await axios.get(`${FORGE_LIBRARIES_URL}/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`, {
                responseType: "arraybuffer"
            });

            let buffer = Buffer.from(response.data, "binary");
            let directory = await unzipper.Open.buffer(buffer);
            let file = directory.files.find(d => d.path === "version.json");
            let content = JSON.parse(await file.buffer());

            // Edited to run Forge 1.13 and higher, this is a temporary solution!
            if (compareVersions(this.version, "1.13") !== -1) {
                file = directory.files.find(d => d.path === "install_profile.json");
                let installProfile = JSON.parse(await file.buffer());
                content["installLibraries"] = installProfile["libraries"];
            }

            await this._refactorForgeManifest(content);

            await fs.promises.mkdir(path.dirname(forgeManifest), { recursive: true });
            await fs.promises.writeFile(forgeManifest, JSON.stringify(content, null, 4));

            this._forgeManifest = content;

            return;

        }

    }

    async _getVersionManifest() {

        await super._getVersionManifest();

        await this._getForgeManifest();

    }

    _getLibraries() {

        let files = super._getLibraries();

        let libraries = this._forgeManifest["libraries"].slice().reverse();
        for (let i = 0; i < libraries.length; i++) {

            let library = libraries[i];

            if (files.some(file => file.name === library.name)) {
                continue;
            }

            if (!library.url || library.url == "") { // Added with support for Forge 1.13 and higher, maybe it broke something, hehe...
                continue;
            }

            files.unshift({
                name: library.name,
                size: library.size,
                path: `${this.cache}/libraries/${library.path}`,
                url: library.url
            });

        }

        return files;

    }

    _getInstallLibraries() { // Edited to run Forge 1.13 and higher, this is a temporary solution!

        let files = [];

        let installLibraries = this._forgeManifest["installLibraries"].slice().reverse();
        for (let i = 0; i < installLibraries.length; i++) {

            let library = installLibraries[i];
            let { path, url, size } = library["downloads"]["artifact"];

            if (!url || url == "") {
                continue;
            }

            files.unshift({
                name: library.name,
                size: size,
                path: `${this.cache}/libraries/${path}`,
                url: url
            });

        }

        return files;

    }

    _getMinecraftArguments() {

        let args = super._getMinecraftArguments();

        args["version_name"] = this._forgeManifest["id"];

        return args;

    }

    _getJavaArguments() {

        let args = super._getJavaArguments();

        // Edited to run Forge 1.13 and higher, this is a temporary solution!
        if (compareVersions(this.version, "1.13") !== -1) {
            args.unshift(`-Dforgewrapper.librariesDir=${this.cache}/libraries`);
            args.unshift(`-Dforgewrapper.installer=${this.cache}/libraries/${this._forgeManifest["forgeInstaller"]}`);
            args.unshift(`-Dforgewrapper.minecraft=${this._getJars()[0].path}`);
        }

        args[args.indexOf(this._manifest["mainClass"])] = this._forgeManifest["mainClass"];

        return args;

    }

    async _verifyFileIntegrity() { // Edited to run Forge 1.13 and higher, this is a temporary solution!

        let queue = await super._verifyFileIntegrity();

        if (compareVersions(this.version, "1.13") !== -1) {

            let files = this._getInstallLibraries();

            for (let i = 0; i < files.length; i++) {
    
                let file = files[i];
    
                let stat = await fs.promises.stat(file.path).catch(() => {
                    return null;
                });
    
                if (!(stat && stat["size"] === file.size)) {
                    queue.push(file);
                }
    
            }

        }

        return queue;

    }

    async launch() {

        try {

            // Edited to run Forge 1.13 and higher, this is a temporary solution!
            if (compareVersions(this.version, "1.13") !== -1) {
                this._forgeManifest["minecraftArguments"] = this._manifest["arguments"]["game"].filter(x => typeof x === "string").join(" ");
                this._forgeManifest["mainClass"] = "io.github.zekerzhayard.forgewrapper.installer.Main";
                this._forgeManifest["minecraftArguments"] += " " + this._forgeManifest["arguments"]["game"].filter(x => typeof x === "string").join(" ");
            }

            let launchArguments = this._buildLaunchArguments(this._forgeManifest["minecraftArguments"]);

            await this._launch(launchArguments);

        } catch (error) {
            this.emit("error", error);
        }

    }

}

class MinecraftModpack extends MinecraftForge {

    constructor(path, name, url, user, java) {

        super();

        this._getModpackManifest(`${path}/instances/${name}`, url).then((manifest) => {

            this._modpackManifest = manifest;
            this.modpackVersion = manifest["currentVersion"] ? manifest["versions"].find(version => version.id === manifest["currentVersion"]) : manifest["versions"][0];

            if (!this._modpackManifest["currentVersion"]) {
                this._forceUpdate = true;
            }

            this._init(path, name, this.modpackVersion["forge"], user, java);

        }).catch((error) => {
            this.emit("error", error);
        });

    }

    async _getModpackManifest(directory, url) {

        let manifest = `${directory}/meta.json`;

        try {

            var content = (await axios.get(url)).data;

        } catch (error) {

            let content = JSON.parse(await fs.promises.readFile(manifest));

            return content;

        }

        try {

            let meta = JSON.parse(await fs.promises.readFile(manifest));

            if (meta.hasOwnProperty("currentVersion")) {
                content["currentVersion"] = meta["currentVersion"];
            }
            
        } catch (error) {
            content["currentVersion"] = null;
        }

        await fs.promises.mkdir(path.dirname(manifest), { recursive: true });
        await fs.promises.writeFile(manifest, JSON.stringify(content, null, 4));

        return content;

    }

    isUpToDate() {

        if (this._modpackManifest["currentVersion"]) {
            
            let latestVersion = this._modpackManifest["versions"][0].id;
            let currentVersion = this.modpackVersion.id;
    
            return compareVersions(currentVersion, latestVersion) === 0;

        }

        return false;

    }

    async _verifyFileIntegrity() {

        let queue = await super._verifyFileIntegrity();

        if (this._forceUpdate) {

            queue.push({
                name: "modpack.zip",
                size: this.modpackVersion.size,
                path: `${this.path}/modpack.zip`,
                url: this.modpackVersion.url,
                extract: true
            });

        }

        return queue;

    }

    async _getActions(location) {

        let actions = null;
        let reader = fs.createReadStream(location);
        let zip = reader.pipe(unzipper.Parse({forceStream: true}));

        for await (let entry of zip) {

            if (entry.path === "actions.json") {

                actions = JSON.parse(await entry.buffer());
                break;

            } else {
                entry.autodrain();
            }

        }

        reader.close();
        return actions;

    }

    async _extractModpack() {

        let file = `${this.path}/modpack.zip`;
        let reader = fs.createReadStream(file);
        let zip = reader.pipe(unzipper.Parse({forceStream: true}));
        let actions = await this._getActions(file);

        for await (let entry of zip) {
            
            let item = actions.find(e => entry.path.startsWith(e.name)) || {};
            if (!item.hasOwnProperty("action")) {
                continue;
            }

            let location = `${this.path}/${entry.path}`;
            await fs.promises.mkdir(path.dirname(location), { recursive: true });

            switch (item.action) {

                case "ADD":
                    if (entry.type === "File") {

                        if (!await isPathAccessible(location)) {

                            await writeStream(entry, location);
                            continue;

                        }

                    }
                    break;
                
                case "REPLACE":
                    if (entry.type === "File") {

                        if (await isPathAccessible(location)) {
                            await fs.promises.unlink(location);
                        }

                        await writeStream(entry, location);
                        continue;

                    }
                    break;

                case "DELETE":
                    if (entry.type === "Directory") {

                        if (await isPathAccessible(location)) {
                            await new Promise((resolve, reject) => {
                                rimraf(location, (error) => {
                                    if (!error) { resolve(); } else { reject(); }
                                });
                            });
                        }

                    } else if (entry.type === "File") {

                        await writeStream(entry, location);
                        continue;

                    }
                    break;

            }

            entry.autodrain();

        }

        reader.close();
        await fs.promises.unlink(file);

    }

    async download(progressCallback) {

        await super.download(progressCallback);

        if (this._forceUpdate) {

            await this._extractModpack();

            this._modpackManifest["currentVersion"] = this.modpackVersion.id;
            await fs.promises.writeFile(`${this.path}/meta.json`, JSON.stringify(this._modpackManifest, null, 4));

            this._forceUpdate = false;

        }

    }

    update() {
        this._forceUpdate = true;
        this.modpackVersion = this._modpackManifest["versions"][0];
    }

    getIconUrl() {
        return this._modpackManifest["icon"];
    }

}

module.exports = { Minecraft, MinecraftForge, MinecraftModpack };
