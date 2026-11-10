import { OcrEngineSettings } from "../../../domain/settings_preset/settings_preset";

export const meikiOcrAdapterName = 'MeikiOcrAdapter';

export interface MeikiOcrEngineSettings extends OcrEngineSettings {
    /** Confidence threshold for text detection (0–1). */
    det_threshold: number;
    /** Confidence threshold for character recognition (0–1). */
    rec_threshold: number;
};

export function getMeikiOcrDefaultSettings(): MeikiOcrEngineSettings {
    return {
        ocr_adapter_name: meikiOcrAdapterName,
        hotkey: 'Alt+K',
        image_scaling_factor: 1,
        invert_colors: false,
        det_threshold: 0.5,
        rec_threshold: 0.1,
    };
}
