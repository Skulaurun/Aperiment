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

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const Minecraft = require('./Minecraft.js');
const CommonRoute = require('./CommonRoute.js');

module.exports = class MinecraftFabric extends Minecraft {

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
            CommonRoute['FABRIC_LIBRARIES'],
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
            { name: manifest['loader']['maven'], url: `${CommonRoute['FABRIC_LIBRARIES']}/` },
            { name: manifest['intermediary']['maven'], url: `${CommonRoute['FABRIC_LIBRARIES']}/` }
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
        /* Possible Bug (mainClass not an array) */
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

            let { data: manifest } = await axios.get(`${CommonRoute['FABRIC_META']}/versions/loader/${this.version}/${this.fabricVersion}`, {
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

};
