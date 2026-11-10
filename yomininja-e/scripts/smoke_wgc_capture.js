// Smoke-test WGC native addon under Electron (not plain Node).
// Usage: npx electron scripts/smoke_wgc_capture.js

const { app, screen } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const results = {
    platform: process.platform,
    electron: process.versions.electron,
    modules: process.versions.modules,
  };

  try {
    const {
      isWgcCaptureAvailable,
      captureMonitorPng,
      captureWindowPng,
    } = require('../main/gyp_modules/wgc_capture/win32/wgc_capture_win32');

    results.available = isWgcCaptureAvailable();
    console.log('[smoke] WGC available:', results.available);

    if (results.available) {
      const display = screen.getPrimaryDisplay();
      console.time('WGC capture');
      const image = await captureMonitorPng({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      });
      console.timeEnd('WGC capture');

      results.monitorBytes = image?.length || 0;
      console.log('[smoke] monitor PNG bytes:', results.monitorBytes);

      // Soft fallback check: missing addon path should not throw from bindings try/catch.
      try {
        const hwnd = process.hwnd || 0;
        if (hwnd) {
          console.time('WGC capture');
          const winPng = await captureWindowPng(hwnd);
          console.timeEnd('WGC capture');
          results.windowBytes = winPng?.length || 0;
        }
      } catch (e) {
        results.windowError = String(e);
      }
    }

    results.ok = Boolean(results.available && results.monitorBytes > 1000);
  } catch (error) {
    results.ok = false;
    results.error = String(error && error.stack || error);
    console.error('[smoke] failed:', results.error);
  }

  console.log('[smoke] result:', JSON.stringify(results));
  app.exit(results.ok ? 0 : 1);
}).catch((error) => {
  console.error('[smoke] whenReady failed:', error);
  app.exit(1);
});
