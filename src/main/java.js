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

const { spawn } = require("child_process");

class Java { // TODO: Autodownload JRE.

    constructor(path, vma) {
        this.vma = vma;
        this.path = path || "java";
        this.process = null;
    }

    getVersion() {

        return new Promise((resolve, reject) => {

            let java = spawn(this.path, ["-version"]);

            java.on("error", reject);
            java.stderr.on("data", (data) => {
    
                data = data.toString().split("\n")[0];
    
                var version = new RegExp("java version").test(data) ? data.split(" ")[2].replace(/"/g, "").trim() : false;

                if (version) resolve(version);
                else reject(new Error("Specified path is not valid java executable!"));
                
            });

        });

    }

    exec(args, options) {

        if (this.vma && this.vma != "" && /\s/.test(this.vma)) args = this.vma.split(" ").concat(args);

        this.process = spawn(this.path, args, options);

    }

}

module.exports = Java;
