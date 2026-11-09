import { CSSProperties, Fragment, ReactNode } from "react";
import {
    JlptLevel,
    OcrTextFuriganaRange,
    OcrTextLineSegment,
} from "../../../electron-src/@core/domain/ocr_result_scalable/ocr_result_scalable";
import {
    JapaneseAnnotationSettings,
    JlptKnownLevel,
} from "../../../electron-src/@core/domain/settings_preset/settings_preset_overlay";

const JLPT_RANK: Record<JlptLevel | 'off', number> = {
    off: 0,
    N5: 1,
    N4: 2,
    N3: 3,
    N2: 4,
    N1: 5,
    unknown: 6,
};

function isHarderThanKnown(
    tokenLevel: JlptLevel,
    knownLevel: JlptKnownLevel | undefined
): boolean {
    if ( !knownLevel || knownLevel === 'off' )
        return true;
    return JLPT_RANK[ tokenLevel ] > JLPT_RANK[ knownLevel ];
}

function isKnownOrEasier(
    tokenLevel: JlptLevel,
    knownLevel: JlptKnownLevel | undefined
): boolean {
    if ( !knownLevel || knownLevel === 'off' )
        return false;
    if ( tokenLevel === 'unknown' )
        return false;
    return JLPT_RANK[ tokenLevel ] <= JLPT_RANK[ knownLevel ];
}

function renderRubySurface(
    surface: string,
    furigana: OcrTextFuriganaRange[] | undefined,
    showFurigana: boolean,
): ReactNode {
    if ( !showFurigana || !furigana?.length )
        return surface;

    const ranges = [ ...furigana ].sort( ( a, b ) => a.startIdx - b.startIdx );
    const parts: ReactNode[] = [];
    let cursor = 0;

    ranges.forEach( ( range, idx ) => {
        if ( cursor < range.startIdx ) {
            parts.push( surface.slice( cursor, range.startIdx ) );
        }

        const base = surface.slice( range.startIdx, range.endIdx + 1 );
        parts.push(
            <ruby key={ `ruby-${idx}-${range.startIdx}` }>
                { base }
                <rt>{ range.text }</rt>
            </ruby>
        );
        cursor = range.endIdx + 1;
    });

    if ( cursor < surface.length )
        parts.push( surface.slice( cursor ) );

    return parts;
}

export function shouldRenderAnnotatedContent(
    segments: OcrTextLineSegment[] | undefined,
    annotation: JapaneseAnnotationSettings | undefined,
): boolean {
    if ( !segments?.length || !annotation )
        return false;
    return Boolean(
        annotation.furigana_enabled ||
        annotation.jlpt_color_coding_enabled
    );
}

export default function OcrAnnotatedLineContent( props: {
    segments: OcrTextLineSegment[];
    annotation: JapaneseAnnotationSettings;
}): JSX.Element {
    const { segments, annotation } = props;

    return (
        <>
            { segments.map( ( segment, idx ) => {
                if ( segment.surface === '\u200B' )
                    return <wbr key={ `wbr-${idx}` } />;

                const showFurigana = Boolean(
                    annotation.furigana_enabled &&
                    segment.furigana?.length &&
                    isHarderThanKnown( segment.jlpt_level, annotation.known_jlpt_level )
                );

                const style: CSSProperties = {};

                if ( annotation.jlpt_color_coding_enabled ) {
                    style.color = `var(--jlpt-${segment.jlpt_level.toLowerCase()})`;
                }

                if (
                    annotation.dim_known_tokens &&
                    isKnownOrEasier( segment.jlpt_level, annotation.known_jlpt_level )
                ) {
                    style.opacity = 0.45;
                }

                return (
                    <Fragment key={ `seg-${idx}-${segment.surface}` }>
                        <span
                            className={ `ocr-token jlpt-${segment.jlpt_level.toLowerCase()}` }
                            style={ style }
                            data-jlpt={ segment.jlpt_level }
                        >
                            { renderRubySurface( segment.surface, segment.furigana, showFurigana ) }
                        </span>
                    </Fragment>
                );
            }) }
        </>
    );
}
