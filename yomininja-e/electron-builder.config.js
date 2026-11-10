const TARGET_ARCH = process.env.TARGET_ARCH;
const ML_HW_ACCELERATION = process.env.ML_HW_ACCELERATION

if ( process.platform !== 'darwin' && TARGET_ARCH === 'arm64' ) {
    console.log("Skipping arm64 build!")
    process.exit();
}

let buildConfig = {
    "asar": true,
    "files": [
        "main",
        "renderer/out",
        "**/*.proto",
        // `build/` is gitignored; include the native addons explicitly.
        {
            "from": "build/Release",
            "to": "build/Release",
            "filter": [ "*.node" ]
        }
    ],
    "extraResources": [
        {
            "from": "third-party-licenses.txt",
            "to": "./"
        },
        {
            "from": "extensions",
            "to": "extensions",
            "filter": "**/*"
        },
        {
            "from": "electron_resources",
            "to": "./",
            "filter": "**/*"
        },
        {
            "from": "main/electron-src/extensions/custom_browser_extensions_api/renderer/renderer.js",
            "to": "./extensions/renderer.js",
            "filter": "**/*"
        }
    ],
    "directories": {
        "buildResources": "electron_resources",
        "output": "dist"
    },
    "forceCodeSigning": false,
    "nsis": {
        "oneClick": false,
        "runAfterFinish": true,
        "allowToChangeInstallationDirectory": true,
        "include": "./electron_resources/installer.nsh"
    },
    "win": {
        "signtoolOptions": {
            "publisherName": "Matt M.",
        },
        "compression": "maximum",
        "asarUnpack": [
            "**/node_modules/sharp/**/*",
            "**/node_modules/@img/**/*",
            "**/build/Release/*.node"
        ],
        "extraResources": [
            {
                "from": `../bin/win32/${TARGET_ARCH}`,
                "to": "bin",
                "filter": [
                    "**/*",
                    "!py_ocr_service/models/manga_ocr/**/*"
                ]
            },
            // Mirror into unpacked asar so bindings() can load them at runtime.
            {
                "from": "build/Release/window_manager_win32.node",
                "to": "app.asar.unpacked/build/Release/window_manager_win32.node"
            },
            {
                "from": "build/Release/wgc_capture_win32.node",
                "to": "app.asar.unpacked/build/Release/wgc_capture_win32.node"
            }
        ]
    },
    "linux": {
        "icon": "./electron_resources/icon.icns",
        "asarUnpack": [
            "**/node_modules/sharp/**/*",
            "**/node_modules/@img/**/*",
            "**/node_modules/x11/**"
        ],
        "extraResources": [
            {
                "from": `../bin/linux/${TARGET_ARCH}`,
                "to": "bin",
                "filter": [
                    "**/*",
                    "!py_ocr_service/models/manga_ocr/**/*"
                ]
            }
        ],
        "target": [
            "AppImage",
            "deb",
            "rpm",
            "pacman"
        ]
    },
    "mac": {
        "icon": "./electron_resources/icon.icns",
        "asarUnpack": [
            "**/node_modules/sharp/**/*",
            "**/node_modules/@img/**/*"
        ],
        "extraResources": [
            {
                "from": `../bin/darwin/${TARGET_ARCH}`,
                "to": "bin",
                "filter": [
                    "**/*",
                    "!py_ocr_service/models/manga_ocr/**/*"
                ]
            },
            {
                "from": `./node_modules/uiohook-napi/prebuilds/darwin-${TARGET_ARCH}/node.napi.node`,
                "to": "app.asar.unpacked/node_modules/uiohook-napi/build/Release/uiohook_napi.node",
                "filter": [
                    "**/*",
                ]
            }
        ],
        "target": [
            {
                "target": "default",
                "arch": TARGET_ARCH
            }
        ]
    }
}

module.exports = buildConfig;
