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
const { addAbortSignal } = require("stream");

module.exports = class FsUtil {

    static async isPathAccessible(location) {
        try {
            await fs.promises.access(location);
            return true;
        } catch (error) {
            return false;
        }
    }

    static async writeStream(stream, location, options = {}) {

        let writer = fs.createWriteStream(location);
        if (options['signal']) {
            writer = addAbortSignal(options['signal'], writer);
        }
    
        stream.pipe(writer);
    
        return new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });
    
    }

};
