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

const request = require("./request.js");

function defaultErrorHandler(error, callback) {

    if (!error.code && error.response && error.response.data) {

        let response = error.response;
        let data = response.data;

        callback({
            code: response["status"],
            message: data["errorMessage"]
        });

    } else {

        callback({
            code: error.code,
            message: error.toString()
        });

    }

}

const auth = {

    server: "https://authserver.mojang.com",

    online: function() {

        return new Promise((resolve, reject) => {

            request({
                method: "GET",
                url: this.server
            }).then((response) => {

                let data = response.data;

                resolve({
                    status: response["status"],
                    message: data["Status"]
                });

            }).catch((error) => { defaultErrorHandler(error, reject); });

        });

    },

    login: function(username, password, clientToken) {

        return new Promise((resolve, reject) => {

            request({
                method: "POST",
                url: this.server + "/authenticate",
                data: {
                    agent: {
                        name: "Minecraft",
                        version: 1
                    },
                    username: username,
                    password: password,
                    clientToken: clientToken,
                    requestUser: true
                }
            }).then((response) => {
               
                let data = response.data;

                resolve({
                    status: response["status"],
                    id: data["selectedProfile"]["id"],
                    name: data["selectedProfile"]["name"],
                    clientToken: data["clientToken"],
                    accessToken: data["accessToken"]
                });

            }).catch((error) => { defaultErrorHandler(error, reject); });

        });

    },
    logout: function(username, password) {

        return new Promise((resolve, reject) => {

            request({
                method: "POST",
                url: this.server + "/signout",
                data: {
                    username: username,
                    password: password
                }
            }).then((response) => {

                resolve({
                    status: response["status"]
                });

            }).catch((error) => { defaultErrorHandler(error, reject); });

        });

    },
    validate: function(clientToken, accessToken) {

        return new Promise((resolve, reject) => {

            request({
                method: "POST",
                url: this.server + "/validate",
                data: {
                    clientToken: clientToken,
                    accessToken: accessToken
                }
            }).then((response) => {

                resolve({
                    status: response["status"]
                });

            }).catch((error) => { defaultErrorHandler(error, reject); });

        });

    },
    invalidate: function(clientToken, accessToken) {

        return new Promise((resolve, reject) => {

            request({
                method: "POST",
                url: this.server + "/invalidate",
                data: {
                    clientToken: clientToken,
                    accessToken: accessToken
                }
            }).then((response) => {

                resolve({
                    status: response["status"]
                });

            }).catch((error) => { defaultErrorHandler(error, reject); });

        });

    },
    refresh: function(clientToken, accessToken) {

        return new Promise((resolve, reject) => {

            request({
                method: "POST",
                url: this.server + "/refresh",
                data: {
                    clientToken: clientToken,
                    accessToken: accessToken,
                    requestUser: true
                }
            }).then((response) => {

                let data = response.data;

                resolve({
                    status: response["status"],
                    id: data["selectedProfile"]["id"],
                    name: data["selectedProfile"]["name"],
                    clientToken: data["clientToken"],
                    accessToken: data["accessToken"]
                });

            }).catch((error) => { defaultErrorHandler(error, reject); });

        });

    }

}

module.exports = auth;
