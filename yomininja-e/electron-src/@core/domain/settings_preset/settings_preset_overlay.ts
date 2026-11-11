export type OverlayOcrRegionVisuals = {
    border_width: number;
};

export type TextPositioningMode = 'block-based' | 'line-based' | 'word-based' | 'character-based';
export type GeneratedFuriganaVisibility = 'visible' | 'invisible' | 'hidden' | 'visible-on-line-hover' | 'visible-on-word-hover';
export type JlptKnownLevel = 'off' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export type JlptColorPalette = {
    N5: string;
    N4: string;
    N3: string;
    N2: string;
    N1: string;
    unknown: string;
};

export type JapaneseAnnotationSettings = {
    furigana_enabled: boolean;
    jlpt_color_coding_enabled: boolean;
    known_jlpt_level: JlptKnownLevel;
    dim_known_tokens: boolean;
    palette: JlptColorPalette;
};

export type OverlayOcrItemBoxVisuals = {
    inactive_border_color: string;
    active_border_color: string;
    border_width: number; // pixels
    border_radius: number; // pixels
    background_color: string;
    background_color_inactive: string;
    size_factor: number; // % 0 .. 100
    /** When true, OCR text is always visible (not only on box hover). */
    always_show_text?: boolean;
    /** Frosted box background: blur the capture under the box, then tint with background_color. */
    background_blur?: {
        enabled: boolean;
        /** CSS blur radius in pixels. */
        strength: number;
    };
    text: {
        color: string;
        font_size_factor: number; // % 0 .. 100
        font_weight: number;
        letter_spacing?: number; 
        letter_spacing_factor: number; // % 0 .. 100
        outline_width: number; // pixels
        outline_color: string;
        character_positioning: boolean; // Individual character positioning
        positioning?: {
            mode: TextPositioningMode,
        },
        sentence_ending_punctuation: {
            enabled: boolean;
            hidden: boolean;
        };
        furigana_filter: {
            enabled: boolean;
            threshold: number;
        };
        generated_furigana: {
            visibility: GeneratedFuriganaVisibility
        };
        japanese_annotation?: JapaneseAnnotationSettings;
    };
    selected_text: {
        color: string;
        background_color: string;
    };
};

export type OverlayMouseVisuals = {
    show_custom_cursor: boolean;
    custom_cursor_size: number;
};

export type OverlayFrameVisuals = {
    border_color: string;
    border_width: number; // pixels
};

export type OverlayIndicatorsVisuals = {
    processing_icon_color: string;
}

export type OverlayVisualCustomizations = {
    ocr_item_box: OverlayOcrItemBoxVisuals;
    frame: OverlayFrameVisuals;
    ocr_region: OverlayOcrRegionVisuals;
    mouse: OverlayMouseVisuals;
    indicators: OverlayIndicatorsVisuals;
};

export type ClickThroughMode = 'auto' | 'enabled' | 'disabled';
export type ShowWindowOnCopy = {
    enabled: boolean;
    title: string;
};
export type OverlayBehavior = {
    copy_text_on_hover: boolean;
    copy_text_on_click: boolean;
    always_on_top: boolean;
    click_through_mode: ClickThroughMode;
    show_window_on_copy: ShowWindowOnCopy
    always_forward_mouse_clicks: boolean;
    show_window_without_focus: boolean;
    hide_results_on_blur: boolean;
    automatic_adjustment: boolean; // Overlay automatic positioning and resizing
};

export type OverlayHotkeys = {
    ocr: string; // For the selected ocr adapter
    ocr_on_screen_shot: boolean; // Perform ocr when pressing "PrintScreen"
    copy_text: string;
    show: string;
    clear: string;
    toggle: string;
    /** Pause/resume Auto OCR streaming without changing the template. */
    toggle_auto_ocr?: string;
    manual_adjustment: string;
    remote_control_key: string;
};

export type OverlaySettings = {
    visuals: OverlayVisualCustomizations;
    hotkeys: OverlayHotkeys;
    behavior: OverlayBehavior;
};