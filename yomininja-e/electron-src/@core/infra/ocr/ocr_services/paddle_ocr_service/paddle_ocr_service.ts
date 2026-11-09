import { OcrItem, OcrItemBox, OcrResult, OcrTextLine } from "../../../../domain/ocr_result/ocr_result";
import { OcrAdapterStatus, UpdateOcrAdapterSettingsOutput } from "../../../../application/adapters/ocr.adapter";
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { OCRServiceClient } from "../../../../../../grpc/rpc/ocr_service/OCRService";
import { RecognizeDefaultResponse__Output } from "../../../../../../grpc/rpc/ocr_service/RecognizeDefaultResponse";
import { GetSupportedLanguagesResponse__Output } from "../../../../../../grpc/rpc/ocr_service/GetSupportedLanguagesResponse";
import { ocrServiceProto } from "../../../../../../grpc/grpc_protos";
import { RecognizeBytesRequest } from "../../../../../../grpc/rpc/ocr_service/RecognizeBytesRequest";
import { join } from "path";
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import isDev from 'electron-is-dev';
import { BIN_DIR, USER_DATA_DIR } from "../../../../../util/directories.util";
import os from 'os';
import { UpdatePpOcrSettingsRequest } from "../../../../../../grpc/rpc/ocr_service/UpdatePpOcrSettingsRequest";
import { OcrEngineSettingsU } from "../../../types/entity_instance.types";
import fs from 'fs';
import { PpOcrEngineSettings } from "../../ppocr.adapter/ppocr_settings";
import { UpdateSettingsResponse__Output } from "../../../../../../grpc/rpc/ocr_service/UpdateSettingsResponse";
import { DetectRequest } from "../../../../../../grpc/rpc/ocr_service/DetectRequest";
import { DetectResponse__Output } from "../../../../../../grpc/rpc/ocr_service/DetectResponse";
import { getNextPortAvailable } from "../../../util/port_check";
import { TextLine__Output } from "../../../../../../grpc/rpc/ocr_service/TextLine";
import { isLinux } from "../../../../../util/environment.util";

type LegacyPpOcrResult = {
    text?: string;
    recognition_score?: number;
    classification_score?: number;
    classification_label?: number;
    box?: OcrItemBox;
    is_vertical?: boolean;
};

type LegacyRecognizeDefaultResponse = {
    id?: string;
    results?: LegacyPpOcrResult[];
    context_resolution?: { width?: number; height?: number };
};

const LEGACY_PPOCR_PROTO = `syntax = "proto3";
package ocr_service;
service OCRService {
  rpc RecognizeBytes( RecognizeBytesRequest ) returns ( RecognizeDefaultResponse ) {}
  rpc GetSupportedLanguages( GetSupportedLanguagesRequest ) returns ( GetSupportedLanguagesResponse ) {}
  rpc UpdatePpOcrSettings( UpdatePpOcrSettingsRequest ) returns ( UpdateSettingsResponse ) {}
  rpc Detect( DetectRequest ) returns ( DetectResponse ) {}
}
message RecognizeBytesRequest {
  string id = 1;
  string language_code = 2;
  bytes image_bytes = 3;
  repeated Box boxes = 4;
  string ocr_engine = 5;
}
message Vertex { int32 x = 1; int32 y = 2; }
message Box {
  Vertex bottom_left = 1;
  Vertex bottom_right = 2;
  Vertex top_left = 3;
  Vertex top_right = 4;
}
message Result {
  string text = 1;
  float recognition_score = 2;
  float classification_score = 3;
  int32 classification_label = 4;
  Box box = 5;
  bool is_vertical = 6;
}
message ContextResolution { int32 width = 1; int32 height = 2; }
message RecognizeDefaultResponse {
  string id = 1;
  repeated Result results = 2;
  ContextResolution context_resolution = 3;
}
message GetSupportedLanguagesRequest { string ocr_engine = 1; }
message GetSupportedLanguagesResponse { repeated string language_codes = 1; }
message DetectRequest {
  string id = 1;
  string language_code = 2;
  bool crop_image = 3;
  bytes image_bytes = 4;
  string ocr_engine = 5;
}
message DetectResult { bytes image_bytes = 1; Box box = 2; }
message DetectResponse {
  string id = 1;
  repeated DetectResult results = 2;
  ContextResolution context_resolution = 3;
}
message UpdatePpOcrSettingsRequest {
  int32 max_image_width = 1;
  int32 cpu_threads = 2;
  string inference_runtime = 3;
  double det_db_thresh = 4;
  double det_db_box_thresh = 5;
  double det_db_unclip_ratio = 6;
  string det_db_score_mode = 7;
  bool use_dilation = 8;
  double cls_thresh = 9;
}
message UpdateSettingsResponse { bool success = 1; }
`;

function loadLegacyPpOcrProto(): any {
    const protoPath = join( USER_DATA_DIR, 'ocr_service_ppocr_legacy.proto' );
    fs.mkdirSync( USER_DATA_DIR, { recursive: true } );
    fs.writeFileSync( protoPath, LEGACY_PPOCR_PROTO, 'utf8' );

    const packageDefinition = protoLoader.loadSync( protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    } );
    return grpc.loadPackageDefinition( packageDefinition );
}

export class PaddleOcrService {
    
    public status: OcrAdapterStatus = OcrAdapterStatus.Disabled;
    private ocrServiceClient: OCRServiceClient | null = null;
    private legacyOcrServiceClient: any = null;
    private serviceProcess: ChildProcessWithoutNullStreams;
    private settingsPresetsRoot: string;
    private binRoot: string;

    private autoRestartCount = 0;

    constructor() {
        
        const arch = `${process.arch}`;

        this.binRoot = isDev
            ? join( BIN_DIR, `/${os.platform()}/${arch}/ppocr` )
            : join( process.resourcesPath, '/bin/ppocr/' );
    }

    connect( serviceAddress?: string ) {

        if ( !serviceAddress )
            return;
    
        console.log("initializing PaddleOcrService | Address: "+ serviceAddress );

        this.ocrServiceClient = new ocrServiceProto.ocr_service.OCRService(
            serviceAddress,
            grpc.credentials.createInsecure(),
        );

        try {
            const legacyProto = loadLegacyPpOcrProto();
            this.legacyOcrServiceClient = new legacyProto.ocr_service.OCRService(
                serviceAddress,
                grpc.credentials.createInsecure(),
            );
        } catch ( error ) {
            console.error( 'Failed to load PaddleOCR legacy proto client:', error );
            this.legacyOcrServiceClient = null;
        }

        this.status = OcrAdapterStatus.Enabled;
    }

    async recognize( input: RecognizeBytesRequest ): Promise< OcrResult | null > {
        
        const ok = await this.processStatusCheck();
        if ( !ok ) return null;

        this.status = OcrAdapterStatus.Processing;
        // console.time('PaddleOcrService.recognize');

        // Prebuilt ppocr_infer_service_grpc.exe still returns Result.text (string),
        // while the shared proto expects Result.text_lines. Use the legacy client.
        const client = this.legacyOcrServiceClient || this.ocrServiceClient;
        const clientResponse = await new Promise< LegacyRecognizeDefaultResponse | RecognizeDefaultResponse__Output | undefined >(
            (resolve, reject) => client?.RecognizeBytes( input, ( error: Error | null, response: any ) => {
                if (error) {
                    // Avoid killing a healthy process on transient parse/transport errors;
                    // only restart when the service is actually down.
                    console.error( 'PaddleOCR RecognizeBytes failed:', error.message || error );
                    return reject(error)
                }
                resolve(response);
            })
        ).catch( console.error );
        // console.timeEnd('PaddleOcrService.recognize');
        this.status = OcrAdapterStatus.Enabled;
        
        if ( !clientResponse )
            return null;
        
        if (
            !clientResponse?.context_resolution ||
            !clientResponse?.results
        )
            return null;
        
        const ocrItems: OcrItem[] = [];

        for ( const item of clientResponse.results as Array< LegacyPpOcrResult & { text_lines?: TextLine__Output[] } > ) {

            const lines: OcrTextLine[] = [];

            if ( typeof item?.text === 'string' && item.text.length ) {
                lines.push({
                    content: item.text,
                    box: item.box || undefined
                } as OcrTextLine );
            } else if ( item?.text_lines?.length ) {
                for ( const line of item.text_lines ) {
                    if ( !line?.content?.length ) continue;
                    lines.push({
                        content: line.content,
                        box: line.box || undefined
                    } as OcrTextLine );
                }
            }

            if ( !lines.length ) continue;

            ocrItems.push({
                ...item,
                text: lines,
                is_vertical: item.is_vertical
            } as OcrItem);
        }

        const result = OcrResult.create({
            id: clientResponse.id || '',
            context_resolution: {
                width: clientResponse.context_resolution.width || 0,
                height: clientResponse.context_resolution.height || 0,
            },
            results: ocrItems,
            image: input.image_bytes as Buffer
        });


        return result
    }

    async detect( input: DetectRequest, id: string ): Promise< OcrItemBox[] > {

        const ok = await this.processStatusCheck();
        if ( !ok ) return [];

        const clientResponse = await new Promise< DetectResponse__Output | undefined >(
            (resolve, reject) => this.ocrServiceClient?.Detect( input, ( error, response ) => {
                if (error) {
                    return reject(error)
                }
                resolve(response);
            })
        );
            
        if ( !clientResponse ) return [];

        const results: OcrItemBox[] = clientResponse.results?.map( item => item.box )
            .filter( item => item !== null ) as OcrItemBox[];

        return results || [];
    }

    async getSupportedLanguages(): Promise< string[] > {

        if ( !this.ocrServiceClient )
            return [];
        
        const clientResponse = await new Promise< GetSupportedLanguagesResponse__Output | undefined >(
            (resolve, reject) => this.ocrServiceClient?.GetSupportedLanguages( {}, ( error, response ) => {
                if (error) {
                    this.restart( () => {} );
                    return reject(error)
                }
                resolve(response);
            })
        );
        
        if ( !clientResponse )
            return [];

        // console.log( clientResponse );
        
        return clientResponse.language_codes;
    }

    async startProcess( onInitialized?: ( input?: any ) => void ) {

        this.handleSettingsPreset();

        const platform = os.platform();

        const executableName = platform === 'win32'
            ? 'ppocr_infer_service_grpc.exe' // !
            : 'start.sh'; // start.sh | ppocr_infer_service_grpc

        const executable = join( this.binRoot + `/${executableName}` );

        let port: string | number| undefined = (await getNextPortAvailable( 52_000 )) || 22345;

        this.status = OcrAdapterStatus.Starting;
        this.serviceProcess = spawn(
            executable,
            [ this.settingsPresetsRoot, 'default', port.toString() ],
            { cwd: this.binRoot, detached: isLinux }
        );
        this.serviceProcess.on('error', error => {
            console.error(error);
            this.killServiceProcess();
            if ( this.status === OcrAdapterStatus.Starting ) {
                this.status = OcrAdapterStatus.Disabled
                console.log("Warning: PaddleOCR service couldn't be started!")
            }
            if (onInitialized) onInitialized();
        });
        

        // Handle stdout and stderr data
        this.serviceProcess.stdout.on('data', ( data: string ) => {

            if ( data.includes('[INFO-JSON]:') ) {

                const jsonData = JSON.parse( data.toString().split('[INFO-JSON]:')[1] );

                if ( 'server_address' in jsonData ) {
                    this.connect( jsonData.server_address );
                    if ( onInitialized )
                        onInitialized();
                }
            }
            
            console.log(`stdout: ${data}`);        
        });

        this.serviceProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        // Handle process exit
        this.serviceProcess.on('close', (code) => {
            console.log(`ppocr_infer_service_grpc process exited with code ${code}`);
            this.killServiceProcess();

            if ( 
                this.status != OcrAdapterStatus.Restarting &&
                this.status != OcrAdapterStatus.Disabled &&
                this.autoRestartCount < 1
            ) {
                this.restart( () => {} );
                this.autoRestartCount++;
            }
            if ( this.autoRestartCount >= 1 ) {
                this.status = OcrAdapterStatus.Disabled;
                if (onInitialized) onInitialized();
            }
        });

    }

    enable = async ( callback?: () => void ) => {
        this.status = OcrAdapterStatus.Enabled;
        try {
            await new Promise( resolve => {
                this.startProcess( resolve );
            });
        } catch (error) {
            console.log(error);
        }
        
        await this.processStatusCheck();
        
        if (!callback) return;

        callback();
    }
    disable = () => {
        this.status = OcrAdapterStatus.Disabled;
        this.killServiceProcess();
    }

    // Checks if the ppocrService is enabled.
    async processStatusCheck(): Promise< boolean > {

        if ( this.status === OcrAdapterStatus.Disabled )
            return false;
        
        let triesCounter = 0;

        while( this.status != OcrAdapterStatus.Enabled ) {

            // Waiting for 2 seconds
            await new Promise( (resolve) => setTimeout(resolve, 2000) );
            triesCounter++;

            console.log('ppocrServiceProcessStatusCheck: '+ triesCounter);

            if ( triesCounter > 5 )  {
                this.status = OcrAdapterStatus.Disabled;
                console.log('Warning: PaddleOCR service is not running!')
                return false;
            }
        }

        return true
    }

    async updateSettings(
        _settingsUpdate: OcrEngineSettingsU,
        _oldSettings?: OcrEngineSettingsU
    ): Promise< UpdateOcrAdapterSettingsOutput< PpOcrEngineSettings > > {

        let restart = false;

        let settingsUpdate = _settingsUpdate as PpOcrEngineSettings;
        let oldSettings = _oldSettings as PpOcrEngineSettings;

        if (
            !oldSettings ||
            oldSettings?.cpu_threads != settingsUpdate.cpu_threads ||
            oldSettings?.max_image_width != settingsUpdate.max_image_width ||
            oldSettings?.inference_runtime != settingsUpdate.inference_runtime
        )
            restart = true;

        settingsUpdate = {
            ...settingsUpdate,
            max_image_width: this.maxImageWidthValidation( settingsUpdate.max_image_width )
        };

        const requestInput: UpdatePpOcrSettingsRequest = {
            ...settingsUpdate,
        };

        const ok = await this.processStatusCheck();

        if ( !ok ) return { settings: settingsUpdate, restart: false };
        
        let clientResponse: UpdateSettingsResponse__Output | undefined;
        try {
            clientResponse = await new Promise< UpdateSettingsResponse__Output | undefined >(
                (resolve, reject) => this.ocrServiceClient?.UpdatePpOcrSettings( requestInput, ( error, response ) => {
                    if (error) {
                        return reject(error)
                    }
                    resolve(response);
                })
            );
        } catch (error) {
            console.error( error );
            console.log("retrying: PpOcrAdapter.updateSettings");
            return await this.updateSettings( settingsUpdate, oldSettings );
        }
        
        return {
            settings: settingsUpdate,
            restart,
        };
    }


    async restart( callback: () => void ): Promise< void > {

        this.restartProcess();

        const ok = await this.processStatusCheck();
        callback();

        if ( !ok ) {
            console.log("PaddleOCR service failed to restart!");
            return;
        }

        console.log("PaddleOCR service restarted successfully");
    };

    private restartProcess() {
        this.status = OcrAdapterStatus.Restarting;
        this.killServiceProcess();
        this.startProcess();
    }

    private maxImageWidthValidation( maxImageWidth?: number ) {        

        if ( 
            !maxImageWidth ||
            maxImageWidth % 32 != 0 || // Must be multiple of 32
            maxImageWidth < 0
        )
            return 1600;

        return maxImageWidth;
    }

    handleSettingsPreset() {

        this.settingsPresetsRoot = join( USER_DATA_DIR, "/ppocr/presets/" );

        const dirExists = fs.existsSync( this.settingsPresetsRoot );
        const fileExists = fs.existsSync( this.settingsPresetsRoot + 'default.json' );

        if ( !dirExists )
            fs.mkdirSync( this.settingsPresetsRoot, { recursive: true } );
    
        if ( !fileExists ) {
            const baseFilePath = join( this.binRoot, '/presets/default.json' );
            const dest = join( this.settingsPresetsRoot, 'default.json' );
            fs.copyFileSync(
                baseFilePath,
                dest
            );
        }
    }

    handleLanguageTags( tag: string ) {
        
    }

    killServiceProcess = () => {
        if ( !this.serviceProcess ) return;
        console.log('Killing PaddleOCRService');

        if ( !this.serviceProcess.pid ) return;

        try {
            // Ensure the child process is killed before exiting
            this.serviceProcess.kill('SIGTERM'); // You can use 'SIGINT' or 'SIGKILL' as well
            if ( isLinux )
                process.kill( -this.serviceProcess.pid );
        } catch (error) {
            console.error(error);
        }
    }
}