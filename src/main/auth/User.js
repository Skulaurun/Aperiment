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

const crypto = require("crypto");

const Config = require("../Config.js");
const Auth = require("./Auth.js");

module.exports = class User {

    constructor(path) {

        this.storage = new Config({
            data: {
                id: null,
                nickname: null,
                accessToken: null,
                refreshToken: null
            },
            path: path
        });

        this.id = this.storage.get("id");
        this.nickname = this.storage.get("nickname");
        this.accessToken = this.storage.get("accessToken");
        this.refreshToken = this.storage.get("refreshToken");

        this.isAuthenticated = false;
        this.online = this.offlineUUID(this.nickname) !== this.id;

    }

    saveToFile() {

        this.storage.set("id", this.id);
        this.storage.set("nickname", this.nickname);
        this.storage.set("accessToken", this.accessToken);
        this.storage.set("refreshToken", this.refreshToken);

        this.storage.save();

    }

    async login(userCredential, isOnline, isFromMemory) {

        if (isOnline) {

            const authObject = await Auth.loginToMinecraft(userCredential, isFromMemory);

            this.id = authObject.UUID;
            this.nickname = authObject.username;
            this.refreshToken = authObject.userRefreshToken;
            this.accessToken = authObject.minecraftAccessToken;

        } else {

            if (!userCredential || userCredential.length < 3) {
                throw new Error("The username is too short.");
            }

            this.nickname = userCredential;
            this.id = this.offlineUUID(userCredential);

        }

        this.isAuthenticated = true;
        this.saveToFile();

    }

    async loginFromMemory() {

        if (!this.nickname && !this.refreshToken) {
            throw new Error("No credentials to load.");
        }

        return await this.login(this.online ? this.refreshToken : this.nickname, this.online, true);

    }

    logout() {

        this.id = null;
        this.nickname = null;
        this.accessToken = null;
        this.refreshToken = null;

        this.isAuthenticated = false;
        this.saveToFile();

    }

    offlineUUID(username) {
        return this._uuid3(`OfflinePlayer:${username}`);
    }

    _uuid3(data) {
        let bytes = crypto.createHash("md5").update(data).digest();
        bytes[6] &= 0x0f;
        bytes[6] |= 0x30;
        bytes[8] &= 0x3f;
        bytes[8] |= 0x80;
        return bytes.toString("hex");
    }

};
