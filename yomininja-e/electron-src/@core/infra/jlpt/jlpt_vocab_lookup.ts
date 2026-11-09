import { JlptLevel } from "../../domain/ocr_result_scalable/ocr_result_scalable";
import jlptVocab from "./jlpt_vocab.json";

type JlptVocabFile = {
    byTermReading: Record<string, string>;
    byTerm: Record<string, string>;
};

const vocab = jlptVocab as JlptVocabFile;

const VALID_LEVELS = new Set<JlptLevel>([ 'N5', 'N4', 'N3', 'N2', 'N1' ]);

function toLevel( value?: string ): JlptLevel {
    if ( value && VALID_LEVELS.has( value as JlptLevel ) )
        return value as JlptLevel;
    return 'unknown';
}

export function lookupJlptLevel( input: {
    surface: string;
    reading?: string;
    basicForm?: string;
}): JlptLevel {
    const { surface, reading, basicForm } = input;

    if ( reading ) {
        const bySurfaceReading = vocab.byTermReading[ `${surface}|${reading}` ];
        if ( bySurfaceReading )
            return toLevel( bySurfaceReading );

        if ( basicForm && basicForm !== '*' && basicForm !== surface ) {
            const byLemmaReading = vocab.byTermReading[ `${basicForm}|${reading}` ];
            if ( byLemmaReading )
                return toLevel( byLemmaReading );
        }
    }

    const bySurface = vocab.byTerm[ surface ];
    if ( bySurface )
        return toLevel( bySurface );

    if ( basicForm && basicForm !== '*' && basicForm !== surface ) {
        const byLemma = vocab.byTerm[ basicForm ];
        if ( byLemma )
            return toLevel( byLemma );
    }

    return 'unknown';
}

export const JLPT_LEVEL_RANK: Record<JlptLevel | 'off', number> = {
    off: 0,
    N5: 1,
    N4: 2,
    N3: 3,
    N2: 4,
    N1: 5,
    unknown: 6,
};

/** True when the token is harder than the user's known level (or unknown). */
export function isHarderThanKnownLevel(
    tokenLevel: JlptLevel,
    knownLevel: JlptLevel | 'off'
): boolean {
    if ( knownLevel === 'off' )
        return true;
    return JLPT_LEVEL_RANK[ tokenLevel ] > JLPT_LEVEL_RANK[ knownLevel ];
}
