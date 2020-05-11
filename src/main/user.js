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

const { machineIdSync } = require("node-machine-id");
const auth = require("./auth.js");
const helper = require("../common/helper.js");
const Storage = require("./storage.js");

class User { // TODO: Improve error messages.

    constructor(path) {

        this.storage = new Storage({
            data: {
                id: null,
                nickname: null,
                accessToken: null
            },
            path: path
        });

        let id = this.storage.get("id");
        let nickname = this.storage.get("nickname");
        let accessToken = this.storage.get("accessToken");

        this.id = id || this.offlineId;
        this.nickname = nickname;
        this.accessToken = accessToken;
        this.clientToken = machineIdSync(true);
        this.online = helper.uuid3(`OfflinePlayer:${nickname}`) !== id;

    }

    save() {

        this.storage.set("id", this.id);
        this.storage.set("nickname", this.nickname);
        this.storage.set("accessToken", this.accessToken);

        this.storage.save();

    }

    load(data) {

        if (data["status"] === 200) {

            if (data.hasOwnProperty("id") && data.hasOwnProperty("name") && data.hasOwnProperty("clientToken") && data.hasOwnProperty("accessToken")) {

                this.id = data["id"];
                this.nickname = data["name"];
                this.clientToken = data["clientToken"];
                this.accessToken = data["accessToken"];

                this.save();

            }
    
        }

    }

    authenticate(username, password) {

        return new Promise((resolve, reject) => {

            if (this.online) {

                if (username && password) {
                
                    auth.login(username, password, this.clientToken).then((response) => { this.load(response); resolve(response); }).catch(reject);
    
                } else {
                    reject({
                        code: "ENOCRED",
                        message: "Credentials cannot be empty!"
                    });
                }

            } else {

                if (typeof username === "string" && username.length >= 3) {
                    
                    this.nickname = username;
                    this.id = helper.uuid3(`OfflinePlayer:${username}`);

                    this.save();

                    resolve();
                    
                } else {
                    reject({
                        code: "EINCRED",
                        message: "Invalid credentials!"
                    });
                }

            }

        });

    }

    reauthenticate() {

        return new Promise((resolve, reject) => {

            if (this.online) {

                if (this.clientToken && this.accessToken) {
                
                    auth.validate(this.clientToken, this.accessToken).then((response) => { this.load(response); resolve(response); }).catch((error) => {
                        
                        auth.refresh(this.clientToken, this.accessToken).then((response) => { this.load(response); resolve(response); }).catch((error) => {
    
                            this.id = null;
                            this.nickname = null;
                            this.clientToken = null;
                            this.accessToken = null;

                            this.save();
    
                            reject(error);
    
                        });
        
                    });
    
                } else {
                    reject({
                        code: "ENOCRED",
                        message: "Credentials cannot be empty!"
                    });
                }

            } else {

                if (this.nickname && this.nickname.length >= 3) {

                    resolve();
                    
                } else {
                    reject({
                        code: "EINCRED",
                        message: "Invalid credentials!"
                    });
                }

            }

        });

    }

    invalidate() {

        if (this.online) {
            auth.invalidate(this.clientToken, this.accessToken);
        }

        this.id = null;
        this.nickname = null;
        this.accessToken = null;

        this.save();

    }

}

module.exports = User;
