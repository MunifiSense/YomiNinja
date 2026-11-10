import { Container, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, SxProps, TextField, Theme, Typography, debounce, styled } from "@mui/material";
import { useContext } from "react";
import { SettingsContext } from "../../../context/settings.provider";
import { GeneratedFuriganaVisibility, JapaneseAnnotationSettings, JlptKnownLevel, OverlayOcrItemBoxVisuals, TextPositioningMode } from "../../../../electron-src/@core/domain/settings_preset/settings_preset_overlay";
import ColorPicker from "../../common/ColorPicker";
import ResetParameterButton from "../OcrSettings/common/ResetParameterButton";

const DEFAULT_JAPANESE_ANNOTATION: JapaneseAnnotationSettings = {
    furigana_enabled: false,
    jlpt_color_coding_enabled: false,
    known_jlpt_level: 'off',
    dim_known_tokens: false,
    palette: {
        N5: '#4caf50',
        N4: '#2196f3',
        N3: '#9c27b0',
        N2: '#ff9800',
        N1: '#f44336',
        unknown: '#9e9e9e',
    },
};

export const CustomContainer = styled(Container)({
    '&:hover': {
        '& .reset-parameter-btn': {
            visibility: 'visible !important'
        }
    }
});

type OcrResultBoxVisualSettingsProps = {
    textFieldSx: SxProps< Theme >
}

export default function OcrResultBoxVisualSettings( props: OcrResultBoxVisualSettingsProps ) {

    const { textFieldSx } = props;

    const { activeSettingsPreset, updateActivePresetVisuals } = useContext( SettingsContext );

    const ocrItemBoxVisuals: OverlayOcrItemBoxVisuals = activeSettingsPreset?.overlay?.visuals.ocr_item_box;
    const japaneseAnnotation: JapaneseAnnotationSettings = {
        ...DEFAULT_JAPANESE_ANNOTATION,
        ...ocrItemBoxVisuals?.text?.japanese_annotation,
        palette: {
            ...DEFAULT_JAPANESE_ANNOTATION.palette,
            ...ocrItemBoxVisuals?.text?.japanese_annotation?.palette,
        },
    };

    const updateOcrItemBoxVisuals = ( update: Partial< OverlayOcrItemBoxVisuals>  ) => {
        updateActivePresetVisuals({
            ocr_item_box: {
                ...activeSettingsPreset.overlay.visuals.ocr_item_box,
                ...update
            }
        });
    };

    const updateOcrItemBoxVisualsDeb = debounce( updateOcrItemBoxVisuals, 100 );

    const updateJapaneseAnnotation = ( update: Partial< JapaneseAnnotationSettings > ) => {
        updateOcrItemBoxVisualsDeb({
            text: {
                ...ocrItemBoxVisuals.text,
                japanese_annotation: {
                    ...japaneseAnnotation,
                    ...update,
                    palette: {
                        ...japaneseAnnotation.palette,
                        ...update.palette,
                    },
                },
            },
        });
    };

    return ( <>
        <Typography gutterBottom component="div" mb={1} fontSize='1.1rem'>
            Extracted text
        </Typography>

        <Container sx={{ ml: 1.5, mt: 1, mb: 1 }}>
            <FormControlLabel
                label='Always show overlay text'
                title="Show OCR text without hovering result boxes (useful with furigana / JLPT colors)"
                control={
                    <Switch
                        checked={ Boolean( ocrItemBoxVisuals?.always_show_text ) }
                        onChange={ ( event ) => {
                            updateOcrItemBoxVisualsDeb({
                                always_show_text: event.target.checked
                            });
                        }}
                    />
                }
            />
        </Container>

        <Container sx={{ ml: 1,  mt: 2, mb: 1 }}>
            <FormControl fullWidth 
                sx={{
                    display:'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: 300
                }}>
                
                <Select
                    value={ ocrItemBoxVisuals?.text?.positioning?.mode || '' }
                    label="Positioning Mode"
                    title="In case the selected mode is not supported by the OCR engine, 'line-based' mode will be used"
                    onChange={ ( event ) => {
                        const { value } = event.target;
                        if (typeof value === 'string') {
                            updateOcrItemBoxVisualsDeb({
                                text: {
                                    ...ocrItemBoxVisuals.text,
                                    positioning: {
                                        ...ocrItemBoxVisuals.text?.positioning,
                                        mode: value as TextPositioningMode
                                    }
                                }
                            });
                        }
                    }}
                    sx={{ minWidth: !ocrItemBoxVisuals?.text?.positioning?.mode ? 220 : 150 }}
                >
                    <MenuItem value='block-based'
                        title="Supported by all OCR Engines; Position text based on the detected text block position/size."
                    >
                        Block-based
                    </MenuItem>
                    <MenuItem value='line-based'
                        title="Supported by all OCR Engines; Might break JPDB Reader."
                    >
                        Line-based
                    </MenuItem>
                    <MenuItem value='word-based'
                        title="Supported by Google Lens and Cloud Vision; Might break JPDB Reader."
                    >
                        Word-based
                    </MenuItem>
                    <MenuItem value='character-based'
                        title="Supported by Cloud Vision; Breaks JPDB Reader."
                    >
                        Character-based
                    </MenuItem>
                </Select>

                <InputLabel>Positioning Mode</InputLabel>

            </FormControl>
            
        </Container>
            
        <Container sx={{ ml: 1.5,  mt: 0, mb: 0 }}>
            <FormControlLabel label='Add end-of-sentence punctuation'
                title="Fixes Yomitan sentence mining issues"
                control={
                    <Switch
                        checked={ Boolean( ocrItemBoxVisuals?.text?.sentence_ending_punctuation?.enabled ) }
                        onChange={ ( event ) => {
                            updateOcrItemBoxVisualsDeb({
                                text: {
                                    ...ocrItemBoxVisuals.text,
                                    sentence_ending_punctuation: {
                                        ...ocrItemBoxVisuals?.text.sentence_ending_punctuation,
                                        enabled: event.target.checked
                                    }
                                }
                            });
                        }}
                    /> 
                }
            />

            <FormControlLabel label='Invisible'
                title="Hide the added punctuation"
                control={
                    <Switch
                        disabled={ !Boolean( ocrItemBoxVisuals?.text?.sentence_ending_punctuation?.enabled ) }
                        checked={ Boolean( ocrItemBoxVisuals?.text?.sentence_ending_punctuation?.hidden ) }
                        onChange={ ( event ) => {
                            updateOcrItemBoxVisualsDeb({
                                text: {
                                    ...ocrItemBoxVisuals.text,
                                    sentence_ending_punctuation: {
                                        ...ocrItemBoxVisuals?.text.sentence_ending_punctuation,
                                        hidden: event.target.checked
                                    }
                                }
                            });
                        }}
                    /> 
                }
            />
        </Container>

        <CustomContainer sx={{ ml: 1.5,  mt: 3, mb: 5, flexDirection: 'row', display: 'flex' }}>
            <FormControlLabel label='Filter out extracted furigana'
                title='Removes pieces of text that can potentially be furigana (experiemental)'
                control={
                    <Switch
                        checked={ Boolean( ocrItemBoxVisuals?.text?.furigana_filter?.enabled ) }
                        onChange={ ( event ) => {
                            updateOcrItemBoxVisualsDeb({
                                text: {
                                    ...ocrItemBoxVisuals.text,
                                    furigana_filter: {
                                        ...ocrItemBoxVisuals.text?.furigana_filter,
                                        enabled: event.target.checked
                                    }
                                }
                            });
                        }}
                    /> 
                }
                sx={{ mt: 0 }}
            />

            <TextField label="Threshold" sx={textFieldSx}                      
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}
                value={
                    Number(ocrItemBoxVisuals?.text.furigana_filter?.threshold) || 0
                }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    let newValue = Number( event.target.value );
                    newValue = newValue > 0 ? newValue : 10;
                    newValue = newValue < 200 ? newValue : 200;
                    updateOcrItemBoxVisuals({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            furigana_filter: {
                                ...ocrItemBoxVisuals.text.furigana_filter,
                                threshold: newValue
                            }
                        }
                    });
                }}
            />

            <ResetParameterButton
                onClick={ () => {
                    updateOcrItemBoxVisuals({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            furigana_filter: {
                                ...ocrItemBoxVisuals.text.furigana_filter,
                                threshold: 85
                            }
                        }
                    });
                }}
            />

        </CustomContainer>

        <Container sx={{ ml: 1,  mt: 2, mb: 2 }}>
            <FormControl fullWidth 
                sx={{
                    display:'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: 300
                }}>
                
                <Select
                    value={ ocrItemBoxVisuals?.text?.generated_furigana?.visibility || '' }
                    label="Generated Furigana Visibility"
                    title="Affects OCR furigana and extension-generated furigana (JPDBReader)"
                    onChange={ ( event ) => {
                        const { value } = event.target;
                        if (typeof value === 'string') {
                            updateOcrItemBoxVisualsDeb({
                                text: {
                                    ...ocrItemBoxVisuals.text,
                                    generated_furigana: {
                                        ...ocrItemBoxVisuals.text?.generated_furigana,
                                        visibility: value as GeneratedFuriganaVisibility
                                    }
                                }
                            });
                        }
                    }}
                    sx={{ minWidth: !ocrItemBoxVisuals?.text?.generated_furigana?.visibility ? 250 : 185 }}
                >
                    <MenuItem value='visible'>
                        Visible
                    </MenuItem>
                    <MenuItem value='invisible'>
                        Invisible
                    </MenuItem>
                    <MenuItem value='visible-on-line-hover'>
                        Visible on Line Hover
                    </MenuItem>
                    <MenuItem value='visible-on-word-hover'>
                        Visible on Word Hover
                    </MenuItem>
                </Select>

                <InputLabel>Generated Furigana Visibility</InputLabel>

            </FormControl>
            
        </Container>

        <Typography gutterBottom component="div" mb={1} mt={2} fontSize='1.1rem'>
            Japanese annotation (OCR)
        </Typography>

        <Container sx={{ ml: 1.5, mt: 0, mb: 1 }}>
            <FormControlLabel
                label='OCR furigana (ruby)'
                title="Show hiragana readings above kanji on OCR overlay text"
                control={
                    <Switch
                        checked={ Boolean( japaneseAnnotation.furigana_enabled ) }
                        onChange={ ( event ) => {
                            updateJapaneseAnnotation({
                                furigana_enabled: event.target.checked
                            });
                        }}
                    />
                }
            />

            <FormControlLabel
                label='JLPT color coding'
                title="Color tokens by JLPT difficulty level"
                control={
                    <Switch
                        checked={ Boolean( japaneseAnnotation.jlpt_color_coding_enabled ) }
                        onChange={ ( event ) => {
                            updateJapaneseAnnotation({
                                jlpt_color_coding_enabled: event.target.checked
                            });
                        }}
                    />
                }
            />

            <FormControlLabel
                label='Dim known words'
                title="Fade tokens at or below your known JLPT level"
                control={
                    <Switch
                        disabled={ japaneseAnnotation.known_jlpt_level === 'off' }
                        checked={ Boolean( japaneseAnnotation.dim_known_tokens ) }
                        onChange={ ( event ) => {
                            updateJapaneseAnnotation({
                                dim_known_tokens: event.target.checked
                            });
                        }}
                    />
                }
            />
        </Container>

        <Container sx={{ ml: 1, mt: 1, mb: 2 }}>
            <FormControl fullWidth
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: 300
                }}>
                <Select
                    value={ japaneseAnnotation.known_jlpt_level || 'off' }
                    label="Known JLPT Level"
                    title="Furigana is shown on words harder than this level (and unknowns)"
                    onChange={ ( event ) => {
                        const { value } = event.target;
                        if ( typeof value === 'string' ) {
                            updateJapaneseAnnotation({
                                known_jlpt_level: value as JlptKnownLevel
                            });
                        }
                    }}
                    sx={{ minWidth: 185 }}
                >
                    <MenuItem value='off'>Off</MenuItem>
                    <MenuItem value='N5'>N5</MenuItem>
                    <MenuItem value='N4'>N4</MenuItem>
                    <MenuItem value='N3'>N3</MenuItem>
                    <MenuItem value='N2'>N2</MenuItem>
                    <MenuItem value='N1'>N1</MenuItem>
                </Select>
                <InputLabel>Known JLPT Level</InputLabel>
            </FormControl>
        </Container>

        <Container sx={{ mt: 0, mb: 2 }}>
            <ColorPicker label="JLPT N5" sx={textFieldSx}
                value={ japaneseAnnotation.palette.N5 }
                onChangeComplete={ ( color ) => {
                    updateJapaneseAnnotation({
                        palette: { ...japaneseAnnotation.palette, N5: color }
                    });
                }}
            />
            <ColorPicker label="JLPT N4" sx={textFieldSx}
                value={ japaneseAnnotation.palette.N4 }
                onChangeComplete={ ( color ) => {
                    updateJapaneseAnnotation({
                        palette: { ...japaneseAnnotation.palette, N4: color }
                    });
                }}
            />
            <ColorPicker label="JLPT N3" sx={textFieldSx}
                value={ japaneseAnnotation.palette.N3 }
                onChangeComplete={ ( color ) => {
                    updateJapaneseAnnotation({
                        palette: { ...japaneseAnnotation.palette, N3: color }
                    });
                }}
            />
            <ColorPicker label="JLPT N2" sx={textFieldSx}
                value={ japaneseAnnotation.palette.N2 }
                onChangeComplete={ ( color ) => {
                    updateJapaneseAnnotation({
                        palette: { ...japaneseAnnotation.palette, N2: color }
                    });
                }}
            />
            <ColorPicker label="JLPT N1" sx={textFieldSx}
                value={ japaneseAnnotation.palette.N1 }
                onChangeComplete={ ( color ) => {
                    updateJapaneseAnnotation({
                        palette: { ...japaneseAnnotation.palette, N1: color }
                    });
                }}
            />
            <ColorPicker label="JLPT Unknown" sx={textFieldSx}
                value={ japaneseAnnotation.palette.unknown }
                onChangeComplete={ ( color ) => {
                    updateJapaneseAnnotation({
                        palette: { ...japaneseAnnotation.palette, unknown: color }
                    });
                }}
            />
        </Container>
        

        <Container sx={{ mt: 0, mb: 2 }}>

            <ColorPicker label="Text Color" sx={textFieldSx}
                value={ ocrItemBoxVisuals?.text.color || '' }
                onChangeComplete={ (color) => {
                    updateOcrItemBoxVisualsDeb({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            color
                        }
                    });
                }}
            />

            <ColorPicker label="Outline Color" sx={textFieldSx}
                value={ ocrItemBoxVisuals?.text.outline_color || '' }
                onChangeComplete={ (color) => {
                    updateOcrItemBoxVisualsDeb({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            outline_color: color
                        }
                    });
                }}
            />

            <TextField label="Font Size (%)" sx={textFieldSx}                      
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}
                value={ ocrItemBoxVisuals?.text.font_size_factor || 100 }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    updateOcrItemBoxVisuals({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            font_size_factor: Number( event.target.value )
                        }
                    });
                }}
            />

            <TextField label="Font Weight"
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}
                value={ ocrItemBoxVisuals?.text.font_weight / 100 || 5 }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    const value = Number( event.target.value );
                    if ( value > 10 || value < 1 ) return;
                    updateOcrItemBoxVisuals({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            font_weight: Number( event.target.value ) * 100
                        }
                    });
                }}
                sx={{ ...textFieldSx, width: 'min-content'}}
            />

            <TextField label="Letter Spacing (%)"
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}
                value={
                    typeof ocrItemBoxVisuals?.text?.letter_spacing_factor === 'number' ? 
                    ocrItemBoxVisuals?.text?.letter_spacing_factor : 100 
                }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    updateOcrItemBoxVisuals({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            letter_spacing_factor: Number( event.target.value )
                        }
                    });
                }}
                sx={{ ...textFieldSx, minWidth: '126px' }}
            />

            <TextField label="Outline Width" sx={textFieldSx}                      
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}
                value={ ocrItemBoxVisuals?.text.outline_width || 0 }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    updateOcrItemBoxVisuals({                                
                        text: {
                            ...ocrItemBoxVisuals?.text,
                            outline_width: Number( event.target.value )
                        }
                    });
                }}
            />
            
        </Container>

        <Typography gutterBottom component="div" mb={1} fontSize='1.1rem'
            title='Some extensions might override this settings'
        >
            Highlighted text
        </Typography>

        <Container sx={{ mt: 0, mb: 2 }}>

            <ColorPicker label="Text Color" sx={textFieldSx}
                value={ ocrItemBoxVisuals?.selected_text?.color || '' }
                onChangeComplete={ (color) => {
                    updateOcrItemBoxVisualsDeb({                                
                        selected_text: {
                            ...ocrItemBoxVisuals?.selected_text,
                            color
                        }
                    });
                }}
            />

            <ColorPicker label="Highlight Color" sx={textFieldSx}
                value={ ocrItemBoxVisuals?.selected_text?.background_color || '' }
                onChangeComplete={ (color) => {
                    updateOcrItemBoxVisualsDeb({                                
                        selected_text: {
                            ...ocrItemBoxVisuals?.selected_text,
                            background_color: color
                        }
                    });
                }}
            />

        </Container>

        <Typography gutterBottom component="div" mb={1} fontSize='1.1rem'>
            Bounding box
        </Typography>

        <Container sx={{ mt: 0, mb: 2 }}>

            <ColorPicker label="Inactive BG"
                value={ ocrItemBoxVisuals?.background_color_inactive || '' }
                onChangeComplete={ ( color: string ) => {
                    updateOcrItemBoxVisualsDeb({
                        background_color_inactive: color
                    });
                }}
                sx={{ ...textFieldSx, minWidth: '90px' }}
            />

            <ColorPicker label="Active BG"
                value={ ocrItemBoxVisuals?.background_color || '' }
                onChangeComplete={ ( color: string ) => {
                    updateOcrItemBoxVisualsDeb({
                        background_color: color
                    });
                }}
                sx={{ ...textFieldSx, minWidth: '85px' }}
            />

            <ColorPicker label="Inactive Border"
                value={ ocrItemBoxVisuals?.inactive_border_color || '' }
                onChangeComplete={ ( color: string ) => {
                    updateOcrItemBoxVisualsDeb({
                        inactive_border_color: color
                    });
                }}
                sx={{ ...textFieldSx, minWidth: '110px' }}
            />

            <ColorPicker label="Active Border" sx={textFieldSx}
                value={ ocrItemBoxVisuals?.active_border_color || '' }
                onChangeComplete={ ( color: string ) => {
                    updateOcrItemBoxVisualsDeb({                                
                        active_border_color: color
                    });
                }}
            />

            <TextField label="Border Width" sx={textFieldSx}
                title='Border Width'                     
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}                        
                value={ ocrItemBoxVisuals?.border_width || '' }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    updateOcrItemBoxVisuals({                                
                        border_width: Number(event.target.value)
                    });
                }}
            />

            <TextField label="Border Radius" sx={textFieldSx}
                title='Border Radius'
                size='small'
                type="number"
                inputProps={{ style: { textAlign: 'center' } }}                        
                value={ ocrItemBoxVisuals?.border_radius || '' }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    updateOcrItemBoxVisuals({                                
                        border_radius: Number(event.target.value)
                    });
                }}
            />

            <TextField label="Size Offset (%)" sx={textFieldSx}                      
                size='small'
                type="number"                        
                inputProps={{ style: { textAlign: 'center' } }}                        
                value={ ocrItemBoxVisuals?.size_factor || 1 }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    updateOcrItemBoxVisuals({                                
                        size_factor: Number(event.target.value)
                    });
                }}
            />

        </Container>

        <Container sx={{ ml: 1.5, mt: 0, mb: 2, display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
                label='Blur background'
                title="Blurs the capture under the box, then tints with Active BG (use a semi-transparent Active BG for a frosted look)"
                control={
                    <Switch
                        checked={ Boolean( ocrItemBoxVisuals?.background_blur?.enabled ) }
                        onChange={ ( event ) => {
                            updateOcrItemBoxVisualsDeb({
                                background_blur: {
                                    enabled: event.target.checked,
                                    strength: Number( ocrItemBoxVisuals?.background_blur?.strength ) || 8,
                                }
                            });
                        }}
                    />
                }
            />

            <TextField label="Blur Strength" sx={textFieldSx}
                title='Blur radius in pixels'
                size='small'
                type="number"
                disabled={ !ocrItemBoxVisuals?.background_blur?.enabled }
                inputProps={{ style: { textAlign: 'center' }, min: 1, max: 40 }}
                value={ Number( ocrItemBoxVisuals?.background_blur?.strength ) || 8 }
                onInput={ (event: React.ChangeEvent<HTMLInputElement>) => {
                    let newValue = Number( event.target.value );
                    newValue = newValue > 0 ? newValue : 1;
                    newValue = newValue < 40 ? newValue : 40;
                    updateOcrItemBoxVisuals({
                        background_blur: {
                            enabled: Boolean( ocrItemBoxVisuals?.background_blur?.enabled ),
                            strength: newValue,
                        }
                    });
                }}
            />
        </Container>
    </> )
}