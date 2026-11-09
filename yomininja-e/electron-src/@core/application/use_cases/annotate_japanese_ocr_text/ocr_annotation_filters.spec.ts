import { isHarderThanKnownLevel, JLPT_LEVEL_RANK } from "../../../infra/jlpt/jlpt_vocab_lookup";
import { JlptLevel } from "../../../domain/ocr_result_scalable/ocr_result_scalable";

describe( 'OCR annotation furigana / color filters', () => {

    it( 'assigns rising difficulty ranks from N5 to unknown', () => {
        expect( JLPT_LEVEL_RANK.N5 ).toBeLessThan( JLPT_LEVEL_RANK.N4 );
        expect( JLPT_LEVEL_RANK.N1 ).toBeLessThan( JLPT_LEVEL_RANK.unknown );
    });

    it( 'marks tokens for furigana when harder than known level', () => {
        const cases: Array<{ level: JlptLevel; known: 'off' | JlptLevel; expected: boolean }> = [
            { level: 'N5', known: 'N5', expected: false },
            { level: 'N4', known: 'N5', expected: true },
            { level: 'N1', known: 'N2', expected: true },
            { level: 'unknown', known: 'N1', expected: true },
            { level: 'N1', known: 'off', expected: true },
        ];

        for ( const testCase of cases ) {
            expect(
                isHarderThanKnownLevel( testCase.level, testCase.known )
            ).toBe( testCase.expected );
        }
    });

    it( 'supports dimming tokens at or below known level', () => {
        const known = 'N3';
        const shouldDim = ( level: JlptLevel ) => {
            if ( level === 'unknown' ) return false;
            return JLPT_LEVEL_RANK[ level ] <= JLPT_LEVEL_RANK[ known ];
        };

        expect( shouldDim( 'N5' ) ).toBe( true );
        expect( shouldDim( 'N3' ) ).toBe( true );
        expect( shouldDim( 'N2' ) ).toBe( false );
        expect( shouldDim( 'unknown' ) ).toBe( false );
    });
});
