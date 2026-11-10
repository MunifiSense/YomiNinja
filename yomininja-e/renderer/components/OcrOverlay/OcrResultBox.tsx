import { CSSProperties, useEffect, useRef, useState } from "react";
import { OcrItemScalable, OcrTextLineScalable, OcrTextLineSymbolScalable } from "../../../electron-src/@core/domain/ocr_result_scalable/ocr_result_scalable";
import { styled } from "@mui/material";
import { OverlayBehavior, OverlayHotkeys, OverlayOcrItemBoxVisuals } from "../../../electron-src/@core/domain/settings_preset/settings_preset_overlay";
import OcrResultLine from "./OcrResultLine";
import { OcrResultContextResolution } from "../../../electron-src/@core/domain/ocr_result/ocr_result";

const BaseOcrResultBox = styled('div')({
    // border: 'solid',
    outline: 'solid',
    position: 'absolute',
    // fontFamily: "arial",
    // color: 'transparent',
    contentVisibility: 'hidden',
    transformOrigin: 'top left',
    paddingLeft: '0%',
    paddingRight: '0%',
    textAlign: 'center',
    // letterSpacing: '0.1rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'auto'
});


export default function OcrResultBox( props: {
    ocrItem: OcrItemScalable;
    ocrRegionSize: { // 0–1 fractions of the capture
        width: number;
        height: number;
    };
    ocrRegionPosition?: { // 0–1 fractions of the capture
        top: number;
        left: number;
    };
    contextResolution: OcrResultContextResolution;
    ocrRegionId?: string;
    ocrItemBoxVisuals: OverlayOcrItemBoxVisuals;
    overlayHotkeys: OverlayHotkeys;
    overlayBehavior: OverlayBehavior;
    contentEditable: boolean;
    isElectron: boolean;
    fontFamily: string;
    /** Capture / OCR image data URL used for frosted backgrounds. */
    captureImage?: string;
    onMouseEnter?: ( item: OcrItemScalable, ocrRegionId?: string ) => void;
    onMouseLeave?: () => void;
    onClick?: ( item: OcrItemScalable, ocrRegionId?: string ) => void;
    onDoubleClick?: () => void;
    onBlur?: () => void;
} ): JSX.Element {
    
    const {
        ocrItem,
        ocrRegionSize,
        ocrRegionPosition,
        contextResolution,
        ocrItemBoxVisuals,
        contentEditable,
        ocrRegionId,
        isElectron,
        captureImage,
    } = props;
    const { box } = ocrItem;

    const boxRef = useRef(null);

    const lineCount = ocrItem.text.length;
    const isMultiline = lineCount > 1;
    const generatedFuriganaSettings = ocrItemBoxVisuals.text?.generated_furigana;
    const japaneseAnnotation = ocrItemBoxVisuals?.text?.japanese_annotation;
    const jlptPalette = japaneseAnnotation?.palette;
    
    const [ alignItems, setAlignItems ] = useState( 'center' );
    const [ includesGeneratedFurigana, setIncludesGeneratedFurigana ] = useState( false );

    useEffect( () => {

        if ( isMultiline )
            setAlignItems( 'flex-start' );
        else 
            setAlignItems( 'center' );

    }, [ ocrItem ] );


    useEffect( () => {
        const hasOcrFurigana = Boolean(
            japaneseAnnotation?.furigana_enabled &&
            ocrItem.text?.some( line =>
                line.segments?.some( segment => segment.furigana?.length )
            )
        );

        if ( hasOcrFurigana ) {
            setIncludesGeneratedFurigana( true );
            if ( alignItems !== 'flex-start' )
                setAlignItems( 'flex-start' );
        }
    }, [ ocrItem, japaneseAnnotation?.furigana_enabled ] );

    useEffect( () => {

        if ( !boxRef?.current ) return;
        
        const observer = new MutationObserver( ( mutations ) => {
            mutations.forEach( ( mutation ) => {
                
                if ( mutation.type !== 'childList' ) 
                    return;

                const addedNodes = Array.from( mutation.addedNodes );
                
                if ( !addedNodes.some( node => node.nodeName === 'RUBY' ) )
                    return;

                console.log('A <ruby> child was added!');
                setIncludesGeneratedFurigana(true);

                if ( alignItems !== 'flex-start' )
                    setAlignItems( 'flex-start' );
            });
        });
    
        observer.observe( boxRef.current, { childList: true, subtree: true } );

        return () => observer.disconnect();
    }, [] );

    // const fontSize = isVertical ? box.dimensions.width * 90 : box.dimensions.height * 65;

    const regionWidthPx = isElectron ?
        ocrRegionSize.width * window.innerWidth:
        ocrRegionSize.width * contextResolution.width;

    const regionHeightPx = isElectron ?
        ocrRegionSize.height * window.innerHeight :
        ocrRegionSize.height * contextResolution.height;

    
    const boxWidthPx = regionWidthPx * ( box.dimensions.width / 100 );
    const boxHeightPx = regionHeightPx * ( box.dimensions.height / 100 );
    
    let { isVertical } = box;

    const fontSize = isVertical ? boxWidthPx * 0.7 : boxHeightPx * 0.75; // Pixels

    let { font_size_factor } = ocrItemBoxVisuals?.text;

    if ( isVertical )
        font_size_factor = font_size_factor * 1.10;

    const fontSizeOffset =  ( fontSize * ( font_size_factor / 100 ) ) - fontSize;

    // if ( box.angle_degrees < -70 )
    //     isVertical = true;

    let adjustedFontSize = ( fontSize + fontSizeOffset ); // px

    if ( ocrItem.text.length > 0 )
        adjustedFontSize = ( adjustedFontSize / ocrItem.text.length );

    // Emotion nested selectors (`& ruby`, etc.) are not valid CSSProperties keys.
    const activeBoxCss: Record<string, any> = {
        backgroundColor: ocrItemBoxVisuals?.background_color || 'black',
        outlineColor: ocrItemBoxVisuals?.active_border_color || 'red',
        color: ocrItemBoxVisuals?.text.color || 'white',
        fontSize: adjustedFontSize + 'px', // isVertical ? fontSize * 0.8 : fontSize * 0.85
        lineHeight: adjustedFontSize + 'px',
        fontWeight: ocrItemBoxVisuals?.text?.font_weight,
        letterSpacing: ocrItemBoxVisuals?.text.letter_spacing || 'inherit',
        contentVisibility: 'visible',
        zIndex: 10,
        '-webkit-text-stroke-width': ocrItemBoxVisuals?.text?.outline_width,
        '-webkit-text-stroke-color': ocrItemBoxVisuals?.text?.outline_color,
        '& ruby': {
            backgroundColor: ocrItemBoxVisuals.background_color
        },
        '& ruby rt': {
            backgroundColor: ocrItemBoxVisuals.background_color
        }
    };

    

    if ( 
        generatedFuriganaSettings &&
        generatedFuriganaSettings?.visibility !== 'visible'
    ) {
        activeBoxCss['& rt'] = {
            display: 'none'
        };

        if ( generatedFuriganaSettings.visibility === 'visible-on-word-hover' ) {
            activeBoxCss['& ruby:hover rt'] = {
                display: 'ruby-text',
                backgroundColor: ocrItemBoxVisuals?.background_color
            };
        }
        else if ( generatedFuriganaSettings.visibility === 'visible-on-line-hover' ) {
            activeBoxCss['& .ocr-line-container:hover rt'] = {
                display: 'ruby-text',
                backgroundColor: ocrItemBoxVisuals?.background_color
            };
        }
    }

    const alwaysShowText = Boolean( ocrItemBoxVisuals?.always_show_text );
    const blurEnabled = Boolean( ocrItemBoxVisuals?.background_blur?.enabled );
    const blurStrength = Math.max( 1, Number( ocrItemBoxVisuals?.background_blur?.strength ) || 8 );
    const canFrost = blurEnabled && typeof captureImage === 'string' && captureImage.length > 0;

    if ( canFrost ) {
        activeBoxCss.backgroundColor = 'transparent';
        activeBoxCss['& ruby'] = { backgroundColor: 'transparent' };
        activeBoxCss['& ruby rt'] = { backgroundColor: 'transparent' };
        if ( activeBoxCss['& ruby:hover rt'] ) {
            activeBoxCss['& ruby:hover rt'] = {
                ...activeBoxCss['& ruby:hover rt'],
                backgroundColor: 'transparent',
            };
        }
        if ( activeBoxCss['& .ocr-line-container:hover rt'] ) {
            activeBoxCss['& .ocr-line-container:hover rt'] = {
                ...activeBoxCss['& .ocr-line-container:hover rt'],
                backgroundColor: 'transparent',
            };
        }
    }

    const Box = styled( BaseOcrResultBox )({
        '--jlpt-n5': jlptPalette?.N5 || '#4caf50',
        '--jlpt-n4': jlptPalette?.N4 || '#2196f3',
        '--jlpt-n3': jlptPalette?.N3 || '#9c27b0',
        '--jlpt-n2': jlptPalette?.N2 || '#ff9800',
        '--jlpt-n1': jlptPalette?.N1 || '#f44336',
        '--jlpt-unknown': jlptPalette?.unknown || '#9e9e9e',
        ...( alwaysShowText ? activeBoxCss : {} ),
        "&:hover": activeBoxCss,
        "&.editable": activeBoxCss,
        backgroundColor: alwaysShowText
            ? ( canFrost ? 'transparent' : ( ocrItemBoxVisuals?.background_color || 'black' ) )
            : ocrItemBoxVisuals.background_color_inactive,
        outlineColor: alwaysShowText
            ? ( ocrItemBoxVisuals?.active_border_color || 'red' )
            : ( ocrItemBoxVisuals?.inactive_border_color || 'red' ),
        outlineWidth: ocrItemBoxVisuals?.border_width || '0px',
        borderRadius: ocrItemBoxVisuals?.border_radius || '0rem',
        writingMode: isVertical ? 'vertical-rl' :'inherit',
        textOrientation: isVertical ? 'upright' :'inherit',
        fontSize: fontSize + 'px',
        lineHeight: fontSize + 'px',
        contentVisibility: alwaysShowText ? 'visible' : 'hidden',
        alignItems: alignItems,
        flexDirection: isVertical ? 'column' : 'column', // why booth column?
        justifyContent: isMultiline ? 'space-between' : 'center',
        // Keep overflow visible so furigana/ruby can extend above the box.
        // Frost layers are clipped in their own wrapper instead.
        isolation: canFrost ? 'isolate' : undefined,
        '& .ocr-box-frost-clip': {
            opacity: alwaysShowText ? 1 : 0,
            transition: 'opacity 60ms linear',
        },
        '&:hover .ocr-box-frost-clip, &.editable .ocr-box-frost-clip': {
            opacity: 1,
        },
    });

    const { width } = box.dimensions;
    const { left } = box.position;
    const minWidth = width + left > 100 ? 100 - left : width;

    const bottom = 100 - box.position.top - box.dimensions.height;

    const sizeExpansionFactor = ocrItemBoxVisuals.size_factor / 100; // ! Add to settings menu
    const sizeExpansionPx = isVertical ?
        (boxWidthPx * sizeExpansionFactor) / lineCount:
        (boxHeightPx * sizeExpansionFactor) / lineCount;

    const sizeExpansionWidthPct = ( sizeExpansionPx / regionWidthPx ) * 100;
    const sizeExpansionHeightPct = ( sizeExpansionPx / regionHeightPx ) * 100;
    const sizeExpansionLeftPct =  sizeExpansionWidthPct / 2;
    const sizeExpansionBottomPct =  sizeExpansionHeightPct / 2;

    const expandedLeftPct = left - sizeExpansionLeftPct;
    const expandedBottomPct = bottom - sizeExpansionBottomPct;
    const expandedWidthPct = minWidth + sizeExpansionWidthPct;
    const expandedHeightPct = box.dimensions.height + sizeExpansionHeightPct;
    const expandedTopPct = 100 - expandedBottomPct - expandedHeightPct;

    const regionLeft = ocrRegionPosition?.left ?? 0;
    const regionTop = ocrRegionPosition?.top ?? 0;
    const absLeft = regionLeft + ocrRegionSize.width * ( expandedLeftPct / 100 );
    const absTop = regionTop + ocrRegionSize.height * ( expandedTopPct / 100 );
    const absWidth = Math.max( ocrRegionSize.width * ( expandedWidthPct / 100 ), 0.0001 );
    const absHeight = Math.max( ocrRegionSize.height * ( expandedHeightPct / 100 ), 0.0001 );

    const frostClipStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        overflow: 'hidden',
        borderRadius: 'inherit',
        pointerEvents: 'none',
    };

    const frostLayerStyle: CSSProperties = {
        position: 'absolute',
        pointerEvents: 'none',
        backgroundImage: `url(${captureImage})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        width: `${( 1 / absWidth ) * 100}%`,
        height: `${( 1 / absHeight ) * 100}%`,
        left: `${( -absLeft / absWidth ) * 100}%`,
        top: `${( -absTop / absHeight ) * 100}%`,
        filter: `blur(${blurStrength}px)`,
        transform: 'scale(1.12)',
        transformOrigin: 'center',
    };

    const tintLayerStyle: CSSProperties = {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundColor: ocrItemBoxVisuals?.background_color || 'black',
    };


    useEffect(() => {

        if ( !boxRef?.current || !contentEditable )
            return
        
        boxRef.current.focus();
        
    }, [contentEditable]);
    
    
    const boxTransform = box.transform_origin === 'center' ?
        `rotate( ${box.angle_radians}rad )` :
        `rotate( ${box.angle_degrees}deg )`;

        
    let text: OcrTextLineScalable[];

    if (
        ocrItem.text.length > 1 &&
        ocrItemBoxVisuals.text?.positioning?.mode === 'block-based'
    ) {
        const firstLine = {
            ...ocrItem.text[0],
            segments: ocrItem.text[0].segments
                ? [ ...ocrItem.text[0].segments ]
                : undefined,
        };

        for( let i=1; i < ocrItem.text.length; i++ ) {
            firstLine.content += `\u200B${ocrItem.text[i].content}`;
            if ( ocrItem.text[i].segments?.length ) {
                firstLine.segments = [
                    ...( firstLine.segments || [] ),
                    { surface: '\u200B', jlpt_level: 'unknown' as const },
                    ...ocrItem.text[i].segments,
                ];
            }
        }

        text = [firstLine];
    }
    else {
        text = ocrItem.text;
    }

    return (
        <Box className={ `extracted-text ${contentEditable ? 'editable' : ''}` } ref={boxRef}
            role="textbox"
            style={{
                left: expandedLeftPct + '%',
                // top: box.position.top + '%',
                transformOrigin: box?.transform_origin || 'top left',
                bottom: expandedBottomPct + '%',
                transform: boxTransform,
                minWidth: expandedWidthPct + '%',
                minHeight: expandedHeightPct + '%',
                cursor: ocrItem.recognition_state === 'DETECTED' ? 'progress' : 'unset'
            }}
            onMouseEnter={ () => props.onMouseEnter( ocrItem, ocrRegionId ) }
            onMouseLeave={ props.onMouseLeave }
            onClick={ () => props.onClick( ocrItem, ocrRegionId ) }
            onDoubleClick={ (e) => {
                if ( !e.ctrlKey )
                    return;
                props.onDoubleClick();
            }}
            // onBlur={ ( e ) => {
            //     // ocrItem.text = e.target.innerText;
            //     props.onBlur();
            // }}
            suppressContentEditableWarning
        >
            { canFrost && (
                // Clip frost/tint to the box only — do not clip furigana that extends outside.
                <div className="ocr-box-frost-clip" style={frostClipStyle}>
                    <div className="ocr-box-frost" style={frostLayerStyle} />
                    <div className="ocr-box-tint" style={tintLayerStyle} />
                </div>
            ) }
            { text.map( ( line, lIdx ) => {

                const isLastLine = ocrItem.text.length - 1 === lIdx;

                let lineFontSize = 0;

                line?.symbols?.forEach( symbol => {
                    const charBoxHeightPx = regionHeightPx * ( symbol.box.dimensions.height / 100 );
                    if ( charBoxHeightPx > lineFontSize )
                        lineFontSize = charBoxHeightPx;
                });

                return (
                    <OcrResultLine
                        contentEditable={contentEditable}
                        box={box}
                        textBlockBoxWidthPx={boxWidthPx}
                        textBlockBoxHeightPx={boxHeightPx}
                        line={line}
                        isLastLine={isLastLine}
                        regionWidthPx={regionWidthPx}
                        regionHeightPx={regionHeightPx}
                        key={lIdx}
                        onBlur={props.onBlur}
                        ocrItemBoxVisuals={ocrItemBoxVisuals}
                        sizeExpansionPx={sizeExpansionPx}
                        includesGeneratedFurigana={includesGeneratedFurigana}
                        fontFamily={props.fontFamily}
                    />
                )
            }) }
        </Box>
    )
}