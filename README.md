# visionr-integrate README

This is the README for your extension "visionr-integrate". After writing up a brief description, we recommend including the following sections.

## Features

The extension currently supports the following commands : 

* uploadObject
* uploadXML

\!\[feature X\]\(images/feature-x.png\)

> this doco is a work in progress

## Requirements

VS Code > 1.5

## Extension Settings

This extension contributes the following settings:

```json

"contributes": {
    "keybindings": [{
        "command": "visionr.uploadObject",
        "key": "ctrl+alt+v O",
        "mac": "cmd+alt+v O"
    }, {
        "command": "visionr.uploadProperty",
        "key": "ctrl+alt+v p",
        "mac": "cmd+alt+v p"
    }],
    "commands": [{
        "command": "visionr.uploadObject",
        "title": "VisionR: Upload Object/ODEF (+reload core)"
    }, {
        "command": "visionr.reloadCore",
        "title": "VisionR: Reload CORE"
    }, {
        "command": "visionr.uploadProperty",
        "title": "VisionR: Upload Property"
    }]
}

```

## Release Notes

### 0.0.2

supported commands now : 


### 0.0.1

Initial release of VR integrate
