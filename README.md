# Aperiment (Aper)
[![release](https://img.shields.io/github/v/release/Skulaurun/Aperiment?color=blue)](https://github.com/Skulaurun/Aperiment/releases/latest)
[![license](https://img.shields.io/github/license/Skulaurun/Aperiment?color=blue)](https://github.com/Skulaurun/Aperiment/blob/main/LICENSE)
[![downloads](https://img.shields.io/github/downloads/Skulaurun/Aperiment/total?color=limegreen)](#)

*Custom Minecraft Launcher*

Aperiment's main purpose is to provide an easy way of manipulating SkulTech-X-Periment modpacks and all other modpacks, which use the Aperiment Manifest Format. This is the launcher's 7th generation. First version was released on 18 July 2018.

> *Motto: Make modpacks playable with a few clicks.*

## Platform Support

- Windows
- Linux

## Minecraft Version Support

| Type              | Version                 |
| :---------------: | :---------------------: |
| Minecraft         | 1.7.10 - 1.18.2+        |
| Fabric            | 0.1.0.48 - 0.14.10+     |
| Forge             | 10.13.0.1150 - 40.1.84+ |

## Manifest Format

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
`<creators>` - Who created the pack? Was it you?<br>
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

## Extension ZIP
Download an example [here](https://www.dropbox.com/s/bblcjk7wbdt351q/skultech-1.4.1.zip?dl=1).<br>

The file/folder structure of extension .zip:
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

`ADD` - Extract the file from the zip only if it does not already exist.<br>
`REPLACE` - Rewrite the file if it exists otherwise create.<br>
`DELETE` - Delete target folder, extract everything again.<br>

This is useful when you don't want to delete user specific configuration when updating a pack.

Note: This system is deprecated, and will most likely be replaced in the future, while still supporting the old one.

## URI 'aperiment://' Handler
⚠️ Warning, so far Windows only!

Open hyperlinks with (external application) Aperiment.<br>
```html
<a href="aperiment:launch?remote=https://www.skulaurun.eu/skultech/manifest.json">Open in Aperiment</a>
```
Note: Users of your website need to install Aperiment beforehand.

## Plans for the future
- Support downloading mods from CurseForge or Modrinth.
- Add alternative pack update system, via "patches" (separate versions into "base" and "patch").
- Create central manifest database, hosted on my servers, fetch and add packs from the database through the launcher directly.

## License
Aperiment is available under the **GNU General Public License v3.0**. See [`LICENSE.md`](https://github.com/Skulaurun/Aperiment/blob/master/LICENSE).
