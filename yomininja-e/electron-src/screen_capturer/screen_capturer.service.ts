import { BrowserWindow, screen } from "electron";
import { CaptureSource } from "../app/types";
import { join } from 'path';
import { PAGES_DIR } from "../util/directories.util";
import { format } from 'url';
import isDev from 'electron-is-dev';
import { cloneDeep } from 'lodash';
import sharp from "sharp";
import { windowManager } from "../@core/infra/app_initialization";
import { isMacOS, isWindows } from "../util/environment.util";
import {
    captureWithSessionJpeg,
    closeWgcSession,
    isWgcCaptureAvailable,
    type WgcSessionTarget,
} from "../../gyp_modules/wgc_capture/win32/wgc_capture_win32";
import { CaptureBackend } from "../@core/domain/settings_preset/settings_preset_compatibility";

export class ScreenCapturerService {

    captureSource: CaptureSource | undefined = undefined;
    screenCapturerWindow: BrowserWindow | undefined;

    captureHandler: ( frame: Buffer ) => void;
    streamFrameHandler: ( ( frame: Buffer ) => void | Promise<void> ) | undefined;
    intervalBetweenFrames: number = 333; // ms
    obs: any;
    obsConnected: boolean = false;

    private usingWgcStream = false;
    private wgcStreamTimer: NodeJS.Timeout | undefined;
    private wgcStreamInFlight = false;
    private captureBackend: CaptureBackend = 'auto';
    private showWgcBorder = false;

    async createCapturer(
        input: {
            captureSource: CaptureSource,
            showWindow?: boolean,
            streamFrames: boolean,
            force?: boolean,
            captureBackend?: CaptureBackend,
            showWgcBorder?: boolean,
        }
    ) {

        const { showWindow, streamFrames } = input;
        this.captureBackend = input.captureBackend || 'auto';
        this.showWgcBorder = Boolean( input.showWgcBorder );

        if ( input.captureSource.id !== this.captureSource?.id )
            input.force = true;

        this.captureSource = cloneDeep( input.captureSource );

        const preferWgcStream = this.captureBackend === 'auto' || this.captureBackend === 'wgc';

        // Windows Auto OCR: prefer a warm WGC session over the hidden WebRTC window.
        if ( isWindows && isWgcCaptureAvailable() && streamFrames && preferWgcStream ) {
            if ( this.screenCapturerWindow )
                await this.destroyScreenCapturer();

            const started = await this.startWgcStream();
            if ( started ) {
                console.log( 'Screenshot stream backend: WGC' );
                return;
            }
            console.warn( 'WGC stream failed to start; falling back to WebRTC capturer' );
            this.stopWgcStream();
        } else {
            this.stopWgcStream();
        }

        if ( this.captureBackend === 'wgc' && streamFrames ) {
            console.warn( 'WGC stream unavailable while capture_backend=wgc; Auto OCR stream idle' );
            return;
        }

        if ( 
            !input.force &&
            this.screenCapturerWindow
        ){

            if ( input.streamFrames )
                this.startStream();
            else
                this.stopStream();

            return;
        }

        await this.sleep(1000);
        
        if ( this.screenCapturerWindow )
            await this.destroyScreenCapturer();
            
        this.screenCapturerWindow = new BrowserWindow({
            width: 1100,
            height: 600,
            autoHideMenuBar: true,
            show: showWindow,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: false,
                preload: join(__dirname, '../preload.js'),
                backgroundThrottling: false
            },
            title: 'Screen Capturer - YomiNinja'
        });

        const url = isDev
        ? 'http://localhost:8000/screen-capturer'
        : format({
            pathname: join( PAGES_DIR, '/screen-capturer.html'),
            protocol: 'file:',
            slashes: true,
        });

        this.screenCapturerWindow.loadURL(url);

        if ( showWindow ) {
            this.screenCapturerWindow.show();
        }
        
        if ( isDev ) {
            this.screenCapturerWindow.webContents.on(
                'dom-ready',
                this.screenCapturerWindow.webContents.openDevTools
            );
        }

        if ( streamFrames ) {
            this.screenCapturerWindow.webContents.on('dom-ready', () => {
                setTimeout( this.startStream, 3000 );
            });
        }

        this.screenCapturerWindow.webContents.once("did-navigate", () => {
            console.log(`\nWebRTC process id: ${this.screenCapturerWindow?.webContents.getOSProcessId()}\n`);
        });
    }

    async destroyScreenCapturer() {
        this.stopWgcStream();

        if ( !this.screenCapturerWindow ) 
            return;

        this.screenCapturerWindow.webContents.send('screen_capturer:stop_stream');

        await this.sleep(1000);
        
        this.screenCapturerWindow.destroy();
        this.screenCapturerWindow = undefined;
    }

    setIntervalBetweenFrames( ms: number ) {
        this.intervalBetweenFrames = ms;
        if ( this.usingWgcStream ) {
            this.startWgcStreamTimer();
            return;
        }
        this.screenCapturerWindow?.webContents.send(
            'screen_capturer:set_interval',
            this.intervalBetweenFrames
        );
    }

    grabFrame = () => {
        this.screenCapturerWindow?.webContents.send('screen_capturer:grab_frame');
    }

    startStream = async () => {
        if ( this.usingWgcStream ) {
            await this.startWgcStream();
            return;
        }

        this.screenCapturerWindow?.webContents.send('screen_capturer:start_stream');
        this.setIntervalBetweenFrames( this.intervalBetweenFrames );
    }

    stopStream = () => {
        if ( this.usingWgcStream ) {
            this.stopWgcStream();
            return;
        }
        this.screenCapturerWindow?.webContents.send('screen_capturer:stop_stream');
    }

    private resolveWgcTarget(): WgcSessionTarget | undefined {
        const source = this.captureSource;
        if ( !source )
            return undefined;

        if ( source.type === 'window' ) {
            const hwnd = source.window?.id ?? Number( String( source.id ).split(':')[1] );
            if ( !hwnd || Number.isNaN( hwnd ) )
                return undefined;
            return { type: 'window', hwnd };
        }

        const displays = screen.getAllDisplays();
        const display = source.displayId != null && source.displayId !== -1
            ? displays.find( d => d.id === source.displayId )
            : undefined;
        const bounds = ( display || screen.getPrimaryDisplay() ).bounds;
        return {
            type: 'monitor',
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
        };
    }

    private async startWgcStream(): Promise< boolean > {
        const target = this.resolveWgcTarget();
        if ( !target )
            return false;

        // Prime the session with one grab so failures show up before we claim success.
        const probe = await captureWithSessionJpeg(
            target,
            { showBorder: this.showWgcBorder }
        );
        if ( !probe )
            return false;

        this.usingWgcStream = true;
        this.startWgcStreamTimer();
        return true;
    }

    private startWgcStreamTimer() {
        if ( this.wgcStreamTimer )
            clearInterval( this.wgcStreamTimer );

        this.wgcStreamTimer = setInterval( () => {
            void this.grabWgcStreamFrame();
        }, Math.max( 50, this.intervalBetweenFrames ) );
    }

    private stopWgcStream() {
        if ( this.wgcStreamTimer ) {
            clearInterval( this.wgcStreamTimer );
            this.wgcStreamTimer = undefined;
        }
        this.usingWgcStream = false;
        this.wgcStreamInFlight = false;
        closeWgcSession();
    }

    private async grabWgcStreamFrame() {
        if ( this.wgcStreamInFlight || !this.usingWgcStream )
            return;

        const target = this.resolveWgcTarget();
        if ( !target )
            return;

        this.wgcStreamInFlight = true;
        try {
            const frame = await captureWithSessionJpeg(
                target,
                { showBorder: this.showWgcBorder }
            );
            if ( !frame )
                return;
            if ( this.streamFrameHandler )
                await this.streamFrameHandler( frame );
        } catch ( error ) {
            console.warn( 'WGC stream frame failed:', error );
        } finally {
            this.wgcStreamInFlight = false;
        }
    }

    sleep( ms: number ) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    connectObs = async ( password: string ) => {

        import('obs-websocket-js') // /msgpack
            .then( module => {

                const { default: OBSWebSocket  } = module;
                
                this.obs = new OBSWebSocket();
                
                this.obs.connect('ws://localhost:4455', password )
                    .then(( info: any ) => {
                        this.obsConnected = true;
                    }, () => {
                        console.error('Error Connecting')
                    });
            });
    }

    getOBSScreenshot = async ( sceneName: string ): Promise<Buffer> => {
        const data = await this.obs.call(
            'GetSourceScreenshot',
            {
                "sourceName": sceneName,
                "imageFormat": "png"
            }
        );

        const imageData = data.imageData.split('64,')[1];
        // fs.writeFileSync( './data/obs_screenshot.txt', imageData );

        return Buffer.from( imageData );
    }

    async setCaptureSource( captureSource: CaptureSource ) {
        this.captureSource = cloneDeep( captureSource );

        if ( this.usingWgcStream ) {
            // Re-prime session against the new target on the next tick.
            closeWgcSession();
            await this.startWgcStream();
        }
    }

    async cropWorkAreaFromImage(
        input: {
            image: Buffer
        }
    ): Promise<Buffer> {

        const { image } = input;

        let display = screen.getAllDisplays()
            .find( display => display.id == Number(this.captureSource?.displayId) );

        console.log( this.captureSource );

        console.log({
            displays: screen.getAllDisplays().map( s => s.id )
        });

        // try with a display with negative coordinats

        display = display || (await this.getCurrentDisplay());

        const sharpPipeline = sharp(image);

        const imageMetadata = await sharpPipeline.metadata();

        if (
            !imageMetadata.width ||
            !imageMetadata.height ||
            !display
        )
            return image;

        const { scaleFactor } = display;

        console.log({
            imageMetadata: {
                width: imageMetadata.width,
                height: imageMetadata.height,
            },
            workArea: {
                width: display.workArea.width,
                height: display.workArea.height,
            },
            scaleFactor
        });

        if (
            imageMetadata.height > display.workArea.height ||
            imageMetadata.width > display.workArea.width
        ) {
            const { workArea } = display;

            const region: sharp.Region = {
                top: workArea.y,
                left: workArea.x,
                width: workArea.width,
                height: workArea.height
            };

            if ( region.top < 0 )
                region.top = 0;

            if ( region.left < 0 )
                region.left = 0;

            const overWidth = (region.width + region.left) - imageMetadata.width;
            const overHeight = (region.height + region.top) - imageMetadata.height;

            if ( overWidth > 0 )
                region.width = region.width - overWidth;

            if ( overHeight > 0 )
                region.height = region.height - overHeight;

            if ( isMacOS ) {
                const scaledWorkArea: Electron.Rectangle = {
                    width: workArea.width * scaleFactor,
                    height: workArea.height * scaleFactor,
                    x: workArea.x * scaleFactor,
                    y: workArea.y * scaleFactor
                }
                region.left = scaledWorkArea.x - display.bounds.x;
                region.top = scaledWorkArea.y - display.bounds.y;
                region.width = scaledWorkArea.width <= imageMetadata.width ? scaledWorkArea.width : imageMetadata.width;
                region.height = scaledWorkArea.height <= imageMetadata.height ? scaledWorkArea.height: imageMetadata.height;

                // Add fix to main project
                if ( region.top + region.height > imageMetadata.height )
                    region.height = imageMetadata.height - region.top;
            
                if ( region.left + region.width > imageMetadata.width )
                    region.width = imageMetadata.width - region.left;
            }

            console.log({
                workAreaSharpRegion: region
            });

            const workAreaImage = sharpPipeline.extract(region);

            return await workAreaImage.toBuffer();
        }

        return image;
    }

    async getCurrentDisplay(): Promise<Electron.Display> {
        const cursorScreenPoint = await windowManager.getCursorPosition();
        const displayNearestPoint = screen.getDisplayNearestPoint(cursorScreenPoint);
        return displayNearestPoint;
    }

}