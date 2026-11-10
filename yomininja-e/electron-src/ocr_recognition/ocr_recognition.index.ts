import { AnnotateJapaneseOcrTextUseCase } from "../@core/application/use_cases/annotate_japanese_ocr_text/annotate_japanese_ocr_text.use_case";
import { get_CloudVisionOcrAdapter, get_GoogleLensOcrAdapter, get_JapaneseHelper, get_KuromojiTermExtractor, get_MangaOcrAdapter, get_MeikiOcrAdapter, get_PpOcrAdapter } from "../@core/infra/container_registry/adapters_registry";
import { get_GetActiveSettingsPresetUseCase, get_GetSupportedLanguagesUseCaseInstance, get_RecognizeImageUseCaseInstance, get_RecognizeSelectionUseCaseInstance } from "../@core/infra/container_registry/use_cases_registry";
import { OcrEngineSettingsU } from "../@core/infra/types/entity_instance.types";
import { OcrRecognitionController } from "./ocr_recognition.controller";
import { OcrRecognitionService } from "./ocr_recognition.service";

const ocrAdapters = [
    get_PpOcrAdapter(),
    get_CloudVisionOcrAdapter(),
    get_GoogleLensOcrAdapter(),
    get_MangaOcrAdapter(),
    get_MeikiOcrAdapter(),
];

const annotateJapaneseOcrTextUseCase = new AnnotateJapaneseOcrTextUseCase(
    get_KuromojiTermExtractor(),
    get_JapaneseHelper(),
);

const ocrRecognitionService = new OcrRecognitionService< OcrEngineSettingsU | any >({
    recognizeImageUseCase: get_RecognizeImageUseCaseInstance(),
    recognizeSelectionUseCase: get_RecognizeSelectionUseCaseInstance(),
    getSupportedLanguagesUseCase: get_GetSupportedLanguagesUseCaseInstance(),
    getActiveSettingsPresetUseCase: get_GetActiveSettingsPresetUseCase(),
    annotateJapaneseOcrTextUseCase,
    ocrAdapters
});

export const ocrRecognitionController = new OcrRecognitionController({
    ocrRecognitionService,    
});