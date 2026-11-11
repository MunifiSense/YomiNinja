// Smoke-test WGC session grab under Electron.
// Usage: .\node_modules\electron\dist\electron.exe scripts\smoke_wgc_capture.js

const { app, screen } = require('electron');

app.whenReady().then(async () => {
  const results = {
    platform: process.platform,
    electron: process.versions.electron,
    modules: process.versions.modules,
  };

  try {
    const {
      isWgcCaptureAvailable,
      ensureWgcSession,
      grabWgcSessionJpeg,
      closeWgcSession,
    } = require('../main/gyp_modules/wgc_capture/win32/wgc_capture_win32');

    results.available = isWgcCaptureAvailable();
    console.log('[smoke] WGC available:', results.available);

    if (results.available) {
      const display = screen.getPrimaryDisplay();
      const target = {
        type: 'monitor',
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
      };

      const opened = ensureWgcSession(target);
      results.sessionOpen = opened;
      console.log('[smoke] session open:', opened);

      const sizes = [];
      for (let i = 0; i < 3; i++) {
        console.time('WGC session grab+encode');
        const image = await grabWgcSessionJpeg();
        console.timeEnd('WGC session grab+encode');
        sizes.push(image?.length || 0);
      }
      results.grabs = sizes;
      closeWgcSession();
      results.ok = opened && sizes.every((n) => n > 1000);
    } else {
      results.ok = false;
    }
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
