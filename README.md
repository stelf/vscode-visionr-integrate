# visionr-integrate README

This is the README for your extension "visionr-integrate". After writing up a brief description, we recommend including the following sections.

## Features

The extension currently supports the following commands : 

* uploadObject (ctrl-alt-v o)
* uploadProperty (ctrl-alt-v p)
* reloadCore (ctrl-alt-v r)

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
        "key": "ctrl+alt+v o",
        "mac": "cmd+alt+v o"
    }, {
        "command": "visionr.uploadProperty",
        "key": "ctrl+alt+v p",
        "mac": "cmd+alt+v p"
    }, {
        "command": "visionr.reloadCore",
        "key": "ctrl+alt+v r",
        "mac": "cmd+alt+v r"
    }
    ],
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

### 0.0.3

new commands:

1. upload property (without the surrounding others), 

### 0.0.2

new commands: 

1. upload object,
2. reload core

### 0.0.1

Initial release of VR integrate
)