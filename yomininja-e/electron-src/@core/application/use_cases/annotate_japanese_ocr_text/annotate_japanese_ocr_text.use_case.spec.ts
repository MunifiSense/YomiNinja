import { AnnotateJapaneseOcrTextUseCase, JapaneseTokenizerAdapter } from "./annotate_japanese_ocr_text.use_case";
import { JapaneseHelper } from "../../../infra/japanese_helper.adapter/japanese_helper.adapter";
import { OcrResultScalable } from "../../../domain/ocr_result_scalable/ocr_result_scalable";
import { Language } from "../../../domain/language/language";
import { JapaneseAnnotationSettings } from "../../../domain/settings_preset/settings_preset_overlay";
import { isHarderThanKnownLevel } from "../../../infra/jlpt/jlpt_vocab_lookup";

class FakeJapaneseTokenizer implements JapaneseTokenizerAdapter {
    constructor(
        private readonly tokenMap: Record< string, Array<{
            surface_form: string;
            reading?: string;
            basic_form?: string;
        }> >
    ) {}

    async init(): Promise< void > {}

    tokenize( text: string ) {
        return this.tokenMap[ text ] || [{ surface_form: text }];
    }
}

describe( 'AnnotateJapaneseOcrTextUseCase', () => {

    const japaneseHelper = new JapaneseHelper();

    const annotationOptions: JapaneseAnnotationSettings = {
        furigana_enabled: true,
        jlpt_color_coding_enabled: true,
        known_jlpt_level: 'N4',
        dim_known_tokens: true,
        palette: {
            N5: '#4caf50',
            N4: '#2196f3',
            N3: '#9c27b0',
            N2: '#ff9800',
            N1: '#f44336',
            unknown: '#9e9e9e',
        },
    };

    const tokenizer = new FakeJapaneseTokenizer({
        '今日は学校に行く': [
            { surface_form: '今日', reading: 'キョウ', basic_form: '今日' },
            { surface_form: 'は', reading: 'ハ', basic_form: 'は' },
            { surface_form: '学校', reading: 'ガッコウ', basic_form: '学校' },
            { surface_form: 'に', reading: 'ニ', basic_form: 'に' },
            { surface_form: '行く', reading: 'イク', basic_form: '行く' },
        ],
        'こんにちは': [
            { surface_form: 'こんにちは', reading: 'コンニチハ', basic_form: 'こんにちは' },
        ],
        '食べる': [
            { surface_form: '食べる', reading: 'タベル', basic_form: '食べる' },
        ],
        'hello': [
            { surface_form: 'hello' },
        ],
    });

    const useCase = new AnnotateJapaneseOcrTextUseCase( tokenizer, japaneseHelper );

    it( 'annotates mixed Japanese text with readings and JLPT levels', () => {
        const segments = useCase.annotateLine( '今日は学校に行く' );

        expect( segments.length ).toBe( 5 );
        expect( segments.some( s => s.furigana?.length ) ).toBe( true );
        expect( segments.every( s => Boolean( s.jlpt_level ) ) ).toBe( true );

        const kanaOnly = segments.filter( s => !japaneseHelper.hasKanji( s.surface ) );
        expect( kanaOnly.every( s => !s.furigana?.length ) ).toBe( true );

        const school = segments.find( s => s.surface === '学校' );
        expect( school?.reading ).toBe( 'がっこう' );
        expect( school?.jlpt_level ).toBe( 'N5' );
    });

    it( 'handles kana-only lines without furigana', () => {
        const segments = useCase.annotateLine( 'こんにちは' );
        expect( segments.length ).toBe( 1 );
        expect( segments[0].furigana ).toBeUndefined();
    });

    it( 'attaches segments to OCR result lines and caches by text', async () => {
        const language = Language.create({ name: 'Japanese', two_letter_code: 'ja', bcp47_tag: 'ja-JP' });
        const ocrResult = OcrResultScalable.create({
            id: 'test',
            language,
            ocr_regions: [{
                id: 'region-1',
                results: [{
                    id: 'item-1',
                    text: [{ content: '食べる' }],
                    box: {
                        position: { top: 0, left: 0 },
                        dimensions: { width: 10, height: 10 },
                        isVertical: false,
                    },
                    recognition_score: 1,
                    classification_score: 1,
                    classification_label: 0,
                }],
                position: { top: 0, left: 0 },
                size: { width: 100, height: 100 },
            }],
        });

        await useCase.execute({ ocrResult, options: annotationOptions });

        const line = ocrResult.ocr_regions[0].results[0].text[0];
        expect( line.segments?.length ).toBe( 1 );
        expect( line.segments?.[0].surface ).toBe( '食べる' );
        expect( line.segments?.[0].furigana?.length ).toBeGreaterThan( 0 );
        expect( line.segments?.[0].jlpt_level ).toBe( 'N5' );

        const firstSegments = line.segments;
        await useCase.execute({ ocrResult, options: annotationOptions });
        expect( ocrResult.ocr_regions[0].results[0].text[0].segments ).toBe( firstSegments );
    });

    it( 'skips non-Japanese results', async () => {
        useCase.clearCache();
        const language = Language.create({ name: 'English', two_letter_code: 'en', bcp47_tag: 'en-US' });
        const ocrResult = OcrResultScalable.create({
            id: 'test-en',
            language,
            ocr_regions: [{
                id: 'region-1',
                results: [{
                    id: 'item-1',
                    text: [{ content: 'hello' }],
                    box: {
                        position: { top: 0, left: 0 },
                        dimensions: { width: 10, height: 10 },
                        isVertical: false,
                    },
                    recognition_score: 1,
                    classification_score: 1,
                    classification_label: 0,
                }],
                position: { top: 0, left: 0 },
                size: { width: 100, height: 100 },
            }],
        });

        await useCase.execute({ ocrResult, options: annotationOptions });
        expect( ocrResult.ocr_regions[0].results[0].text[0].segments ).toBeUndefined();
    });

    it( 'supports known-level furigana filtering helpers', () => {
        const segments = useCase.annotateLine( '食べる' );
        const token = segments.find( s => s.furigana?.length );
        expect( token ).toBeTruthy();
        if ( !token ) return;

        expect( isHarderThanKnownLevel( token.jlpt_level, 'N4' ) ).toBe( false );
        expect( isHarderThanKnownLevel( token.jlpt_level, 'off' ) ).toBe( true );
    });
});
