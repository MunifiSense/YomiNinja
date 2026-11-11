/** Windows screenshot/OCR capture backend preference. */
export type CaptureBackend =
    | 'auto'
    | 'wgc'
    | 'webrtc'
    | 'desktop_capturer';

export type CompatibilitySettings = {
    hardware_acceleration: boolean;
    gpu_compositing: boolean;
    /**
     * Preferred capture path for OCR screenshots (Windows).
     * - auto: WGC → WebRTC → desktopCapturer
     * - wgc: Windows.Graphics.Capture (warm session), then desktopCapturer fallback
     * - webrtc: hidden WebRTC capturer (window) / desktopCapturer (entire screen)
     * - desktop_capturer: Electron desktopCapturer thumbnails only
     */
    capture_backend?: CaptureBackend;
    /** When true, keep the yellow WGC privacy border visible (Win10 2104+ / Win11). */
    show_wgc_border?: boolean;
};
