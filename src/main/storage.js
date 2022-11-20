/*
 *
 *   A-Periment - Custom minecraft launcher
 *   Copyright (C) 2020 - 2022 Adam Charvát
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
 *   along with A-Periment. If not, see <https://www.gnu.org/licenses/>.
 *
 */

const fs = require("fs");
const path = require("path");

class Storage {

    constructor({ path, data = {}, autoLoad = true, autoSave = false, mergeData = true }) {

        this.path = path;
        this.data = data;
        this.autoLoad = autoLoad;
        this.autoSave = autoSave;
        this.mergeData = mergeData;

        if (this.autoLoad) {
            this.load();
        }

    }

    save() {

        var content = JSON.stringify(this.data, null, 4) + "\n";

        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        fs.writeFileSync(this.path, content, { encoding: "utf-8" });

    }

    load() {

        if (fs.existsSync(this.path)) {
            
            var content = fs.readFileSync(this.path, { encoding: "utf-8" });

            if (this._isJson(content)) {

                content = JSON.parse(content);

                this.data = this.mergeData ? this._mergeObjects(this.data, content) : content;

                // TODO: return if this.data equals content
                
            }
    
        }

        this.save();

    }

    set(path, value) {

        if (typeof path === "string") {
            path = path.split(".");
        } else if (Number.isInteger(path) && path >= 0) {
            path = [path];
        }

        var currentObject = this.data;

        for (var i = 0; i < path.length - 1; i++) {

            if (!currentObject.hasOwnProperty(path[i])) {
                currentObject[path[i]] = {};
            }

            currentObject = currentObject[path[i]];

        }

        currentObject[path[path.length - 1]] = value;

        if (this.autoSave) {
            this.save();
        }

    }

    get(path, value) {
        
        if (typeof path === "string") {
            path = path.split(".");
        } else if (Number.isInteger(path) && path >= 0) {
            path = [path];
        } else {
            return this.data;
        }

        var currentObject = this.data;

        for (var i = 0; i < path.length; i++) {

            if (typeof currentObject !== "object" || !currentObject.hasOwnProperty(path[i])) {
                return value || null;
            }

            currentObject = currentObject[path[i]];

        }

        return currentObject;

    }

    size() {
        return Object.keys(this.data).length;
    }

    isEmpty() {
        return (Object.entries(this.data).length === 0 && this.data.constructor === Object)
    }

    _isJson(data) {
        if (typeof data !== "string") { return false; }
        try {
            var json = JSON.parse(data);
            var type = Object.prototype.toString.call(json);
            return type === "[object Object]" || type === "[object Array]";
        } catch (err) {
            return false;
        }
    }

    _mergeObjects(target, ...sources) {
        sources.forEach((source) => {
            Object.keys(source).forEach((key) => {
                target[key] = (
                    target[key] && source[key]
                    && typeof target[key] === "object"
                    && typeof source[key] === "object"
                    ) ? this._mergeObjects(target[key], source[key]) : source[key];
            });
        });
        return target;
    }

}

module.exports = Storage;
