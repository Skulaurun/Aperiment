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

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const unzipper = require("unzipper");
const compareVersions = require("compare-versions");

const Minecraft = require('./Minecraft.js');
const CommonRoute = require('./CommonRoute.js');

module.exports = class MinecraftForge extends Minecraft {

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

            let url = library.hasOwnProperty("url") ? `${CommonRoute['FORGE_LIBRARIES']}/${path}` : `${CommonRoute['VANILLA_LIBRARIES']}/${path}`;
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
            let response = compareVersions(this.version, "1.13") !== -1 || compareVersions(this.forgeVersion, "1.12.2-14.23.5.2851") !== -1 ? await axios.get(`${CommonRoute['FORGE_LIBRARIES']}/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-installer.jar`, {
                responseType: "arraybuffer",
                signal: this.abortSignal
            }) : await axios.get(`${CommonRoute['FORGE_LIBRARIES']}/net/minecraftforge/forge/${this.forgeVersion}/forge-${this.forgeVersion}-universal.jar`, {
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

};
