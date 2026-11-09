@echo off
setlocal enabledelayedexpansion
REM Developer setup for building YomiNinja on Windows x64 from a clean clone.
REM Does NOT build PPOCR (download release separately) or a full CUDA Python env.

cd /d "%~dp0"

echo === YomiNinja Windows x64 dev setup ===
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found in PATH.
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found in PATH.
    exit /b 1
)

echo [1/6] Installing yomininja-e dependencies...
pushd yomininja-e
call npm install --force
if errorlevel 1 (
    echo ERROR: npm install failed.
    popd
    exit /b 1
)
popd

echo.
echo [2/6] Generating OCR gRPC TypeScript types...
pushd yomininja-e
call npm run grpc-types
if errorlevel 1 (
    echo ERROR: npm run grpc-types failed.
    popd
    exit /b 1
)
popd

echo.
echo [3/6] Fetching Chromium Lens protos and generating lens_pb...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0yomininja-e\scripts\fetch-lens-protos.ps1"
if errorlevel 1 (
    echo ERROR: Lens proto fetch/generate failed.
    echo The HTTP Google Lens adapter can still be used if you switch adapters_registry.ts.
    exit /b 1
)

echo.
echo [4/6] Syncing py_ocr_service sources into bin\win32\x64 ^(if present^)...
if exist "ocr_services\py_ocr_service\src\manga_ocr_service\comic_text_detector.py" (
    if exist "bin\win32\x64\py_ocr_service\src\manga_ocr_service\" (
        copy /Y "ocr_services\py_ocr_service\src\manga_ocr_service\comic_text_detector.py" "bin\win32\x64\py_ocr_service\src\manga_ocr_service\comic_text_detector.py" >nul
        copy /Y "ocr_services\py_ocr_service\src\py_ocr_service.py" "bin\win32\x64\py_ocr_service\src\py_ocr_service.py" >nul
        echo Synced comic_text_detector.py and py_ocr_service.py into bin.
    ) else (
        echo bin\win32\x64\py_ocr_service not found yet — build/copy OCR service first.
    )
)

echo.
echo [5/6] Checking PPOCR binary...
if exist "bin\win32\x64\ppocr\ppocr_infer_service_grpc.exe" (
    echo Found bin\win32\x64\ppocr\ppocr_infer_service_grpc.exe
) else if exist "bin\win32\ppocr\ppocr_infer_service_grpc.exe" (
    echo Found bin\win32\ppocr\ppocr_infer_service_grpc.exe
    echo NOTE: electron-builder expects bin\win32\x64\ppocr for TARGET_ARCH=x64.
) else (
    echo MISSING: PPOCR service.
    echo Download a Windows build from:
    echo   https://github.com/matt-m-o/PPOCR-Inference-Service/releases
    echo Extract into: bin\win32\x64\ppocr\
)

echo.
echo [6/6] Next steps
echo   - Optional: place 10ten Electron zip in yomininja-e\extensions\
echo   - Build OCR python package: build-win32-x64.bat  ^(or copy an existing bin\win32\x64\py_ocr_service^)
echo   - Build app + installer:
echo       cd yomininja-e
echo       set CSC_IDENTITY_AUTO_DISCOVERY=false
echo       set TARGET_ARCH=x64
echo       npm run build
echo       npx cross-env TARGET_ARCH=x64 electron-builder --win nsis --x64 --config electron-builder.config.js
echo.
echo Setup finished.
pause
endlocal
