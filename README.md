# Aperiment (Aper)
*Custom Minecraft Launcher*

Aperiment's main purpose is to provide an easy way of manipulating SkulTech-X-Periment modpacks and all other modpacks, which use the Aperiment Manifest Format. This is the launcher's 7th generation. First version was released on 18 July 2018.

> *Motto: Make modpacks playable with a few clicks.*

## Platform Support

- Windows
- Linux

## Minecraft Version Support

| Type | Version |
| :---------------: | :----------: |
| Minecraft | 1.7.10 - 1.18.2+ |
| Fabric | 0.1.0.48 - 0.14.10+ |
| Forge | 10.13.0.1150 - 40.1.84+ |

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
    // ... credit mod authors ...
  ],
  "gallery": [
    "https://examplepack.cz/path/to/image.png" // Supported: Any image/xxx mime type
  ],
  "icon": "https://examplepack.cz/path/to/icon_64x64.gif", // Supported: png, jpeg, webp, gif
  "description": "This is just an example...", // Newline \n supported
  "versions": [ // The launcher will always install the newest version.
    {
      "id": "3.0.0", // ID of the version, HAS TO BE VALID SEMVER! - https://semver.org/
      "fabric": "0.14.10", // Install Fabric Loader
      "vanilla": "1.12.2", // Install Vanilla Minecraft, THIS IS ALWAYS REQUIRED!
      "extension": { // Download extra files, e. g. mods, shaders, resourcepacks, etc.
        "size": 0, // Remote file size
        "url": "https://examplepack.cz/path/to/fabricmods_3.0.0.zip"
      },
      "changelog": "Fabric is better than Forge!" // Newline \n supported
    },
    {
      "id": "2.0.0",
      "forge": "1.12.2-14.23.5.2847", // Install Forge Mod Loader (FML)
      "vanilla": "1.12.2",
      "extension": {
        "size": 0,
        "url": "https://examplepack.cz/path/to/forgemods_2.0.0.zip"
      },
      "changelog": "Vanilla is boring..."
    },
    {
      "id": "1.0.0",
      "vanilla": "1.12.2", // This pack is vanilla only!
      "extension": { // Download resourcepacks, saves, servers.dat, ...
        "size": 0,
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
