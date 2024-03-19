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

export default class VersionList {

    constructor(data) {
        this.minecraft = data['minecraft']['versions'];
        this.fabric = data['fabric']['versions'];
        this.forge = data['forge']['versions'];
    }

    getMinecraft(isStable) {
        return this.minecraft.filter(x => !isStable || x.type === 'release');
    }

    getFabric(gameVersion, isStable) {
        if (typeof gameVersion === 'string') {
            gameVersion = this.minecraft.find(x => x.id === gameVersion);
        }
        if (this.hasFabric(gameVersion)) {
            return this.fabric.filter(x => !isStable || x.stable);
        } else {
            return [];
        }
    }

    getForge(gameVersion, isStable) {
        if (typeof gameVersion === 'string') {
            gameVersion = this.minecraft.find(x => x.id === gameVersion);
        }
        if (this.hasForge(gameVersion)) {
            return this.forge.filter(x => x.id.split('-').shift() === gameVersion.id)
                .filter(x => !isStable || !x.id.match(/[^\.\-\d\s]/));
        } else {
            return [];
        }
    }

    hasForge(gameVersion) {

        if (typeof gameVersion === 'string') {
            gameVersion = this.minecraft.find(x => x.id === gameVersion);
        }

        /* Minecraft 1.0 Release */
        const firstRelease = new Date('2011-11-17T22:00:00+00:00')
            .getTime();

        const releaseTime = new Date(gameVersion.time)
            .getTime();

        return gameVersion.type === 'release' && releaseTime != firstRelease;

    }

    hasFabric(gameVersion) {

        if (typeof gameVersion === 'string') {
            gameVersion = this.minecraft.find(x => x.id === gameVersion);
        }

        /* First Minecraft snapshot (18w43b) for Fabric */
        const snapshot18w43b = new Date('2018-10-24T15:02:30+00:00')
            .getTime();

        const releaseTime = new Date(gameVersion.time)
            .getTime();

        return releaseTime >= snapshot18w43b;

    }

}
