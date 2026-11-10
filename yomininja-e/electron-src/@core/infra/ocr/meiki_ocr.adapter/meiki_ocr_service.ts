import { OcrResult } from "../../../domain/ocr_result/ocr_result";

export type MeikiOcrRecognize_Input = {
    id: string;
    image: Buffer;
    det_threshold?: number;
    rec_threshold?: number;
};

export interface MeikiOcrService {
    recognize: ( input: MeikiOcrRecognize_Input ) => Promise< OcrResult | null >;
};
