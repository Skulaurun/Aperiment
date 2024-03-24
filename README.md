# Aperiment (Aper)
[![release](https://img.shields.io/github/v/release/Skulaurun/Aperiment?color=blue)](https://github.com/Skulaurun/Aperiment/releases/latest)
[![license](https://img.shields.io/github/license/Skulaurun/Aperiment?color=blue)](https://github.com/Skulaurun/Aperiment/blob/main/LICENSE)
[![downloads](https://img.shields.io/github/downloads/Skulaurun/Aperiment/total?color=limegreen)](#)

*Custom Minecraft Launcher*

Aperiment's main purpose is to provide an easy way of manipulating SkulTech-X-Periment modpacks and all other modpacks, which use the Aperiment Manifest Format. This is the launcher's 7th generation. First version was released on 18 July 2018.

> *Motto: Make modpacks playable with a few clicks.*

## 🪨 Platform Support

- Windows
- Linux

## 🌷 Minecraft Version Support

| Type              | Version                    |
| :---------------: | :------------------------: |
| Minecraft         | 1.0 - 1.20.4+              |
| Fabric            | 0.1.0.48 - 0.15.7+         |
| Forge             | 1.4.0-5.0.0.320 - 49.0.38+ |

## 🧊 UI Preview
![aperiment ui](https://github.com/Skulaurun/Aperiment/assets/31413184/f780ac7a-5d4d-4b5e-be06-eb3750c2538e)

## 📜 Manifest Format

To create your own pack, you need to host a JSON Manifest, for example on GitHub.

```js
{
  "name": "Example Modpack",
  "creators": [
    "Creator #1",
    "Creator #2"
  ],
  "credits": [
    "Helpful Person #1"
  ],
  "gallery": [
    "https://examplepack.cz/path/to/image.png"
  ],
  "icon": "https://examplepack.cz/path/to/icon_64x64.gif",
  "description": "This is just an example...",
  "versions": [
    {
      "id": "3.0.0",
      "fabric": "0.14.10",
      "vanilla": "1.12.2",
      "extension": {
        "size": 230522658,
        "url": "https://examplepack.cz/path/to/fabricmods_3.0.0.zip"
      },
      "changelog": "Fabric is better than Forge!"
    },
    {
      "id": "2.0.0",
      "forge": "1.12.2-14.23.5.2847",
      "vanilla": "1.12.2",
      "extension": {
        "size": 109791834,
        "url": "https://examplepack.cz/path/to/forgemods_2.0.0.zip"
      },
      "changelog": "Vanilla is boring..."
    },
    {
      "id": "1.0.0",
      "vanilla": "1.12.2",
      "extension": {
        "size": 111930143,
        "url": "https://examplepack.cz/path/to/pack_1.0.0.zip"
      }
    }
  ],
  "_MANIFEST_VERSION_": "1.0",
  "default": {
    "jvmArguments": "-Xms3072M -Xmx3072M"
  }
}
```

`<name>` - Incredible pack name!<br>
`<creators>` - Who created the pack?<br>
`[credits]` - Who made the pack possible? E. g. mod authors.<br>

`[icon]` - Icon URL, supported MIME types: png, jpeg, webp, gif.<br>
`[gallery]` - Image URLs, supported MIME types: image/xxxx.<br>
`[description]` - Description, newline \n supported.

`<version/id>` - Has to be valid [semver](https://semver.org)!<br>
`<version/vanilla>` - Minecraft version, see [supported versions](https://github.com/Skulaurun/Aperiment#minecraft-version-support).<br>
`[version/forge]` - Mod Loader (Forge) version, see [supported versions](https://github.com/Skulaurun/Aperiment#minecraft-version-support).<br>
`[version/fabric]` - Mod Loader (Fabric) version, see [supported versions](https://github.com/Skulaurun/Aperiment#minecraft-version-support).<br>
`[version/extension]` - Extra files: mods, shaders, resourcepacks, saves, etc.<br>
`[version/changelog]` - Version changelog, newline \n supported.

`<extension/url>` - Remote file URL.<br>
`<extension/size>` - Size of remote file in bytes.

`<_MANIFEST_VERSION_>` - Aperiment Manifest version.

`[default/jvmArguments]` - Default JVM arguments, e.g. for minimum memory requirements.

## 📦 Extension ZIP
Extension ZIP is an extension to the base game: saves, shaders, mods, resourcepacks, etc. The extension is extracted to the runtime instance folder aka `.minecraft`.

Download an example [here](https://www.dropbox.com/s/bblcjk7wbdt351q/skultech-1.4.1.zip?dl=1).<br>

File structure of Extension ZIP:
```
example.zip
 | - mods
 | - config
 | - saves
 | - resourcepacks
 | - servers.dat
 | - ...
 | - actions.json
```

Everything is optional except `actions.json`.

### Example of `actions.json`
An `action` specifies how to treat zip entries.
```json
[
  {
    "name": "config/",
    "action": "REPLACE"
  },
  {
    "name": "mods/",
    "action": "DELETE"
  },
  {
    "name": "resourcepacks/",
    "action": "REPLACE"
  },
  {
    "name": "saves/",
    "action": "REPLACE"
  },
  {
    "name": "servers.dat",
    "action": "ADD"
  }
]
```
When a user installs the pack, we provide him with a default/official server, thus the `servers.dat` file. The `ADD` action means, that the file is extracted from the .zip only when it does not already exist. We don't want the user to lose their servers when the pack is updated.

For specific pack experience, we might have configured some mods, and we want these configuration files to remain the same, even if the user changed them. The `REPLACE` action means, that all files are awalys extracted from the .zip for the mods we provided custom configuration files. While the user still retaining his other (not so important) mod configs, e. g. client-side BetterFoliage, etc.

To play on our official server, we don't allow any client-side modifications, the user wouldn't connect if they had different mod set. The `DELETE` action means, that everything (in this folder) is extracted again from the .zip, any user modification is lost in the process as the folder on the disk is deleted.

### Allowed Actions

`ADD` - Extract the file only if it does not already exist.<br>
`REPLACE` - Extract the file always (rewrite), other files are kept.<br>
`DELETE` - Extract the file always (rewrite), other files are deleted.<br>

## 🔍 URI 'aperiment://' Handler
⚠️ Warning, so far Windows only!

Open web hyperlinks with (external application) Aperiment.<br>
```html
<a href="aperiment:launch?remote=https://www.skulaurun.eu/skultech/manifest.json">Open in Aperiment</a>
```
Note: Aperiment needs to be installed on the client's computer in order for this link to work.

## 📑 TODO List
- Support CurseForge and Modrinth as mod sources.
- Alternative pack update system, separate versions into "base" and "patch".
- Central manifest database, differentiate between verified manifests and 3rd party potentially dangerous.

## 💖 License
Aperiment is available under the **GNU General Public License v3.0**. See [`LICENSE.md`](https://github.com/Skulaurun/Aperiment/blob/master/LICENSE).
