import { isHarderThanKnownLevel, lookupJlptLevel } from "./jlpt_vocab_lookup";

describe( 'JLPT vocab lookup', () => {

    it( 'finds common N5 terms by surface + reading', () => {
        expect( lookupJlptLevel({
            surface: '食べる',
            reading: 'たべる',
        }) ).toBe( 'N5' );
    });

    it( 'falls back to lemma when surface is conjugated', () => {
        expect( lookupJlptLevel({
            surface: '食べます',
            basicForm: '食べる',
        }) ).toBe( 'N5' );
    });

    it( 'falls back to surface-only lookup', () => {
        expect( lookupJlptLevel({
            surface: '青い',
        }) ).toBe( 'N5' );
    });

    it( 'returns unknown for missing terms', () => {
        expect( lookupJlptLevel({
            surface: '超架空語彙',
            reading: 'ちょうかくうごい',
        }) ).toBe( 'unknown' );
    });

    it( 'compares known JLPT levels for furigana filtering', () => {
        expect( isHarderThanKnownLevel( 'N5', 'N4' ) ).toBe( false );
        expect( isHarderThanKnownLevel( 'N4', 'N4' ) ).toBe( false );
        expect( isHarderThanKnownLevel( 'N3', 'N4' ) ).toBe( true );
        expect( isHarderThanKnownLevel( 'unknown', 'N4' ) ).toBe( true );
        expect( isHarderThanKnownLevel( 'N1', 'off' ) ).toBe( true );
    });
});
