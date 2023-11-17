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

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const CommonRoute = require('./CommonRoute.js');

module.exports = async function getVersionList(rootPath) {

    let versionList = {
        'minecraft': {
            url: CommonRoute['VANILLA_META'],
            versions: []
        },
        'forge': {
            url: CommonRoute['FORGE_META'],
            versions: []
        },
        'fabric': {
            url: `${CommonRoute['FABRIC_META']}/versions/loader`,
            versions: []
        }
    };

    for (const [type, object] of Object.entries(versionList)) {
        const filePath = path.join(rootPath, `${type}-meta.json`);
        try {
            const { data: responseText } = await axios.get(object['url']);
            if (type === 'minecraft') {
                object['versions'] = responseText['versions']
                    .map((o) => {
                        return {
                            id: o['id'],
                            type: o['type'],
                            time: o['releaseTime']
                        };
                    });
            } else if (type === 'fabric') {
                object['versions'] = responseText
                    .map((o) => {
                        return {
                            id: o['version'],
                            stable: o['stable']
                        };
                    });
            } else if (type === 'forge') {
                object['versions'] = Array.from(
                    responseText?.matchAll(/<version>(.+?)<\/version>/g),
                    match => match[1]
                ).map((o) => {
                    return {
                        id: o
                    };
                });
            }
            await fs.promises.writeFile(
                filePath,
                JSON.stringify(object['versions'], null, 4)
            );
        } catch (error) {
            const content = JSON.parse(
                await fs.promises.readFile(filePath)
            );
            if (Array.isArray(content)) {
                object['versions'] = content;
            }
        }
    }

    return versionList;

}
