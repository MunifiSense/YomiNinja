import { HardwareAccelerationOption, OcrAdapterStatus, TextRecognitionModel } from "../../../../application/adapters/ocr.adapter";
import { OcrResult } from "../../../../domain/ocr_result/ocr_result";
import { pyOcrService } from "../../ocr_services/py_ocr_service/_temp_index";
import { MeikiOcrRecognize_Input, MeikiOcrService } from "../meiki_ocr_service";


export class MeikiOcrPyService implements MeikiOcrService {

    private readonly ocrEngineName = 'MeikiOCR';

    get status(): OcrAdapterStatus {
        return pyOcrService.status;
    }

    async recognize( input: MeikiOcrRecognize_Input ): Promise< OcrResult | null > {
        const det = typeof input.det_threshold === 'number' ? input.det_threshold : 0.5;
        const rec = typeof input.rec_threshold === 'number' ? input.rec_threshold : 0.1;

        // Encode thresholds in language_code to avoid a proto schema change.
        const languageCode = `ja-JP|det=${det}|rec=${rec}`;

        console.time( 'MeikiOCR Recognize' );
        const result = await pyOcrService.recognize({
            id: input.id,
            image: input.image,
            languageCode,
            ocrEngine: this.ocrEngineName,
        });
        console.timeEnd( 'MeikiOCR Recognize' );

        return result;
    }

    async getSupportedModels(): Promise< TextRecognitionModel[] > {
        return [];
    }

    async getHardwareAccelerationOptions(): Promise< HardwareAccelerationOption[] > {
        return await pyOcrService.getHardwareAccelerationOptions( this.ocrEngineName );
    }

    async installHardwareAcceleration( option: HardwareAccelerationOption ): Promise< boolean > {
        return new Promise( ( resolve ) => {
            const callback = ( success: boolean, error?: Error ) => {
                if ( error )
                    console.error( error );

                resolve( success );
            };
            pyOcrService.installHardwareAcceleration({
                option,
                callback,
                logger: console.log
            });
        });
    }
}
