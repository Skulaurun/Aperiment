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

const crypto = require("crypto");

const helper = {

    mergeObjects(target, ...sources) {

        sources.forEach((source) => {
            Object.keys(source).forEach((key) => {
                target[key] = target[key] && source[key] && typeof target[key] === "object" && typeof source[key] === "object" ? this.mergeObjects(target[key], source[key]) : source[key];
            });
        });
        
        return target;

    },

    flattenObject(target, parent) {

        var result = {};

        for (var key in target) {

            var value = target[key];
            var path = parent ? `${parent}.${key}` : key;

            if (Object.prototype.toString.call(value) === "[object Object]") {
                this.mergeObjects(result, this.flattenObject(value, path));
            } else {
                result[path] = value;
            }

        }

        return result;

    },

    isJson(data) {

        if (typeof data !== "string") { return false; }
    
        try {
    
            var json = JSON.parse(data);
            var type = Object.prototype.toString.call(json);
    
            return type === "[object Object]" || type === "[object Array]";
    
        } catch (err) {
            return false;
        }
    
    },

    uuid3(data) {

        let bytes = crypto.createHash("md5").update(data).digest();
    
        bytes[6] &= 0x0f;
        bytes[6] |= 0x30;
        bytes[8] &= 0x3f;
        bytes[8] |= 0x80;
    
        return bytes.toString("hex");
    
    }

};

module.exports = helper;
