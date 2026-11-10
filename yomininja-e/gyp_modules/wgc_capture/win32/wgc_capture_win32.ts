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

type WgcNativeBinding = {
    isSupported: () => boolean;
    captureWindow: ( hwnd: number ) => WgcCaptureResult;
    captureMonitor: ( x: number, y: number, width: number, height: number ) => WgcCaptureResult;
};

let native: WgcNativeBinding | null | undefined;

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

async function encodePng( frame: WgcRawFrame ): Promise< Buffer > {
    return await sharp( frame.data, {
        raw: {
            width: frame.width,
            height: frame.height,
            channels: 4,
        }
    }).png().toBuffer();
}

export async function captureWindowPng( hwnd: number ): Promise< Buffer | undefined > {
    const binding = getNative();
    if ( !binding )
        return undefined;

    console.time( 'WGC capture' );
    let result: WgcCaptureResult;
    try {
        result = binding.captureWindow( hwnd );
    } catch ( error ) {
        console.timeEnd( 'WGC capture' );
        console.warn( 'WGC captureWindow threw:', error );
        return undefined;
    }
    console.timeEnd( 'WGC capture' );

    if ( !result?.ok ) {
        console.warn( 'WGC captureWindow failed:', ( result as WgcError )?.error );
        return undefined;
    }

    if ( !result.width || !result.height || !result.data?.length )
        return undefined;

    return await encodePng( result );
}

export async function captureMonitorPng( bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
}): Promise< Buffer | undefined > {
    const binding = getNative();
    if ( !binding )
        return undefined;

    console.time( 'WGC capture' );
    let result: WgcCaptureResult;
    try {
        result = binding.captureMonitor(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height
        );
    } catch ( error ) {
        console.timeEnd( 'WGC capture' );
        console.warn( 'WGC captureMonitor threw:', error );
        return undefined;
    }
    console.timeEnd( 'WGC capture' );

    if ( !result?.ok ) {
        console.warn( 'WGC captureMonitor failed:', ( result as WgcError )?.error );
        return undefined;
    }

    if ( !result.width || !result.height || !result.data?.length )
        return undefined;

    return await encodePng( result );
}
