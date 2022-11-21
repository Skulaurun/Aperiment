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
const rimraf = require("rimraf");
const unzipper = require("unzipper");

const FsUtil = require("../utils/FsUtil.js");

module.exports = class MinecraftExtension {

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
                            await FsUtil.writeStream(entry, location, { signal: this.abortSignal });
                            continue;
                        }
                    }
                    break;
                
                case "REPLACE":
                    if (entry.type === "File") {
                        if (await isPathAccessible(location)) {
                            await fs.promises.unlink(location);
                        }
                        await FsUtil.writeStream(entry, location, { signal: this.abortSignal });
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
                        await FsUtil.writeStream(entry, location, { signal: this.abortSignal });
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

};
