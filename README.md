# YomiNinja

YomiNinja is an application for extracting text from any type of visual content and is designed with language learners in mind.

## Demonstration with [10ten](https://github.com/birchill/10ten-ja-reader)

https://github.com/matt-m-o/YomiNinja/assets/25914763/2bb02444-fc41-44e7-bc9e-c66d0d40d7b3

## Demonstration with [Yomichan](https://github.com/FooSoft/yomichan)

https://github.com/matt-m-o/YomiNinja/assets/25914763/1868db47-5b50-44c1-a5b3-694d46c69e28

The extracted text overlays the original content, allowing for quick look-ups with pop-up dictionaries like [10ten](https://github.com/birchill/10ten-ja-reader), [Yomitan](https://github.com/themoeway/yomitan) and [Inkah](https://chromewebstore.google.com/detail/inkah-chinese-korean-pop/pcgmedbmchghfgikplcimdmfldfnecec). <br>
It minimizes distractions and simplifies the process of looking up unfamiliar words. <br>
This is especially beneficial for language learners who study through videos or games.

YomiNinja is perfect for:

- Language learners who study through games, videos, or any other visual content.
- Anyone who values a distraction-free, efficient way to look up unfamiliar words.
- Users looking for seamless text extraction and workflow improvement.

Check out this [video](https://www.youtube.com/watch?v=sF1isrgjwZI) by [ganqqwerty](https://github.com/ganqqwerty) to get started quickly and easily!

## Dictionary Extensions
YomiNinja supports web browser dictionary extensions, enabling convenient word lookup without external applications. <br>
While not all extensions are currently installable, [10Ten](https://github.com/birchill/10ten-ja-reader) and [Yomitan](https://github.com/themoeway/yomitan) have been successfully tested and are included as pre-installed options for simplified installation. <br>


## Installation
### Windows
You need Windows 10 or 11 and [VCRedist](https://www.techpowerup.com/download/visual-c-redistributable-runtime-package-all-in-one/) installed. <br>
If you are using the N or KN edition of Windows 10 or 11, please be aware that you will also need to install the [Media Feature Pack](https://support.microsoft.com/en-us/topic/media-feature-pack-list-for-windows-n-editions-c1c6fffa-d052-8338-7a79-a4bb980a700a). This is necessary to ensure that all the required DLLs are installed.

[Download](https://github.com/matt-m-o/YomiNinja/releases) and install the latest YomiNinja release. <br>

### Linux
YomiNinja currently offers support for distros using the X11 window system. Wayland is not supported due to its limitations with global shortcuts and window positioning.
1. Install [xdotool](https://github.com/jordansissel/xdotool?tab=readme-ov-file#installation).
2. Download the YomiNinja package corresponding to your distribution.
3. Install the package. For example, on Debian-based distributions:

    ```commandline
    sudo dpkg -i yomininja-e_x.x.x_amd64.deb
    ```
### macOS
[Download](https://github.com/matt-m-o/YomiNinja/releases) and install the latest YomiNinja release. <br>

Notes:
- The ARM64 version for macOS might show the message "YomiNinja is damaged and can't be opened". You can work around this issue by running the command ```xattr -cr /Applications/YomiNinja.app```
- The list of available languages for the Apple Vision OCR engine depends on your macOS version.



## Current features

- Text extraction from the entire screen or specific window.
- Built-in pop-up dictionaries.
- Chrome Extensions (partial support).
- OCR Templates (predefined text areas, optimizing OCR efficiency).
- Auto OCR.
- Text to speech.
- WebSocket for Texthookers.


## Planned Features

- Text extraction from snip.
- Anki integration.
- History.
- Text translation.
- Support for more OCR engines.
- Support for more TTS voices.


## Supported Languages

- English
- Japanese
- Chinese
- Korean

## Supported OCR Engines

- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
- [Google Cloud Vision](https://cloud.google.com/vision/docs)
- [Google Lens](https://lens.google/intl/pt-BR/#translate)
- [Manga OCR](https://github.com/kha-white/manga-ocr)
- [Apple's Vision Framework](https://developer.apple.com/documentation/vision)

## Building

### Windows (x64) — recommended
1. Clone the repository and install [Node.js](https://nodejs.org/) + [VCRedist](https://www.techpowerup.com/download/visual-c-redistributable-runtime-package-all-in-one/).
2. Download a Windows build of [PPOCR-Inference-Service](https://github.com/matt-m-o/PPOCR-Inference-Service/releases) and extract it to:
   ```
   ./bin/win32/x64/ppocr/
   ```
3. Run the setup helper (npm install, OCR gRPC types, Chromium Lens protos → `lens_pb`):
   ```commandline
   setup-win-dev.bat
   ```
4. Build OCR python package + Electron installer (or reuse an existing `bin\win32\x64\py_ocr_service`):
   ```commandline
   build-win32-x64.bat
   ```
   Output installer: `yomininja-e\dist\YomiNinja Setup *.exe`

Notes:
- Google Lens **gRPC** needs local (gitignored) Chromium protos; `setup-win-dev.bat` fetches and generates them. Without that step, switch `adapters_registry.ts` back to `GoogleLensOcrAdapter` (HTTP).
- `npm run dist` builds all arches; for a single Windows x64 installer prefer `build-win32-x64.bat` or `TARGET_ARCH=x64` with electron-builder as in that script.
- Optional: place a [10ten](https://github.com/birchill/10ten-ja-reader/releases) Electron zip under `./yomininja-e/extensions/`.

### Manual / other platforms
1. Clone the git repository
    ```commandline
    git clone https://github.com/matt-m-o/YomiNinja.git && cd YomiNinja
    ```

2. Build OCR services:
    ```commandline
    cd ./ocr_services/py_ocr_service
    ./gen_grpc_service.bat
    ./build.bat
    cd ../..
    ./copy_py_ocr_service_build.bat
    ```
   
3. Based on your platform, download and extract the latest build of [PPOCR-Inference-Service](https://github.com/matt-m-o/PPOCR-Inference-Service/releases) into the appropriate directory:

    - Windows: `./bin/win32/x64/ppocr` (or `./bin/win32/ppocr` for older layouts)
    - Linux: `./bin/linux/<arch>/ppocr`

4. (optional) Download [10ten](https://github.com/birchill/10ten-ja-reader/releases) for Electron, and place the zip file into the following directory:
       
       ./yomininja-e/extensions/

5. Install node modules. Note: `--force` is used due to outdated react-furi peerDependencies, but it should function normally.
    ```commandline
    cd yomininja-e && npm install --force
    ```
6. Generate gRPC Protobuf types (and Lens stubs on Windows):
    ```commandline
    npm run grpc-types
    powershell -ExecutionPolicy Bypass -File .\scripts\fetch-lens-protos.ps1
    ```
7. Build
    ```commandline
    set TARGET_ARCH=x64
    npm run build
    npx cross-env TARGET_ARCH=x64 electron-builder --win nsis --x64 --config electron-builder.config.js
    ```


## Inspired by:
- [Yomichan](https://github.com/FooSoft/yomichan)
- [mokuro](https://github.com/kha-white/mokuro)
- [kanjitomo-ocr](https://github.com/sakarika/kanjitomo-ocr)


