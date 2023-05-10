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

/*
    The purpose of JarUtil is to patch signed minecraft client.jar,
    and trick JNI ClassLoader into thinking that the JAR is unsigned,
    thus allowing us to load classes from legacy Forge versions.

    JarUtil does so by modifying 10 bytes of End of Central Directory (EOCD) record,
    Minecraft's META-INF/ folder is always located at the start of the central directory,
    so let's say that the central directory starts after META-INF/ and done!
    
    Mojang's certificates remain visible to ZIP parsers that do not rely on EOCD.
*/

module.exports = class JarUtil {

    static _readEndOfCentralDirectory(buffer) {
        let offset = -1;
        for (let i = buffer.length - 4; i >= 0; i--) {
            if (buffer.readUint32LE(i) === 0x06054b50 /* End of Central Directory Signature */) {
                offset = i;
            }
        }
        if (offset == -1) {
            throw new Error('End of Central Directory could not be found.');
        }
        return {
            offset,
            start: buffer.readUint32LE(offset + 16),
            size: buffer.readUint32LE(offset + 12),
            count: buffer.readUint16LE(offset + 10)
        };
    }

    static _readCentralDirectory(buffer) {
        let entries = [];
        const EOCD = this._readEndOfCentralDirectory(buffer);
        for (let offset = EOCD.start; offset < EOCD.start + EOCD.size;) {
            if (buffer.readUint32LE(offset) === 0x02014b50 /* Central Directory Signature */) {

                const fileNameLength = buffer.readUint16LE(offset + 28);
                const extraFieldLength = buffer.readUint16LE(offset + 30);
                const fileCommentLength = buffer.readUint16LE(offset + 32);
                const totalSize = 46 + fileNameLength + extraFieldLength + fileCommentLength;
                
                const fileName = buffer.toString('utf-8', offset + 46, offset + 46 + fileNameLength);

                entries.push({
                    offset,
                    name: fileName,
                    size: totalSize
                });

                offset += totalSize;

            } else {
                offset++;
            }
        }
        return {
            EOCD,
            entries
        };
    }

    static trim(buffer, toSkip = 'META-INF/') {
        const { EOCD, entries } = this._readCentralDirectory(buffer);
        for (let i = 0; i < entries.length; i++) {
            if (entries[i]['name'].startsWith(toSkip)) {
                EOCD.start += entries[i].size;
                EOCD.size -= entries[i].size;
                EOCD.count--;
            }
        }
        buffer.writeUint32LE(EOCD.start, EOCD.offset + 16);
        buffer.writeUint32LE(EOCD.size, EOCD.offset + 12);
        buffer.writeUint16LE(EOCD.count, EOCD.offset + 10);
        return buffer;
    }

}
