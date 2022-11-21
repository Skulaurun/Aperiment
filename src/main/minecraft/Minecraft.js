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
const unzipper = require("unzipper");
const { spawn } = require("child_process");
const compareVersions = require("compare-versions");

const FsUtil = require("./FsUtil.js");
const CommonRoute = require('./CommonRoute.js');

module.exports = class Minecraft {

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

            let response = await axios.get(CommonRoute['VANILLA_META'], {
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
                url: `${CommonRoute['VANILLA_ASSETS']}/${filename}`
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
        
            await FsUtil.writeStream(response.data, file.path, { signal: this.abortSignal });

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
                        await FsUtil.writeStream(entry, path.join(directory, entry.path), { signal: this.abortSignal });
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

};
