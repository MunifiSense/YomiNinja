import {
    HardwareAccelerationOption,
    OcrAdapter,
    OcrAdapterStatus,
    OcrEngineSettingsOptions,
    OcrRecognitionInput,
    RecognizeSelectionInput,
    TextRecognitionModel,
    UpdateOcrAdapterSettingsOutput,
} from "../../../application/adapters/ocr.adapter";
import { OcrResult } from "../../../domain/ocr_result/ocr_result";
import { OcrResultScalable } from "../../../domain/ocr_result_scalable/ocr_result_scalable";
import { MeikiOcrEngineSettings, getMeikiOcrDefaultSettings, meikiOcrAdapterName } from "./meiki_ocr_settings";
import { meikiOcrPyService } from "./meiki_ocr_py/_temp_index";


export class MeikiOcrAdapter implements OcrAdapter< MeikiOcrEngineSettings > {

    static _name: string = meikiOcrAdapterName;
    public readonly name: string = MeikiOcrAdapter._name;
    private idCounter: number = 0;
    private recognitionCallOnHold: OcrRecognitionInput | undefined;

    private prevImage: Buffer = Buffer.from( '' );
    private prevResult: OcrResultScalable | null = null;
    private prevResultTime: Date = new Date();

    private engineSettings: MeikiOcrEngineSettings = getMeikiOcrDefaultSettings();

    get status(): OcrAdapterStatus {
        return meikiOcrPyService.status;
    }

    constructor() {}

    initialize() {}

    async recognize( input: OcrRecognitionInput ): Promise< OcrResultScalable | null > {

        if ( this.status === OcrAdapterStatus.Processing ) {
            this.recognitionCallOnHold = input;
            console.log( 'holding recognition input' );
            return null;
        }
        else {
            this.recognitionCallOnHold = undefined;
        }

        if ( !this.engineSettings ) {
            this.engineSettings = getMeikiOcrDefaultSettings();
        }

        this.idCounter++;

        if ( this.isCacheValid( input.imageBuffer ) )
            return this.prevResult;
        else
            this.prevImage = input.imageBuffer;

        console.log( 'processing recognition input (MeikiOCR)' );

        let result: OcrResult | null = null;
        try {
            result = await meikiOcrPyService.recognize({
                id: this.idCounter.toString() + this.name,
                image: input.imageBuffer,
                det_threshold: this.engineSettings.det_threshold,
                rec_threshold: this.engineSettings.rec_threshold,
            });
        } catch ( error ) {
            console.error( error );
        }

        if ( this.recognitionCallOnHold ) {
            return await this.recognize( this.recognitionCallOnHold );
        }

        if ( !result ) {
            this.cacheResult( null );
            return null;
        }

        const resultScalable = OcrResultScalable.createFromOcrResult( result );
        resultScalable.ocr_engine_name = this.name;
        resultScalable.language = input.language;
        this.cacheResult( resultScalable );

        return resultScalable;
    }

    async recognizeSelection( input: RecognizeSelectionInput ): Promise< OcrResultScalable | null > {
        // MeikiOCR v1 does not support selective recognition.
        return input.partialOcrResult;
    }

    async getSupportedLanguages(): Promise< string[] > {
        return [ 'ja-JP' ];
    }

    async getSupportedModels(): Promise< TextRecognitionModel[] > {
        return [];
    }

    async installModel( _modelName: string ): Promise< boolean > {
        return false;
    }

    async getHardwareAccelerationOptions(): Promise< HardwareAccelerationOption[] > {
        return await meikiOcrPyService.getHardwareAccelerationOptions();
    }

    async installHardwareAcceleration( option: HardwareAccelerationOption ): Promise< boolean > {
        return await meikiOcrPyService.installHardwareAcceleration( option );
    }

    async updateSettings(
        settingsUpdate: MeikiOcrEngineSettings,
        _oldSettings?: MeikiOcrEngineSettings
    ): Promise< UpdateOcrAdapterSettingsOutput< MeikiOcrEngineSettings > > {
        this.engineSettings = settingsUpdate;
        this.resetCache();
        return {
            settings: settingsUpdate,
            restart: false,
        };
    }

    getDefaultSettings(): MeikiOcrEngineSettings {
        return getMeikiOcrDefaultSettings();
    }

    getSettingsOptions(): OcrEngineSettingsOptions {
        throw new Error( 'MeikiOcrAdapter.getSettingsOptions() not implemented' );
    }

    restart( callback: () => void ): void {
        console.warn( "Warning! 'MeikiOcrAdapter.restart' is not implemented!" );
        callback();
    }

    private cacheResult( result: OcrResultScalable | null ) {
        this.prevResult = result;
        this.prevResultTime = new Date();
    }

    private getCacheAge(): number {
        return ( Date.now() - this.prevResultTime.getTime() ) / 1000;
    }

    private isCacheValid( image: Buffer ): boolean {
        if ( this.getCacheAge() > 30 )
            return false;

        if ( !this.prevImage?.equals )
            return false;

        return this.prevImage.equals( image );
    }

    private resetCache() {
        this.prevImage = Buffer.from( '' );
    }
}
