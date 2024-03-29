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

const os = require("os");
const fs = require("fs");
const path = require("path");
const arch = require("arch");
const axios = require("axios");
const unzipper = require("unzipper");
const { spawn } = require("child_process");
const compareVersions = require("compare-versions");

const FsUtil = require("../utils/FsUtil.js");
const CommonRoute = require('./CommonRoute.js');

module.exports = class Minecraft {

    constructor(options) {

        this.os = ({
            'Windows_NT': 'windows',
            'Linux': 'linux',
            'Darwin': 'osx'
        })[os.type()];

        this.user = options['userInfo'];
        this.path = options['instancePath'];
        this.version = options['vanillaVersion'];
        this.runtime = options['minecraftRuntime'];
        this.extension = options['extensionPackage'];

        /* Note: Convert value to boolean (isset) */
        this.useLocalRuntime = !!this.runtime['path'];

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

    async _fetchRuntimeManifest() {

        let systemName = ({
            "Windows_NT": "windows",
            "Darwin": "mac-os",
            "Linux": "linux"
        })[os.type()];

        if (os.type() === "Windows_NT") {
            systemName += `-${arch()}`;
        }

        let runtimeManifest = path.join(
            this.pathConfig['cache'],
            `${this._runtimeVersion}-${systemName}.json`
        );

        try {
            this._runtimeManifest = JSON.parse(
                await fs.promises.readFile(
                    runtimeManifest,
                    { signal: this.abortSignal }
                )
            );
        } catch (error) {

            this._rethrowAbort(error);

            let { data: platformManifest } = await axios.get(CommonRoute['JAVA_RUNTIME'], {
                signal: this.abortSignal
            });

            let platformRuntime = platformManifest[systemName];
            if (platformRuntime) {
                let runtimeVersion = platformRuntime[this._runtimeVersion]?.at(0);
                if (runtimeVersion) {
                    let { data: manifestContent } = await axios.get(runtimeVersion['manifest']['url'], {
                        signal: this.abortSignal
                    });
                    await fs.promises.mkdir(path.dirname(runtimeManifest), { recursive: true });
                    await fs.promises.writeFile(
                        runtimeManifest,
                        JSON.stringify(manifestContent, null, 4),
                        { signal: this.abortSignal }
                    );
                    this._runtimeManifest = manifestContent;
                }
            }

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

            let { data: versionList } = await axios.get(CommonRoute['VANILLA_META'], {
                signal: this.abortSignal
            });

            for (const version of versionList["versions"]) {
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

                }
            }

            if (!this._manifest) {
                throw new Error(`Version ${this.version} wasn't found in the version manifest.`);
            }

        }

        this._runtimeVersion = this._manifest['javaVersion']?.component || 'jre-legacy';
        await this._fetchRuntimeManifest();

    }

    _isAllowed(library) {

        let allowed = {
            windows: false,
            linux: false,
            osx: false
        };

        if (library["rules"]) {
            for (const rule of library.rules) {

                let action = rule.action == "allow" ? true : false;

                if (rule["os"]) {
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

        return allowed[this.os];

    }

    _getLibraries() {

        let files = [];

        let libraries = this._manifest["libraries"];
        for (let i = 0; i < libraries.length; i++) {

            let library = libraries[i];
            if (!this._isAllowed(library)) {
                continue;
            }

            if (library["downloads"].hasOwnProperty("classifiers")) {

                let classifiers = library["downloads"]["classifiers"];

                let natives = null;
                if (library.hasOwnProperty("natives") && library["natives"].hasOwnProperty(this.os)) {
                    
                    natives = library["natives"][this.os];
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
            path: path.join(
                this.cache,
                `clients/${this._manifest["id"]}.jar`
            ),
            url: client.url
        });

        return files;
        
    }

    _getRuntime() {
        let files = [];
        if (!this.useLocalRuntime) {
            for (const [name, object] of Object.entries(this._runtimeManifest["files"])) {
                if (object["type"] === "file") {
                    let artifact = object["downloads"]["raw"];
                    files.push({
                        name: path.basename(name),
                        size: artifact.size,
                        path: path.join(
                            this.cache,
                            `runtime/${this._runtimeVersion}/${name}`
                        ),
                        url: artifact.url
                    });
                }
            }
        }
        return files;
    }

    async _verifyFileIntegrity() {

        let queue = [], files = [];
        files = files.concat(this._getJars());
        files = files.concat(this._getAssets());
        files = files.concat(this._getLibraries());
        files = files.concat(this._getRuntime());

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

        await fs.promises.rm(directory, { recursive: true, force: true });
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
                string += path.delimiter;
            }
        });

        return string;

    }

    _getMinecraftArguments() {

        return {
            "auth_uuid": this.user['UUID'],
            "auth_player_name": this.user['playerName'],
            "auth_access_token": this.user['accessToken'],
            "auth_session": `token:${this.user['accessToken']}:${this.user['UUID']}`,
            "assets_root": path.join(this.cache, "assets"),
            "game_assets": path.join(this.cache, "assets/virtual/legacy"),
            // Setting this to non-existent directory fixes gameDirectory changing for some legacy versions
            //"game_assets": path.join(this.cache, "assets/virtual/legacy/dirty-fix"), // fix 1.2.3 non existent dir
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

        // Fix offline mode due to a change in Mojang's auth servers
        let offlineMode = [];
        if (['1.16.5', '1.16.4'].includes(this.version)) {
            if (this.user['accessToken'] == '{}') {
                let invalid = 'https://mpfix.invalid';
                offlineMode = [
                    `-Dminecraft.api.auth.host=${invalid}`,
                    `-Dminecraft.api.account.host=${invalid}`,
                    `-Dminecraft.api.session.host=${invalid}`,
                    `-Dminecraft.api.services.host=${invalid}`
                ];
            }
        }

        return [
            `-Dminecraft.applet.TargetDirectory=${this.path}`,
            `-Djava.library.path=${natives}`,
            `-Dminecraft.client.jar=${client}`,
            ...offlineMode,
            "-cp", `${libraries}`,
            this._manifest["mainClass"]
        ];

    }

    _buildLaunchArguments(template) {

        let minecraftArguments = this._getMinecraftArguments();
        let javaArguments = this._getJavaArguments();

        template = template.split(" ");
        for (let [index, argument] of Object.entries(template)) {
            if (argument.startsWith("${") && argument.endsWith("}")) {
                let name = argument.substring(2, argument.length - 1);
                if (minecraftArguments.hasOwnProperty(name)) {
                    template[index] = minecraftArguments[name];
                } else {
                    template[index] = "{}";
                }
            }
        }

        return javaArguments.concat(template);

    }

    _exit(message) {
        this.process = null;
        this.eventEmitter.emit('process-exit', message);
        fs.promises.rm(path.join(this.path, "natives"), { recursive: true, force: true })
            .catch(()=>{}); // TODO: Log error
    }

    _rethrowAbort(error) {
        if (error.name === "AbortError" || axios.isCancel(error)) {
            throw error;
        }
    }

    async _launch(launchArguments) {

        await fs.promises.mkdir(this.path, { recursive: true });
        await this._grabNatives(path.join(this.path, "natives"));

        if (compareVersions(this.version, "1.6") === -1) {
            await this._grabAssets(path.join(this.path, "resources"));
        } else if (compareVersions(this.version, "1.7.2") !== 1) {
            await this._grabAssets(path.join(this.cache, "assets/virtual/legacy"));
        }

        if (this.runtime['jvmArguments'] && this.runtime['jvmArguments'] != '' && /\s/.test(this.runtime['jvmArguments'])) {
            launchArguments = this.runtime['jvmArguments'].split(' ').concat(launchArguments);
        }

        let runtimePath = path.join(
            this.cache,
            `runtime/${this._runtimeVersion}/bin/java.exe`
        );
        if (this.useLocalRuntime) {
            runtimePath = this.runtime['path'];
        }

        this.process = spawn(runtimePath, launchArguments, { cwd: this.path, signal: this.abortSignal });
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
