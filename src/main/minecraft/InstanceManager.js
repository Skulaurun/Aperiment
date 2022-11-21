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
const axios = require("axios");
const crypto = require("crypto");
const fileType = require("file-type");
const { Readable } = require("stream");
const { EventEmitter } = require("events");
const compareVersions = require("compare-versions");

const FsUtil = require("../FsUtil.js");
const Minecraft = require("./Minecraft.js");
const MinecraftForge = require("./MinecraftForge.js");
const MinecraftFabric = require("./MinecraftFabric.js");
const MinecraftExtension = require("./MinecraftExtension.js");

module.exports = class InstanceManager {

    static _nanoid = {};
    static _nanoidWrapper = import('nanoid')
        .then((object) => InstanceManager._nanoid = object);

    static MANIFEST_VERSION = '1.0';

    constructor(rootPath) {

        this.pathConfig = {
            'base': path.normalize(rootPath),
            'cache': path.join(rootPath, 'cache'),
            'icons': path.join(rootPath, 'cache/icons'),
            'assets': path.join(rootPath, 'cache/assets'),
            'clients': path.join(rootPath, 'cache/clients'),
            'libraries': path.join(rootPath, 'cache/libraries'),
            'manifests': path.join(rootPath, 'cache/manifests'),
            'instances': path.join(rootPath, 'instances')
        };

        this.userInfo = {
            'UUID': '25966168-dc9c-360c-8f32-ed022bfa1070',
            'playerName': 'Herobrine',
            'accessToken': '{}'
        };

        this.defaultConfig = {
            'runtime': {
                'path': 'C:\\Program Files\\Java\\jre1.8.0_271\\bin\\java.exe',
                'jvmArguments': ''
            }
        };

        this.loadedIcons = {};
        this.loadedConfigs = {};
        this.activeInstances = {};

    }

    _generateId() {
        return InstanceManager._nanoid.customAlphabet(
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
            'abcdefghijklmnopqrstuvwxyz' +
            '0123456789',
            16
        )();
    }

    _validateId(string) {
        return typeof string === 'string'
            && /^[a-zA-Z0-9]+$/.test(string)
            && string.length === 16;
    }

    _hasTypedProperty = (object, properties) => {
        properties.forEach(({ property, type }) => {
            if (!object.hasOwnProperty(property)) {
                throw new Error(`Parse: Object is missing property '${property}'.`);
            } else if (typeof object[property] !== type) {
                if (type === 'version') {
                    if (compareVersions.validate(object[property])) return;
                } else if (type === 'array') {
                    if (Array.isArray(object[property])) return;
                } else if (type === 'path') {
                    if (path.isAbsolute(object[property])) return;
                }
                throw new Error(
                    `Parse: Object has wrong data type on property '${property}', ` +
                    `found: '${typeof object[property]}', should be: '${type}'.`
                );
            }
        });
    }

    _parseConfig(object) {

        if (!this._validateId(object['id'])) {
            object['id'] = this._generateId();
        }

        this._hasTypedProperty(object, [
            { property: 'manifest', type: 'object' }
        ]);
        this._parseManifest(object['manifest']);

        this._configureManifest(object);
        
        return object;
    }

    _parseManifest(manifest) {

        if (typeof manifest !== 'object') {
            throw new Error('The manifest is invalid.');
        }

        // TODO: truncate name length
        // TODO: parse creators, description, ...

        if (!manifest['_MANIFEST_VERSION_']) {
            this._parseLegacyManifest(manifest);
            this._migrateLegacyManifest(manifest);
        }

        this._hasTypedProperty(manifest, [
            { property: '_MANIFEST_VERSION_', type: 'version' },
            { property: 'versions', type: 'array' },
            { property: 'name', type: 'string' }
        ]);

        if (Array.isArray(manifest['versions'])) {
            if (manifest['versions'].length == 0 || manifest['versions'].some(v => typeof v !== 'object')) {
                throw new Error('Parse: Manifest has no installable versions.');
            }
            manifest['versions'].forEach((version) => {
                
                this._hasTypedProperty(version, [
                    { property: 'id', type: 'version' }
                ]);

                if (!version['vanilla']) {
                    throw new Error('Missing vanilla game version.');
                }
                if (version['forge'] && version['fabric']) {
                    throw new Error('Mod Loader conflict, both Forge and Fabric were specified.');
                }
                if (typeof version['extension'] === 'object') {
                    this._hasTypedProperty(version['extension'], [
                        { property: 'size', type: 'number' },
                        { property: 'url', type: 'string' }
                    ]);
                }
                
            });
        }

        return manifest;
    }

    _configureManifest(object) {

        if (typeof object['config'] !== 'object') {
            object['config'] = {};
        }
        if (typeof object['config']['runtime'] !== 'object') {
            object['config']['runtime'] = {};
        }

        // Note: Property path cannot be empty.
        if (!object['config']['runtime']['path']) {
            object['config']['runtime']['path'] = this.defaultConfig['runtime']['path'];
        }

        // Note: Property jvmArguments can be empty.
        if (typeof object['config']['runtime']['jvmArguments'] !== 'string') {
            object['config']['runtime']['jvmArguments'] = object.manifest?.default?.jvmArguments
                || this.defaultConfig['runtime']['jvmArguments'];
        }

        // Note: Remove junk from jvmArguments, e.g. non arguments or whitespaces.
        const jvmArguments = [...object['config']['runtime']['jvmArguments'].matchAll(/-[^\s]+/g)];
        object['config']['runtime']['jvmArguments'] = jvmArguments.join(' ');

        return object;
    }

    _getInstance(instanceId, options = { isActive: false }) {

        const arrayOfInterest = options['isActive'] ?
            this.activeInstances : this.loadedConfigs;

        if (!arrayOfInterest[instanceId]) {
            if (options['isActive']) {
                throw new Error(`Instance with ID '${instanceId}' is not active.`);
            } else {
                throw new Error(`Instance with ID '${instanceId}' does not exist.`);
            }
        }

        return arrayOfInterest[instanceId];

    }

    _findCurrentVersion(config) {
        if (!config['config']['version']) return null;
        return config['manifest']['versions'].find((version) => {
            return version.id === config['config']['version'];
        });
    }

    _findLatestVersion(versions) {
        return this._sortVersions(versions)[0];
    }

    _sortVersions(array) {
        return array.sort((a, b) => {
            return compareVersions(b['id'], a['id']);
        });
    }

    _parseLegacyManifest(manifest) {

        if (typeof manifest !== 'object' || ['name', 'creators', 'description', 'versions', 'vma'].some(p => !manifest[p])
            || !Array.isArray(manifest['versions']) || manifest['versions'].length == 0
            || manifest['versions'].some(v => typeof v !== 'object')
            || manifest['versions'].some(v => ['id', 'size', 'forge', 'url'].some(p => !v[p]))) {
            throw new Error('Parse: Could not parse Legacy Manifest.');
        }

        return manifest;
    }

    _migrateLegacyManifest(manifest) {

        manifest['_MANIFEST_VERSION_'] = InstanceManager.MANIFEST_VERSION;
        manifest['versions'] = manifest['versions'].map((version) => {

            if (typeof version['forge'] === 'string' && version['forge'].indexOf('-') !== -1) {
                version['vanilla'] = version['forge'].split('-')[0];
            }
            
            version['extension'] = {
                'size': version['size'],
                'url': version['url']
            };

            delete version['url'];
            delete version['size'];

            return version;
        });

        if (typeof manifest['vma'] === 'string') {
            manifest['default'] = {
                'jvmArguments': manifest['vma']
            };
            delete manifest['vma'];
        }

        return manifest;
    }

    _stringifyConfig(config) {
        return JSON.stringify(config, (property, value) => {
            if (property === 'manifestPath') return undefined;
            else return value;
        }, 4);
    }

    isActive(activeId) {
        return typeof this.activeInstances[activeId] !== 'undefined';
    }

    isLoaded(loadedId) {
        return typeof this.loadedConfigs[loadedId] !== 'undefined';
    }

    isUpToDate(loadedId) {
        let instanceConfig = this._getInstance(loadedId, { isActive: false });
        let currentVersion = this._findCurrentVersion(instanceConfig);
        let latestVersion = this._findLatestVersion(instanceConfig['manifest']['versions']);
        if (currentVersion && latestVersion) {
            return compareVersions(
                currentVersion['id'],
                latestVersion['id']
            ) === 0;
        }
        return false;
    }

    findRemote(remoteUrl) {
        return Object.values(this.loadedConfigs)
            .filter(o => o['config']['remote'])
            .find(o => o['config']['remote'] === remoteUrl);
    }

    async createDirectoryStructure() {
        for (const directory of Object.values(this.pathConfig)) {
            await fs.promises.mkdir(directory, { recursive: true });
        }
    }

    async loadConfigs() {

        // Search for manifests in this.pathConfig['manifests']

        for (const entry of await fs.promises.readdir(this.pathConfig['manifests'], { withFileTypes: true })) {
            if (entry.isFile()) {
                const manifestPath = path.join(this.pathConfig['manifests'], entry.name);
                try {
                    
                    const instanceConfig = this._parseConfig(JSON.parse(
                        await fs.promises.readFile(manifestPath)
                    ));
                    while (this.loadedConfigs[instanceConfig['id']]) {
                        instanceConfig['id'] = this._generateId();
                    }

                    instanceConfig['manifestPath'] = manifestPath;
                    this.loadedConfigs[instanceConfig['id']] = instanceConfig;
                    this.saveConfig(instanceConfig['id']).catch((error) => {
                        // log error
                    });

                } catch (error) {
                    // Log error
                }
            }
        }

        return this.loadedConfigs;
    }

    async saveConfig(loadedId) {
        let instanceConfig = this._getInstance(loadedId, { isActive: false });
        await fs.promises.writeFile(
            instanceConfig['manifestPath'],
            this._stringifyConfig(instanceConfig)
        );
    }

    async addFromRemote(remoteUrl) {
        const { data: remoteManifest } = await axios.get(remoteUrl);
        return this.addFromManifest(remoteManifest, {
            'remote': remoteUrl
        });
    }

    addFromManifest(manifest, config = {}) {

        let instanceConfig = {
            'id': null, /* Keep ID at the top */
            'manifest': this._parseManifest(manifest),
            'config': config
        };
        this._configureManifest(instanceConfig);

        do { instanceConfig['id'] = this._generateId(); }
        while (this.loadedConfigs[instanceConfig['id']]);

        instanceConfig['manifestPath'] = path.join(
            this.pathConfig['manifests'],
            `${instanceConfig['id']}.json`
        );
        this.loadedConfigs[instanceConfig['id']] = instanceConfig;

        return instanceConfig;
    }

    async loadIcons() {

        const supportedMimeTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"
        ];

        for (const instanceConfig of Object.values(this.loadedConfigs)) {
            try {
                const iconPath = path.join(
                    this.pathConfig['icons'],
                    instanceConfig['id']
                );
                const type = await fileType.fromFile(iconPath);
                if (supportedMimeTypes.includes(type.mime)) {
                    this.loadedIcons[instanceConfig['id']] = iconPath;
                }
            } catch {}
        }

        return this.loadedIcons;

    }

    async fetchIcon(loadedId) {

        let instanceConfig = this._getInstance(loadedId, { isActive: false });
        if (!instanceConfig['manifest']['icon']) {
            return;
        }

        const computeHash = (hash, stream) => {
            return new Promise((resolve, reject) => {
                stream.pipe(crypto.createHash(hash).setEncoding("hex"))
                    .on("finish", function() {
                        resolve(this.read());
                    }).on("error", reject);
            });
        };
    
        const streamToBuffer = (stream) => {
            return new Promise((resolve, reject) => {
                let buffer = [];
                stream.on("data", (chunk) => { buffer.push(chunk); });
                stream.on("end", () => resolve(Buffer.concat(buffer)));
                stream.on("error", reject);
            });
        };
    
        let fileHash = null;
        let remoteHash = null;
        let streamBuffer = null;
    
        const iconPath = path.join(
            this.pathConfig['icons'],
            instanceConfig['id']
        );
    
        try {
            let { data: stream } = await axios({
                method: "GET",
                url: instanceConfig['manifest']['icon'],
                responseType: "stream"
            });
            streamBuffer = await streamToBuffer(stream);
            remoteHash = await computeHash("sha256", Readable.from(streamBuffer));
        } catch { return; }

        try {
            await fs.promises.access(iconPath);
            fileHash = await computeHash("sha256", fs.createReadStream(iconPath));
        } catch {}
    
        if (remoteHash != null && fileHash != remoteHash) {
            await fs.promises.mkdir(this.pathConfig['icons'], { recursive: true });
            await FsUtil.writeStream(Readable.from(streamBuffer), iconPath);
        }

        return iconPath;

    }

    async runInstance(activeId) {
        let activeInstance = this._getInstance(activeId, { isActive: true });
        try {
            await activeInstance['instance'].fetchManifest();
            await activeInstance['instance'].download();

            this.loadedConfigs[activeId]['config']['version'] = activeInstance['candidateVersion']['id'];
            await this.saveConfig(activeId);

            await activeInstance['instance'].launch();
            activeInstance['eventEmitter'].emit('process-start');
        } catch (error) {
            activeInstance['eventEmitter'].emit('internal-error', error);
        }
    }

    async createInstance(loadedId, options = { enableUpdate: true }) {

        let instanceConfig = this._getInstance(loadedId, { isActive: false });

        const abortController = new AbortController();
        const { signal: abortSignal } = abortController;

        let activeWrapper = {
            'id': loadedId,
            'instance': null,
            'hasRemote': false,
            'enableUpdate': false,
            'candidateVersion': null,
            'abortSignal': abortSignal,
            'abortController': abortController,
            'eventEmitter': new EventEmitter()
        };

        if (instanceConfig['config']['remote']) {

            const { data: remoteManifest } = await axios.get(instanceConfig['config']['remote'], {
                signal: abortSignal
            });
    
            try {
                instanceConfig['manifest'] = this._parseManifest(remoteManifest);
                activeWrapper['hasRemote'] = true;
            } catch(error) {
                // could not parse remote manifest, using local
                // log error
            }

            if (activeWrapper['hasRemote']) {
                await this.saveConfig(instanceConfig['id']);
            }

        }

        activeWrapper['candidateVersion'] = this._findCurrentVersion(instanceConfig);
        if (!activeWrapper['candidateVersion'] || (options['enableUpdate'] && !this.isUpToDate(instanceConfig['id']))) {
            activeWrapper['candidateVersion'] = this._findLatestVersion(instanceConfig['manifest']['versions']);
            activeWrapper['enableUpdate'] = true;
        }

        const instancePath = path.join(
            this.pathConfig['instances'],
            instanceConfig['id']
        );

        let instanceOptions = {
            'pathConfig': this.pathConfig,
            'userInfo': this.userInfo,
            'instancePath': instancePath,
            'minecraftRuntime': instanceConfig['config']['runtime'],
            'vanillaVersion': activeWrapper['candidateVersion']['vanilla'],
            'fabricVersion': activeWrapper['candidateVersion']['fabric'],
            'forgeVersion': activeWrapper['candidateVersion']['forge'],
            'eventEmitter': activeWrapper['eventEmitter'],
            'abortSignal': activeWrapper['abortSignal']
        };

        if (typeof activeWrapper['candidateVersion']['extension'] === 'object') {
            instanceOptions['extensionPackage'] = new MinecraftExtension(
                activeWrapper, instanceOptions
            );
        }

        if (instanceOptions['forgeVersion']) {
            activeWrapper['instance'] = new MinecraftForge(instanceOptions);
        } else if (instanceOptions['fabricVersion']) {
            activeWrapper['instance'] = new MinecraftFabric(instanceOptions);
        } else if (instanceOptions['vanillaVersion']) {
            activeWrapper['instance'] = new Minecraft(instanceOptions);
        } else {
            throw new Error('');
        }

        this.activeInstances[loadedId] = activeWrapper;
        return activeWrapper['eventEmitter'];

    }

    destroyInstance(activeId, reason) {
        
        let activeInstance = this._getInstance(activeId, { isActive: true });
        
        if (activeInstance['instance'].isRunning()) {
            activeInstance['instance'].terminate('SIGKILL', reason);
        } else {
            activeInstance['abortController']
                .abort(reason);
        }
        
        delete this.activeInstances[activeId];

    }

    setUserInfo(userInfo) {
        this.userInfo = userInfo;
    }

    setDefaultConfig(defaultConfig) {
        this.defaultConfig = defaultConfig;
    }

    setConfig(loadedId, config) {
        this._getInstance(loadedId, { isActive: false })['config'] = config;
    }

};
