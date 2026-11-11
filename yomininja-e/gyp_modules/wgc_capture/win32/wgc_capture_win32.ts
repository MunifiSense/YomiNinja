import bindings from 'bindings';
import sharp from 'sharp';

export type WgcRawFrame = {
    ok: true;
    width: number;
    height: number;
    data: Buffer;
};

export type WgcError = {
    ok: false;
    error: string;
};

export type WgcCaptureResult = WgcRawFrame | WgcError;

export type WgcStatus = { ok: true } | WgcError;

type WgcNativeBinding = {
    isSupported: () => boolean;
    captureWindow: ( hwnd: number ) => WgcCaptureResult;
    captureMonitor: ( x: number, y: number, width: number, height: number ) => WgcCaptureResult;
    openWindowSession: ( hwnd: number, showBorder?: boolean ) => WgcStatus;
    openMonitorSession: (
        x: number,
        y: number,
        width: number,
        height: number,
        showBorder?: boolean
    ) => WgcStatus;
    grabSessionFrame: () => WgcCaptureResult;
    closeSession: () => WgcStatus;
};

export type WgcSessionTarget =
    | { type: 'window'; hwnd: number }
    | { type: 'monitor'; x: number; y: number; width: number; height: number };

export type WgcSessionOptions = {
    showBorder?: boolean;
};

const JPEG_QUALITY = 92;

let native: WgcNativeBinding | null | undefined;
let activeSessionKey: string | null = null;

function getNative(): WgcNativeBinding | null {
    if ( native !== undefined )
        return native;

    if ( process.platform !== 'win32' ) {
        native = null;
        return native;
    }

    try {
        native = bindings( 'wgc_capture_win32' ) as WgcNativeBinding;
    } catch ( error ) {
        console.warn( 'wgc_capture_win32 native addon unavailable:', error );
        native = null;
    }

    return native;
}

export function isWgcCaptureAvailable(): boolean {
    const binding = getNative();
    if ( !binding )
        return false;

    try {
        return Boolean( binding.isSupported() );
    } catch {
        return false;
    }
}

function sessionKey( target: WgcSessionTarget, options?: WgcSessionOptions ): string {
    const border = options?.showBorder ? '1' : '0';
    if ( target.type === 'window' )
        return `window:${target.hwnd}:border=${border}`;
    return `monitor:${target.x},${target.y},${target.width},${target.height}:border=${border}`;
}

export function isLikelyBlankRawFrame( frame: WgcRawFrame ): boolean {
    const pixels = frame.width * frame.height;
    if ( !pixels || !frame.data?.length )
        return true;

    const step = Math.max( 1, Math.floor( pixels / 4096 ) );
    let lit = 0;
    for ( let i = 0; i < pixels; i += step ) {
        const o = i * 4;
        if ( frame.data[o] > 8 || frame.data[o + 1] > 8 || frame.data[o + 2] > 8 )
            lit++;
    }
    return lit < 4;
}

async function encodeJpeg( frame: WgcRawFrame ): Promise< Buffer > {
    console.time( 'WGC encode' );
    try {
        return await sharp( frame.data, {
            raw: {
                width: frame.width,
                height: frame.height,
                channels: 4,
            }
        }).jpeg({ quality: JPEG_QUALITY }).toBuffer();
    } finally {
        console.timeEnd( 'WGC encode' );
    }
}

export function closeWgcSession(): void {
    const binding = getNative();
    activeSessionKey = null;
    if ( !binding )
        return;
    try {
        binding.closeSession();
    } catch ( error ) {
        console.warn( 'WGC closeSession threw:', error );
    }
}

export function ensureWgcSession(
    target: WgcSessionTarget,
    options?: WgcSessionOptions
): boolean {
    const binding = getNative();
    if ( !binding )
        return false;

    const showBorder = Boolean( options?.showBorder );
    const key = sessionKey( target, { showBorder } );
    if ( activeSessionKey === key )
        return true;

    let status: WgcStatus;
    try {
        if ( target.type === 'window' )
            status = binding.openWindowSession( target.hwnd, showBorder );
        else
            status = binding.openMonitorSession(
                target.x,
                target.y,
                target.width,
                target.height,
                showBorder
            );
    } catch ( error ) {
        console.warn( 'WGC openSession threw:', error );
        activeSessionKey = null;
        return false;
    }

    if ( !status?.ok ) {
        console.warn( 'WGC openSession failed:', ( status as WgcError )?.error );
        activeSessionKey = null;
        return false;
    }

    activeSessionKey = key;
    return true;
}

export function grabWgcSessionRaw(): WgcRawFrame | undefined {
    const binding = getNative();
    if ( !binding || !activeSessionKey )
        return undefined;

    console.time( 'WGC grab' );
    let result: WgcCaptureResult;
    try {
        result = binding.grabSessionFrame();
    } catch ( error ) {
        console.timeEnd( 'WGC grab' );
        console.warn( 'WGC grabSessionFrame threw:', error );
        return undefined;
    }
    console.timeEnd( 'WGC grab' );

    if ( !result?.ok ) {
        console.warn( 'WGC grabSessionFrame failed:', ( result as WgcError )?.error );
        if ( String( ( result as WgcError )?.error || '' ).includes( 'not open' ) ||
             String( ( result as WgcError )?.error || '' ).includes( 'closed' ) ) {
            activeSessionKey = null;
        }
        return undefined;
    }

    if ( !result.width || !result.height || !result.data?.length )
        return undefined;

    return result;
}

export async function grabWgcSessionJpeg( options?: {
    skipBlankCheck?: boolean;
}): Promise< Buffer | undefined > {
    const frame = grabWgcSessionRaw();
    if ( !frame )
        return undefined;

    if ( !options?.skipBlankCheck && isLikelyBlankRawFrame( frame ) ) {
        console.warn( 'WGC session frame looked blank; falling back' );
        return undefined;
    }

    return await encodeJpeg( frame );
}

export async function captureWithSessionJpeg(
    target: WgcSessionTarget,
    options?: WgcSessionOptions
): Promise< Buffer | undefined > {
    if ( !ensureWgcSession( target, options ) )
        return undefined;
    return await grabWgcSessionJpeg();
}

/** Legacy helpers — route through the warm session path. */
export async function captureWindowPng( hwnd: number ): Promise< Buffer | undefined > {
    return await captureWithSessionJpeg({ type: 'window', hwnd });
}

export async function captureMonitorPng( bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
}): Promise< Buffer | undefined > {
    return await captureWithSessionJpeg({
        type: 'monitor',
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
    });
}
