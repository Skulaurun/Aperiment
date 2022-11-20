/*
 *
 *   A-Periment - Custom minecraft launcher
 *   Copyright (C) 2020 - 2022 Adam Charvát
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
 *   along with A-Periment. If not, see <https://www.gnu.org/licenses/>.
 *
 */

const os = require("os");
const fs = require("fs");
const path = require("path");
const arch = require("arch");
const axios = require("axios");
const rimraf = require("rimraf");
const crypto = require("crypto");
const unzipper = require("unzipper");
const fileType = require("file-type");
const { Readable } = require("stream");
const { EventEmitter } = require("events");
const { addAbortSignal } = require("stream");
const { spawn } = require("child_process");
const compareVersions = require("compare-versions");

// STUPID SOLUTION!!
let nanoid = {};
(async () => {
    nanoid = await import('nanoid');
})();

const VANILLA_ASSETS_URL = "https://resources.download.minecraft.net";
const VANILLA_LIBRARIES_URL = "https://libraries.minecraft.net";
const FORGE_LIBRARIES_URL = "https://files.minecraftforge.net/maven";
const VERSION_MANIFEST_URL = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

const FABRIC_META_URL = "https://meta.fabricmc.net/v2";
const FABRIC_LIBRARIES_URL = "https://maven.fabricmc.net";

async function isPathAccessible(location) {
    try {
        await fs.promises.access(location);
        return true;
    } catch (error) {
        return false;
    }
}

async function writeStream(stream, location, options = {}) {

    let writer = fs.createWriteStream(location);
    if (options['signal']) {
        writer = addAbortSignal(options['signal'], writer);
    }

    stream.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });

}

class Minecraft {

    constructor(options) {

        this.user = options['userInfo'];
        this.path = options['instancePath'];
        this.version = options['vanillaVersion'];
        this.runtime = options['minecraftRuntime'];
        this.extension = options['extensionPackage'];

        this.pathConfig = options['pathConfig'];

        /*
            Note: This is a temporary solution,
            code below should be refactored to use pathConfig[].
        */
        this.cache = this.pathConfig['cache'];

        this.process = null;
        this.abortSignal = options['abortSignal'];
        this.eventEmitter = options['eventEmitter'];

    }

    async _fetchAssetIndex(versionManifest) {

        let assetIndex = path.join(
            this.cache,
            "assets/indexes",
            versionManifest["assetIndex"]["id"] + ".json",
        );

        try {
            let content = await fs.promises.readFile(assetIndex, {
                signal: this.abortSignal
            });
            return JSON.parse(content);
        }
        catch (error) {

            this._rethrowAbort(error);

            let { data: content } = await axios.get(
                versionManifest["assetIndex"]["url"],
                { signal: this.abortSignal }
            );
            await fs.promises.mkdir(path.dirname(assetIndex), { recursive: true });
            await fs.promises.writeFile(
                assetIndex,
                JSON.stringify(content, null, 4),
                { signal: this.abortSignal }
            );
            
            return content;

        }

    }

    async fetchManifest() {

        let versionManifest = path.join(
            this.cache,
            this.version + ".json"
        );

        try {

            let content = JSON.parse(
                await fs.promises.readFile(
                    versionManifest,
                    { signal: this.abortSignal }
                )
            );

            content["assetIndex"]["objects"] = (await this._fetchAssetIndex(content))["objects"];
            this._manifest = content;

        } catch (error) {

            this._rethrowAbort(error);

            let response = await axios.get(VERSION_MANIFEST_URL, {
                signal: this.abortSignal
            });
            let versions = response.data["versions"];

            for (let i = 0; i < versions.length; i++) {

                let version = versions[i];

                if (version.id == this.version) {

                    let { data: content } = await axios.get(version["url"], {
                        signal: this.abortSignal
                    });
                    await fs.promises.mkdir(path.dirname(versionManifest), { recursive: true });
                    await fs.promises.writeFile(
                        versionManifest,
                        JSON.stringify(content, null, 4),
                        { signal: this.abortSignal }
                    );

                    content["assetIndex"]["objects"] = (await this._fetchAssetIndex(content))["objects"];
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
                            path: path.join(this.cache, "libraries", classifier.path),
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
                    path: path.join(this.cache, "libraries", artifact.path),
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
            /* Don't put path.join() here, this is used in an URL. */
            let filename = `${asset.hash.substring(0, 2)}/${asset.hash}`;

            files.push({
                name: path.basename(key),
                size: asset.size,
                path: path.join(this.cache, "assets/objects", filename),
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
            path: path.join(this.cache, "bin", `${this._manifest["id"]}.jar`),
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

    async download() {

        let queue = await this._verifyFileIntegrity();

        /* Get Extension Package files if missing. */
        queue = queue.concat(
            await this.extension?.verifyPackageIntegrity() || []
        );

        let total = queue.reduce((accumulator, file) => {
            return accumulator + file.size;
        }, 0);

        let loaded = 0;
        for (let i = 0; i < queue.length; i++) {

            let file = queue[i];

            await fs.promises.mkdir(path.dirname(file.path), { recursive: true });

            let response = await axios({
                url: file.url,
                method: "GET",
                responseType: "stream",
                signal: this.abortSignal
            });

            response.data.on('data', (data) => {

                loaded += Buffer.byteLength(data);

                this.eventEmitter.emit('download-progress', {
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
        
            await writeStream(response.data, file.path, { signal: this.abortSignal });

        }

        /* Prepare Extension Package for launch if any. */
        await this.extension?.install();

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
                        await writeStream(entry, path.join(directory, entry.path), { signal: this.abortSignal });
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

            const destination = path.join(directory, filepath);
            await fs.promises.mkdir(path.dirname(destination), { recursive: true });

            const assetPath = path.join(
                this.cache,
                "assets/objects",
                hash.substr(0, 2), hash
            );
            await fs.promises.copyFile(assetPath, destination);

        }

    }

    _buildLibraryString(additionalLibraries = []) {

        let string = "";
        let libraries = this._getLibraries();
        libraries = libraries.concat(additionalLibraries);
        libraries = libraries.filter(l => !l.hasOwnProperty("extract") && !l.extract);

        libraries.forEach((library, index) => {
            string += library.path;
            if (index != libraries.length - 1) {
                string += process.platform === "win32" ? ";" : ":";
            }
        });

        return string;

    }

    _getMinecraftArguments() {

        return {
            "auth_uuid": this.user['UUID'],
            "auth_player_name": this.user['playerName'],
            "auth_access_token": this.user['accessToken'],
            "assets_root": path.join(this.cache, "assets"),
            "game_assets": path.join(this.cache, "assets/virtual/legacy"),
            "assets_index_name": this._manifest["assetIndex"]["id"],
            "version_name": this._manifest["id"],
            "version_type": this._manifest["type"],
            "game_directory": this.path,
            "user_type": "mojang"
        };

    }

    _getJavaArguments() {
        
        let client = this._getJars()[0]["path"];
        let libraries = this._buildLibraryString([
            { path: client }
        ]);
        let natives = path.join(this.path, "natives");

        return [
            `-Dminecraft.applet.TargetDirectory=${this.path}`,
            `-Djava.library.path=${natives}`,
            `-Dminecraft.client.jar=${client}`,
            "-cp", `${libraries}`,
            this._manifest["mainClass"]
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

    _exit(message) {
        rimraf(path.join(this.path, "natives"), (error) => {
            if (error) this.eventEmitter.emit('internal-error', error);
        });
        this.process = null;
        this.eventEmitter.emit('process-exit', message);
    }

    _rethrowAbort(error) {
        if (error.name === "AbortError" || axios.isCancel(error)) {
            throw error;
        }
    }

    async _launch(launchArguments) {

        await fs.promises.mkdir(this.path, { recursive: true });
        await this._grabNatives(path.join(this.path, "natives"));

        if (compareVersions(this.version, "1.7.2") !== 1) {
            await this._grabAssets(path.join(this.cache, "assets/virtual/legacy"));
        }

        if (this.runtime['jvmArguments'] && this.runtime['jvmArguments'] != '' && /\s/.test(this.runtime['jvmArguments'])) {
            launchArguments = this.runtime['jvmArguments'].split(' ').concat(launchArguments);
        }

        this.process = spawn(this.runtime['path'], launchArguments, { cwd: this.path, signal: this.abortSignal });
        this.process.stdout.on("data", (data) => {
            this.eventEmitter.emit('process-stdout', data); }
        );
        this.process.stderr.on("data", (data) => {
            this.eventEmitter.emit('process-stderr', data);
        });
        this.process.on("error", (error) => {
            this.eventEmitter.emit('internal-error', error);
        });
        this.process.on("exit", (code) => {
            if (code !== null) {
                this._exit(code);
            }
        });

    }

    async launch() {

        if (compareVersions(this.version, "1.13") !== -1) {
            this._manifest["minecraftArguments"] = this._manifest["arguments"]["game"].filter(x => typeof x === "string").join(" ");
        }

        let launchArguments = this._buildLaunchArguments(this._manifest["minecraftArguments"]);
        await this._launch(launchArguments);
        
    }

    isRunning() {
        return this.process != null;
    }

    terminate(signal, reason) {
        if (this.isRunning()) {
            /* The status code of process.kill() is ignored. */
            this.process.kill(signal);
            this._exit(reason);
        }
    }

}

class MinecraftForge extends Minecraft {

    constructor(options) {
        super(options);
        this.forgeVersion = options['forgeVersion'];
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

        if (compareVersions(this.version, "1.13.2") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1) {

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

            let additionalLibraries = {
                launcher: {
                    url: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-launcher.jar`,
                    size: 0
                },
                universal: {
                    url: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`,
                    size: 0
                },
                installer: {
                    url: `https://files.minecraftforge.net/maven/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`,
                    size: 0
                }
            };
            for (const [name, library] of Object.entries(additionalLibraries)) {
                if (compareVersions(this.version, "1.13.2") === -1 || compareVersions(this.version, "1.16.5") === 1) {
                    if (name == "launcher") continue;
                }
                let response = await axios.request({
                    url: library["url"],
                    method: "HEAD",
                    signal: this.abortSignal
                });
                library["size"] = parseInt(response.headers["content-length"]);
            }

            if (additionalLibraries["launcher"].size != 0) {
                libraries.push({
                    name: `net.minecraftforge:forge:${this.forgeVersion}:launcher`,
                    downloads: {
                        artifact: {
                            size: additionalLibraries["launcher"]["size"],
                            path: `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-launcher.jar`,
                            url: additionalLibraries["launcher"]["url"]
                        }
                    }
                });
            }
            libraries.push({
                name: `net.minecraftforge:forge:${this.forgeVersion}:universal`,
                downloads: {
                    artifact: {
                        size: additionalLibraries["universal"]["size"],
                        path: `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`,
                        url: additionalLibraries["universal"]["url"]
                    }
                }
            });
            installLibraries.push({
                name: `net.minecraftforge:forge:${this.forgeVersion}:installer`,
                downloads: {
                    artifact: {
                        size: additionalLibraries["installer"]["size"],
                        path: `net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`,
                        url: additionalLibraries["installer"]["url"]
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
            if (compareVersions(this.version, "1.13.2") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1) {
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
                    method: "HEAD",
                    signal: this.abortSignal
                });
                library["size"] = parseInt(response.headers["content-length"]);
                library["path"] = path;
                library["url"] = url;
            }

        }

    }

    async _fetchForgeManifest() {

        let forgeManifest = path.join(
            this.cache,
            `forge-${this.forgeVersion}.json`
        );

        try {

            let content = await fs.promises.readFile(forgeManifest, {
                signal: this.abortSignal
            });

            this._forgeManifest = JSON.parse(content);
            
        }
        catch (error) {

            this._rethrowAbort(error);

            // Edited to run Forge 1.13 and higher, this is a temporary solution!
            let response = compareVersions(this.version, "1.13") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1 ? await axios.get(`${FORGE_LIBRARIES_URL}/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`, {
                responseType: "arraybuffer",
                signal: this.abortSignal
            }) : await axios.get(`${FORGE_LIBRARIES_URL}/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`, {
                responseType: "arraybuffer",
                signal: this.abortSignal
            });

            let buffer = Buffer.from(response.data, "binary");
            let directory = await unzipper.Open.buffer(buffer);
            let file = directory.files.find(d => d.path === "version.json");
            let content = JSON.parse(await file.buffer());

            // Edited to run Forge 1.13 and higher, this is a temporary solution!
            if (compareVersions(this.version, "1.13") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1) {
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

    async fetchManifest() {
        await super.fetchManifest();
        await this._fetchForgeManifest();
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
                path: path.join(this.cache, "libraries", library.path),
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
            let artifact = library["downloads"]["artifact"];

            if (!artifact.url || artifact.url == "") {
                continue;
            }

            files.unshift({
                name: library.name,
                size: artifact.size,
                path: path.join(this.cache, "libraries", artifact.path),
                url: artifact.url
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
        if (compareVersions(this.version, "1.13") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1) {

            let clientPath = this._getJars()[0]["path"];
            let libraryPath = path.join(this.cache, "libraries");
            let installerPath = path.join(
                this.cache, "libraries",
                this._forgeManifest["forgeInstaller"]
            );

            args.unshift(`-Dforgewrapper.librariesDir=${libraryPath}`);
            args.unshift(`-Dforgewrapper.installer=${installerPath}`);
            args.unshift(`-Dforgewrapper.minecraft=${clientPath}`);

        }

        args[args.indexOf(this._manifest["mainClass"])] = this._forgeManifest["mainClass"];

        return args;

    }

    async _verifyFileIntegrity() { // Edited to run Forge 1.13 and higher, this is a temporary solution!

        let queue = await super._verifyFileIntegrity();

        if (compareVersions(this.version, "1.13") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1) {

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

        // Edited to run Forge 1.13 and higher, this is a temporary solution!
        if (compareVersions(this.version, "1.13") !== -1) {
            this._forgeManifest["mainClass"] = "io.github.zekerzhayard.forgewrapper.installer.Main";
            this._forgeManifest["minecraftArguments"] = this._manifest["arguments"]["game"].filter(x => typeof x === "string").join(" ");
            this._forgeManifest["minecraftArguments"] += " " + this._forgeManifest["arguments"]["game"].filter(x => typeof x === "string").join(" ");
        }

        let launchArguments = this._buildLaunchArguments(this._forgeManifest["minecraftArguments"]);

        await this._launch(launchArguments);

    }

}

class MinecraftFabric extends Minecraft {

    constructor(options) {
        super(options);
        this.fabricVersion = options['fabricVersion'];
    }

    _splitDescriptor(descriptor) {
        let parts = descriptor.split(':');
        parts[0] = parts[0].replace(/\./g, '/');
        return [...parts, `${parts[1]}-${parts[2]}.jar`];
    }

    _toMavenUrl(descriptor) {
        return [
            FABRIC_LIBRARIES_URL,
            ...this._splitDescriptor(descriptor)
        ].join('/');
    }

    _toLibraryPath(descriptor) {
        return path.join(
            `${this.cache}/libraries`,
            ...this._splitDescriptor(descriptor)
        );
    }

    _toLibraryFile(descriptor) {
        return {
            name: descriptor,
            path: this._toLibraryPath(descriptor),
            url: this._toMavenUrl(descriptor)
        };
    }

    _getLibraries() {
        let files = super._getLibraries();
        for (const library of this._fabricManifest['launcherMeta']['libraries']) {
            let libraryFile = this._toLibraryFile(library['name']);
            libraryFile['size'] = library['size'];
            files.unshift(libraryFile);
        }
        return files;
    }

    async _refactorFabricManifest(manifest) {

        let libraries = [
            ...manifest['launcherMeta']['libraries']['common'],
            ...manifest['launcherMeta']['libraries']['client'],
            { name: manifest['loader']['maven'], url: `${FABRIC_LIBRARIES_URL}/` },
            { name: manifest['intermediary']['maven'], url: `${FABRIC_LIBRARIES_URL}/` }
        ];

        for (const library of libraries) {
            let { headers } = await axios.request({
                method: 'HEAD',
                url: this._toMavenUrl(library['name']),
                signal: this.abortSignal
            });
            library['size'] = parseInt(headers['content-length']);
        }

        manifest['launcherMeta']['libraries'] = libraries;
        manifest['mainClass'] = manifest['launcherMeta']['mainClass']['client'];

    }

    async _fetchFabricManifest() {

        let fabricManifest = path.join(
            this.cache,
            `fabric-${this.fabricVersion}.json`
        );

        try {
            this._fabricManifest = JSON.parse(
                await fs.promises.readFile(fabricManifest, { signal: this.abortSignal })
            );
        } catch (error) {
            this._rethrowAbort(error);

            let { data: manifest } = await axios.get(`${FABRIC_META_URL}/versions/loader/${this.version}/${this.fabricVersion}`, {
                signal: this.abortSignal
            });
            
            await this._refactorFabricManifest(manifest);

            await fs.promises.mkdir(path.dirname(fabricManifest), { recursive: true });
            await fs.promises.writeFile(fabricManifest, JSON.stringify(manifest, null, 4));

            this._fabricManifest = manifest;

        }

    }

    async fetchManifest() {
        await super.fetchManifest();
        await this._fetchFabricManifest();
    }

    _getJavaArguments() {
        let args = super._getJavaArguments();
        args[args.indexOf(this._manifest["mainClass"])] = this._fabricManifest["mainClass"];
        return args;
    }

}

class MinecraftExtension {

    constructor(activeOptions, instanceOptions) {
        this.packageName = activeOptions['id'];
        this.path = instanceOptions['instancePath'];
        this.version = activeOptions['candidateVersion'];
        this.abortSignal = activeOptions['abortSignal'];
        this.enableUpdate = activeOptions['enableUpdate'];
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

        let file = path.join(this.path, this.packageName);
        let reader = fs.createReadStream(file);
        let zip = reader.pipe(unzipper.Parse({forceStream: true}));
        let actions = await this._getActions(file);

        for await (let entry of zip) {
            
            let item = actions.find(e => entry.path.startsWith(e.name)) || {};
            if (!item.hasOwnProperty("action")) {
                continue;
            }

            let location = path.join(this.path, entry.path);
            await fs.promises.mkdir(path.dirname(location), { recursive: true });

            switch (item.action) {

                case "ADD":
                    if (entry.type === "File") {
                        if (!await isPathAccessible(location)) {
                            await writeStream(entry, location, { signal: this.abortSignal });
                            continue;
                        }
                    }
                    break;
                
                case "REPLACE":
                    if (entry.type === "File") {
                        if (await isPathAccessible(location)) {
                            await fs.promises.unlink(location);
                        }
                        await writeStream(entry, location, { signal: this.abortSignal });
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
                        await writeStream(entry, location, { signal: this.abortSignal });
                        continue;
                    }
                    break;

            }

            entry.autodrain();

        }

        reader.close();
        await fs.promises.unlink(file);

    }

    async verifyPackageIntegrity() {
        if (this.enableUpdate) {
            return [{
                name: this.packageName,
                path: path.join(this.path, this.packageName),
                url: this.version['extension']['url'],
                size: this.version['extension']['size'],
                extract: true
            }];
        }
        return [];
    }

    async install() {
        if (this.enableUpdate) {
            await this._extractModpack();
        }
    }

}

class MinecraftInstanceManager {

    static MANIFEST_VERSION = '1.0';

    constructor(rootPath) {

        this.pathConfig = {
            'base': path.normalize(rootPath),
            'cache': path.join(rootPath, 'cache'),
            'icons': path.join(rootPath, 'cache/icons'),
            'assets': path.join(rootPath, 'cache/assets'),
            'clients': path.join(rootPath, 'cache/clients'),
            'libraries': path.join(rootPath, 'cache/libraries'),
            'manifests': path.join(rootPath, 'cache/manifests'),
            'instances': path.join(rootPath, 'instances')
        };

        this.userInfo = {
            'UUID': '25966168-dc9c-360c-8f32-ed022bfa1070',
            'playerName': 'Herobrine',
            'accessToken': '{}'
        };

        this.defaultConfig = {
            'runtime': {
                'path': 'C:\\Program Files\\Java\\jre1.8.0_271\\bin\\java.exe',
                'jvmArguments': ''
            }
        };

        this.loadedIcons = {};
        this.loadedConfigs = {};
        this.activeInstances = {};

    }

    _generateId() {
        return nanoid.customAlphabet(
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
            'abcdefghijklmnopqrstuvwxyz' +
            '0123456789',
            16
        )();
    }

    _validateId(string) {
        return typeof string === 'string'
            && /^[a-zA-Z0-9]+$/.test(string)
            && string.length === 16;
    }

    _hasTypedProperty = (object, properties) => {
        properties.forEach(({ property, type }) => {
            if (!object.hasOwnProperty(property)) {
                throw new Error(`Parse: Object is missing property '${property}'.`);
            } else if (typeof object[property] !== type) {
                if (type === 'version') {
                    if (compareVersions.validate(object[property])) return;
                } else if (type === 'array') {
                    if (Array.isArray(object[property])) return;
                } else if (type === 'path') {
                    if (path.isAbsolute(object[property])) return;
                }
                throw new Error(
                    `Parse: Object has wrong data type on property '${property}', ` +
                    `found: '${typeof object[property]}', should be: '${type}'.`
                );
            }
        });
    }

    _parseConfig(object) {

        if (!this._validateId(object['id'])) {
            object['id'] = this._generateId();
        }

        this._hasTypedProperty(object, [
            { property: 'manifest', type: 'object' }
        ]);
        this._parseManifest(object['manifest']);

        this._configureManifest(object);
        
        return object;
    }

    _parseManifest(manifest) {

        if (typeof manifest !== 'object') {
            throw new Error('The manifest is invalid.');
        }

        // TODO: truncate name length
        // TODO: parse creators, description, ...

        if (!manifest['_MANIFEST_VERSION_']) {
            this._parseLegacyManifest(manifest);
            this._migrateLegacyManifest(manifest);
        }

        this._hasTypedProperty(manifest, [
            { property: '_MANIFEST_VERSION_', type: 'version' },
            { property: 'versions', type: 'array' },
            { property: 'name', type: 'string' }
        ]);

        if (Array.isArray(manifest['versions'])) {
            if (manifest['versions'].length == 0 || manifest['versions'].some(v => typeof v !== 'object')) {
                throw new Error('Parse: Manifest has no installable versions.');
            }
            manifest['versions'].forEach((version) => {
                
                this._hasTypedProperty(version, [
                    { property: 'id', type: 'version' }
                ]);

                if (!version['vanilla']) {
                    throw new Error('Missing vanilla game version.');
                }
                if (version['forge'] && version['fabric']) {
                    throw new Error('Mod Loader conflict, both Forge and Fabric were specified.');
                }
                if (typeof version['extension'] === 'object') {
                    this._hasTypedProperty(version['extension'], [
                        { property: 'size', type: 'number' },
                        { property: 'url', type: 'string' }
                    ]);
                }
                
            });
        }

        return manifest;
    }

    _configureManifest(object) {

        if (typeof object['config'] !== 'object') {
            object['config'] = {};
        }
        if (typeof object['config']['runtime'] !== 'object') {
            object['config']['runtime'] = {};
        }

        // Note: Property path cannot be empty.
        if (!object['config']['runtime']['path']) {
            object['config']['runtime']['path'] = this.defaultConfig['runtime']['path'];
        }

        // Note: Property jvmArguments can be empty.
        if (typeof object['config']['runtime']['jvmArguments'] !== 'string') {
            object['config']['runtime']['jvmArguments'] = object.manifest?.default?.jvmArguments
                || this.defaultConfig['runtime']['jvmArguments'];
        }

        // Note: Remove junk from jvmArguments, e.g. non arguments or whitespaces.
        const jvmArguments = [...object['config']['runtime']['jvmArguments'].matchAll(/-[^\s]+/g)];
        object['config']['runtime']['jvmArguments'] = jvmArguments.join(' ');

        return object;
    }

    _getInstance(instanceId, options = { isActive: false }) {

        const arrayOfInterest = options['isActive'] ?
            this.activeInstances : this.loadedConfigs;

        if (!arrayOfInterest[instanceId]) {
            if (options['isActive']) {
                throw new Error(`Instance with ID '${instanceId}' is not active.`);
            } else {
                throw new Error(`Instance with ID '${instanceId}' does not exist.`);
            }
        }

        return arrayOfInterest[instanceId];

    }

    _findCurrentVersion(config) {
        if (!config['config']['version']) return null;
        return config['manifest']['versions'].find((version) => {
            return version.id === config['config']['version'];
        });
    }

    _findLatestVersion(versions) {
        return this._sortVersions(versions)[0];
    }

    _sortVersions(array) {
        return array.sort((a, b) => {
            return compareVersions(b['id'], a['id']);
        });
    }

    _parseLegacyManifest(manifest) {

        if (typeof manifest !== 'object' || ['name', 'creators', 'description', 'versions', 'vma'].some(p => !manifest[p])
            || !Array.isArray(manifest['versions']) || manifest['versions'].length == 0
            || manifest['versions'].some(v => typeof v !== 'object')
            || manifest['versions'].some(v => ['id', 'size', 'forge', 'url'].some(p => !v[p]))) {
            throw new Error('Parse: Could not parse Legacy Manifest.');
        }

        return manifest;
    }

    _migrateLegacyManifest(manifest) {

        manifest['_MANIFEST_VERSION_'] = MinecraftInstanceManager.MANIFEST_VERSION;
        manifest['versions'] = manifest['versions'].map((version) => {

            if (typeof version['forge'] === 'string' && version['forge'].indexOf('-') !== -1) {
                version['vanilla'] = version['forge'].split('-')[0];
            }
            
            version['extension'] = {
                'size': version['size'],
                'url': version['url']
            };

            delete version['url'];
            delete version['size'];

            return version;
        });

        if (typeof manifest['vma'] === 'string') {
            manifest['default'] = {
                'jvmArguments': manifest['vma']
            };
            delete manifest['vma'];
        }

        return manifest;
    }

    _stringifyConfig(config) {
        return JSON.stringify(config, (property, value) => {
            if (property === 'manifestPath') return undefined;
            else return value;
        }, 4);
    }

    isActive(activeId) {
        return typeof this.activeInstances[activeId] !== 'undefined';
    }

    isUpToDate(loadedId) {
        let instanceConfig = this._getInstance(loadedId, { isActive: false });
        let currentVersion = this._findCurrentVersion(instanceConfig);
        let latestVersion = this._findLatestVersion(instanceConfig['manifest']['versions']);
        if (currentVersion && latestVersion) {
            return compareVersions(
                currentVersion['id'],
                latestVersion['id']
            ) === 0;
        }
        return false;
    }

    findRemote(remoteUrl) {
        return Object.values(this.loadedConfigs)
            .filter(o => o['config']['remote'])
            .find(o => o['config']['remote'] === remoteUrl);
    }

    async createDirectoryStructure() {
        for (const directory of Object.values(this.pathConfig)) {
            await fs.promises.mkdir(directory, { recursive: true });
        }
    }

    async loadConfigs() {

        // Search for manifests in this.pathConfig['manifests']

        for (const entry of await fs.promises.readdir(this.pathConfig['manifests'], { withFileTypes: true })) {
            if (entry.isFile()) {
                const manifestPath = path.join(this.pathConfig['manifests'], entry.name);
                try {
                    
                    const instanceConfig = this._parseConfig(JSON.parse(
                        await fs.promises.readFile(manifestPath)
                    ));
                    while (this.loadedConfigs[instanceConfig['id']]) {
                        instanceConfig['id'] = this._generateId();
                    }

                    instanceConfig['manifestPath'] = manifestPath;
                    this.loadedConfigs[instanceConfig['id']] = instanceConfig;
                    this.saveConfig(instanceConfig['id']).catch((error) => {
                        // log error
                    });

                } catch (error) {
                    // Log error
                }
            }
        }

        return this.loadedConfigs;
    }

    async saveConfig(loadedId) {
        let instanceConfig = this._getInstance(loadedId, { isActive: false });
        await fs.promises.writeFile(
            instanceConfig['manifestPath'],
            this._stringifyConfig(instanceConfig)
        );
    }

    async addFromRemote(remoteUrl) {
        const { data: remoteManifest } = await axios.get(remoteUrl);
        return this.addFromManifest(remoteManifest, {
            'remote': remoteUrl
        });
    }

    addFromManifest(manifest, config = {}) {

        let instanceConfig = {
            'id': null, /* Keep ID at the top */
            'manifest': this._parseManifest(manifest),
            'config': config
        };
        this._configureManifest(instanceConfig);

        do { instanceConfig['id'] = this._generateId(); }
        while (this.loadedConfigs[instanceConfig['id']]);

        instanceConfig['manifestPath'] = path.join(
            this.pathConfig['manifests'],
            `${instanceConfig['id']}.json`
        );
        this.loadedConfigs[instanceConfig['id']] = instanceConfig;

        return instanceConfig;
    }

    /* Use this function only in try...catch {} block */
    async loadIcons() {

        const supportedMimeTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"
        ];

        await fs.promises.access(this.pathConfig['icons']);
        for (const instanceConfig of Object.values(this.loadedConfigs)) {
            try {
                const iconPath = path.join(
                    this.pathConfig['icons'],
                    instanceConfig['id']
                );
                const type = await fileType.fromFile(iconPath);
                if (supportedMimeTypes.includes(type.mime)) {
                    this.loadedIcons[instanceConfig['id']] = iconPath;
                }
            } catch {}
        }

        return this.loadedIcons;

    }

    /* Residue: mkdir, missing try...catch {} block */
    async fetchIcon(loadedId) {

        let instanceConfig = this._getInstance(loadedId, { isActive: false });
        if (!instanceConfig['manifest']['icon']) {
            return;
        }

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
    
        const iconPath = path.join(
            this.pathConfig['icons'],
            instanceConfig['id']
        );
    
        try {
            let { data: stream } = await axios({
                method: "GET",
                url: instanceConfig['manifest']['icon'],
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
            await fs.promises.mkdir(this.pathConfig['icons'], { recursive: true });
            await writeStream(Readable.from(streamBuffer), iconPath);
        }

    }

    async runInstance(activeId) {
        let activeInstance = this._getInstance(activeId, { isActive: true });
        try {
            await activeInstance['instance'].fetchManifest();
            await activeInstance['instance'].download();

            this.loadedConfigs[activeId]['config']['version'] = activeInstance['candidateVersion']['id'];
            await this.saveConfig(activeId);

            await activeInstance['instance'].launch();
            activeInstance['eventEmitter'].emit('process-start');
        } catch (error) {
            activeInstance['eventEmitter'].emit('internal-error', error);
        }
    }

    async createInstance(loadedId, options = { enableUpdate: true }) {

        let instanceConfig = this._getInstance(loadedId, { isActive: false });

        const abortController = new AbortController();
        const { signal: abortSignal } = abortController;

        let activeWrapper = {
            'id': loadedId,
            'instance': null,
            'hasRemote': false,
            'enableUpdate': false,
            'candidateVersion': null,
            'abortSignal': abortSignal,
            'abortController': abortController,
            'eventEmitter': new EventEmitter()
        };

        if (instanceConfig['config']['remote']) {

            const { data: remoteManifest } = await axios.get(instanceConfig['config']['remote'], {
                signal: abortSignal
            });
    
            try {
                instanceConfig['manifest'] = this._parseManifest(remoteManifest);
                activeWrapper['hasRemote'] = true;
            } catch(error) {
                // could not parse remote manifest, using local
                // log error
            }

            if (activeWrapper['hasRemote']) {
                await this.saveConfig(instanceConfig['id']);
            }

        }

        activeWrapper['candidateVersion'] = this._findCurrentVersion(instanceConfig);
        if (!activeWrapper['candidateVersion'] || (options['enableUpdate'] && !this.isUpToDate(instanceConfig['id']))) {
            activeWrapper['candidateVersion'] = this._findLatestVersion(instanceConfig['manifest']['versions']);
            activeWrapper['enableUpdate'] = true;
        }

        const instancePath = path.join(
            this.pathConfig['instances'],
            instanceConfig['id']
        );

        let instanceOptions = {
            'pathConfig': this.pathConfig,
            'userInfo': this.userInfo,
            'instancePath': instancePath,
            'minecraftRuntime': instanceConfig['config']['runtime'],
            'vanillaVersion': activeWrapper['candidateVersion']['vanilla'],
            'fabricVersion': activeWrapper['candidateVersion']['fabric'],
            'forgeVersion': activeWrapper['candidateVersion']['forge'],
            'eventEmitter': activeWrapper['eventEmitter'],
            'abortSignal': activeWrapper['abortSignal']
        };

        if (typeof activeWrapper['candidateVersion']['extension'] === 'object') {
            instanceOptions['extensionPackage'] = new MinecraftExtension(
                activeWrapper, instanceOptions
            );
        }

        if (instanceOptions['forgeVersion']) {
            activeWrapper['instance'] = new MinecraftForge(instanceOptions);
        } else if (instanceOptions['fabricVersion']) {
            activeWrapper['instance'] = new MinecraftFabric(instanceOptions);
        } else if (instanceOptions['vanillaVersion']) {
            activeWrapper['instance'] = new Minecraft(instanceOptions);
        } else {
            throw new Error('');
        }

        this.activeInstances[loadedId] = activeWrapper;
        return activeWrapper['eventEmitter'];

    }

    destroyInstance(activeId, reason) {
        
        let activeInstance = this._getInstance(activeId, { isActive: true });
        
        if (activeInstance['instance'].isRunning()) {
            activeInstance['instance'].terminate('SIGKILL', reason);
        } else {
            activeInstance['abortController']
                .abort(reason);
        }
        
        delete this.activeInstances[activeId];

    }

    setUserInfo(userInfo) {
        this.userInfo = userInfo;
    }

    setDefaultConfig(defaultConfig) {
        this.defaultConfig = defaultConfig;
    }

    setConfig(loadedId, config) {
        this._getInstance(loadedId, { isActive: false })['config'] = config;
    }

}

module.exports = { MinecraftInstanceManager };
