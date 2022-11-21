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

const axios = require("axios");

module.exports = class Auth {

    static CLIENT_ID = "c1348caf-f18f-49d9-b63a-8e5cb0f7dd3b";

    static Endpoint = {
        "ACCESS_TOKEN": "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        "USER_XBOX_LIVE": "https://user.auth.xboxlive.com/user/authenticate",
        "XSTS_XBOX_LIVE": "https://xsts.auth.xboxlive.com/xsts/authorize",
        "MINECRAFT_TOKEN": "https://api.minecraftservices.com/authentication/login_with_xbox",
        "MINECRAFT_PROFILE": "https://api.minecraftservices.com/minecraft/profile",
        "MINECRAFT_STORE": "https://api.minecraftservices.com/entitlements/mcstore",
        "REDIRECT_URI": "http://localhost:46969/"
    };

    /*
    *   userCredential: Either a Refresh Token or Authorization Code
    *   isLauncherAction: Used to switch between these two actions (true - refresh token, false - authorization code)
    */
    static async loginToMinecraft(userCredential, isLauncherAction) {

        const [userAccessToken, userRefreshToken] = isLauncherAction ?
            await Auth.refreshAccessToken(userCredential) :
            await Auth.negotiateAccessToken(userCredential);
        
        const [userHash, xblToken] = await Auth.authenticateWithXboxLive(userAccessToken);
        const xstsToken = await Auth.negotiateXboxLiveSecurityToken(xblToken);
        const minecraftAccessToken = await Auth.authenticateWithMinecraft(userHash, xstsToken);
        const { UUID, username } = await Auth.obtainMinecraftProfile(minecraftAccessToken);

        return {
            UUID: UUID,
            username: username,
            userRefreshToken: userRefreshToken,
            minecraftAccessToken: minecraftAccessToken
        };

    }

    static async negotiateAccessToken(userAccessCode) {

        const { data: response } = await Auth._post(Auth.Endpoint["ACCESS_TOKEN"], new URLSearchParams({
            "scope": "XboxLive.signin XboxLive.offline_access",
            "redirect_uri": Auth.Endpoint["REDIRECT_URI"],
            "client_id": Auth.CLIENT_ID,
            "grant_type": "authorization_code",
            "code": userAccessCode
        }));

        if (!response || !response["access_token"] || !response["refresh_token"]) {
            throw new Error("The server sent a response that the client could not understand.");
        }

        return [
            response["access_token"],
            response["refresh_token"]
        ];

    }

    static async refreshAccessToken(userRefreshToken) {

        const { data: response } = await Auth._post(Auth.Endpoint["ACCESS_TOKEN"], new URLSearchParams({
            "scope": "XboxLive.signin XboxLive.offline_access",
            "redirect_uri": Auth.Endpoint["REDIRECT_URI"],
            "client_id": Auth.CLIENT_ID,
            "grant_type": "refresh_token",
            "refresh_token": userRefreshToken
        }));

        if (!response || !response["access_token"] || !response["refresh_token"]) {
            throw new Error("The server sent a response that the client could not understand.");
        }

        return [
            response["access_token"],
            response["refresh_token"]
        ];

    }

    static async authenticateWithXboxLive(userAccessToken) {

        const { data: response } = await Auth._post(Auth.Endpoint["USER_XBOX_LIVE"], {
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": `d=${userAccessToken}`
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT"
        });

        if (!response || !response["Token"] || !response["DisplayClaims"]) {
            throw new Error("The server sent a response that the client could not understand.");
        }

        return [
            response["DisplayClaims"]["xui"][0]["uhs"],
            response["Token"]
        ];
        
    }

    static async negotiateXboxLiveSecurityToken(xboxLiveToken) {

        const { data: response } = await Auth._post(Auth.Endpoint["XSTS_XBOX_LIVE"], {
            "Properties": {
                "SandboxId": "RETAIL",
                "UserTokens": [
                    xboxLiveToken
                ]
            },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT"
        });

        if (!response || !response["Token"]) {
            throw new Error("The server sent a response that the client could not understand.");
        }

        return response["Token"];

    }

    static async authenticateWithMinecraft(userHash, xstsToken) {

        const { data: response } = await Auth._post(Auth.Endpoint["MINECRAFT_TOKEN"], {
            "identityToken": `XBL3.0 x=${userHash};${xstsToken}`
        });

        if (!response || !response["access_token"]) {
            throw new Error("The server sent a response that the client could not understand.");
        }

        return response["access_token"];

    }

    static async obtainMinecraftProfile(minecraftAccessToken) {

        const { data: response } = await Auth._get(Auth.Endpoint["MINECRAFT_PROFILE"], minecraftAccessToken);

        if (!response || !response["id"] || !response["name"]) {
            throw new Error("The server sent a response that the client could not understand.");
        }

        return {
            UUID: response["id"],
            username: response["name"]
        };

    }

    static async checkGameOwnership(minecraftAccessToken) {
        Auth._get(Auth.Endpoint["MINECRAFT_STORE"], minecraftAccessToken);
        // ...
    }

    static async _post(url, postData) {

        let requestHeaders = {
            "Accept": "application/json"
        };

        requestHeaders["Content-Type"] = postData instanceof URLSearchParams ?
            "application/x-www-form-urlencoded" : "application/json";

        return axios.post(url, postData, {
            headers: requestHeaders
        });

    }

    static async _get(url, bearer) {

        let requestHeaders = {
            "Accept": "application/json",
            "Authorization": `Bearer ${bearer}`
        };

        return axios.get(url, {
            headers: requestHeaders
        });

    }

};
