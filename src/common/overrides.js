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

Error.prototype.loggify = function() {
    return this.stack.substr(this.stack.indexOf(":") + 2, this.stack.length);
};

Object.defineProperty(Object.prototype, "hasOwnProperties", {
    value: function(...properties) {

        for (var i = 0; i < properties.length; i++) {

            var property = properties[i];
    
            if (!this.hasOwnProperty(property)) {
                return false;
            }
    
        }
    
        return true;

    },
    enumerable: false
});
