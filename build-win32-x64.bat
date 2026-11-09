@echo off
REM Build py_ocr_service for win32 x64, sync into bin\, then package Electron (x64).
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo === Building py_ocr_service (win32 x64) ===
pushd ocr_services\py_ocr_service
call build-win32-x64.bat
if errorlevel 1 (
    popd
    exit /b %errorlevel%
)
popd

if not exist bin\win32\x64 mkdir bin\win32\x64

if exist bin\win32\x64\py_ocr_service (
    rmdir /s /q bin\win32\x64\py_ocr_service
)

echo === Copying py_ocr_service into bin\win32\x64 ===
xcopy .\ocr_services\py_ocr_service\dist\win32\x64\py_ocr_service\ .\bin\win32\x64\py_ocr_service /e /I /Y
if errorlevel 1 exit /b %errorlevel%

REM Keep tracked source fixes in the packaged tree
if exist ocr_services\py_ocr_service\src\manga_ocr_service\comic_text_detector.py (
    copy /Y ocr_services\py_ocr_service\src\manga_ocr_service\comic_text_detector.py bin\win32\x64\py_ocr_service\src\manga_ocr_service\comic_text_detector.py >nul
)
if exist ocr_services\py_ocr_service\src\py_ocr_service.py (
    copy /Y ocr_services\py_ocr_service\src\py_ocr_service.py bin\win32\x64\py_ocr_service\src\py_ocr_service.py >nul
)

if not exist bin\win32\x64\ppocr\ppocr_infer_service_grpc.exe (
    echo WARNING: Missing bin\win32\x64\ppocr\ppocr_infer_service_grpc.exe
    echo Download from https://github.com/matt-m-o/PPOCR-Inference-Service/releases
)

if not exist yomininja-e\grpc\rpc\lens\lens_pb.js (
    echo Lens stubs missing — running setup Lens fetch...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0yomininja-e\scripts\fetch-lens-protos.ps1"
    if errorlevel 1 (
        echo WARNING: Lens proto generation failed. Google Lens gRPC adapter will not work.
    )
)

echo === Building Electron app + installer (TARGET_ARCH=x64) ===
pushd yomininja-e
set CSC_IDENTITY_AUTO_DISCOVERY=false
set TARGET_ARCH=x64
call npm run build
if errorlevel 1 (
    popd
    exit /b %errorlevel%
)
call npx cross-env TARGET_ARCH=x64 electron-builder --win nsis --x64 --config electron-builder.config.js
if errorlevel 1 (
    popd
    exit /b %errorlevel%
)
popd

echo.
echo Done. Installer should be under yomininja-e\dist\
pause
endlocal