import { createHash } from "crypto";
import { JapaneseHelperAdapter } from "../../adapters/japanese_helper.adapter";
import { OcrResultScalable, OcrTextLineSegment } from "../../../domain/ocr_result_scalable/ocr_result_scalable";
import { JapaneseAnnotationSettings } from "../../../domain/settings_preset/settings_preset_overlay";
import { lookupJlptLevel } from "../../../infra/jlpt/jlpt_vocab_lookup";

export type JapaneseTokenFeatures = {
    surface_form: string;
    reading?: string;
    basic_form?: string;
};

export type JapaneseTokenizerAdapter = {
    init(): Promise< void >;
    tokenize( text: string ): JapaneseTokenFeatures[];
};

export type AnnotateJapaneseOcrTextInput = {
    ocrResult: OcrResultScalable;
    options: JapaneseAnnotationSettings;
};

const MAX_CACHE_ENTRIES = 500;

export class AnnotateJapaneseOcrTextUseCase {

    private cache = new Map< string, OcrTextLineSegment[] >();

    constructor(
        private termExtractor: JapaneseTokenizerAdapter,
        private japaneseHelper: JapaneseHelperAdapter,
    ) {}

    async execute( input: AnnotateJapaneseOcrTextInput ): Promise< void > {
        const { ocrResult, options } = input;

        if ( !options?.furigana_enabled && !options?.jlpt_color_coding_enabled )
            return;

        const languageTag = ocrResult.language?.bcp47_tag || '';
        if ( !languageTag.toLowerCase().startsWith( 'ja' ) )
            return;

        await this.termExtractor.init();

        for ( const region of ocrResult.ocr_regions || [] ) {
            for ( const item of region.results || [] ) {
                for ( const line of item.text || [] ) {
                    if ( !line?.content )
                        continue;

                    const cacheKey = this.hash( line.content );
                    const cached = this.cache.get( cacheKey );
                    if ( cached ) {
                        line.segments = cached;
                        continue;
                    }

                    const segments = this.annotateLine( line.content );
                    this.putCache( cacheKey, segments );
                    line.segments = segments;
                }
            }
        }
    }

    annotateLine( text: string ): OcrTextLineSegment[] {
        const tokens = this.termExtractor.tokenize( text );

        return tokens.map( token => {
            const surface = token.surface_form || '';
            const basicForm = token.basic_form && token.basic_form !== '*'
                ? token.basic_form
                : undefined;

            let reading: string | undefined;
            if ( token.reading && token.reading !== '*' ) {
                reading = this.japaneseHelper.toHiragana( token.reading );
            }

            let furigana: OcrTextLineSegment[ 'furigana' ];
            if (
                reading &&
                this.japaneseHelper.hasKanji( surface )
            ) {
                const generated = this.japaneseHelper.generateFurigana({
                    term: surface,
                    reading,
                });
                if ( generated.furigana?.length )
                    furigana = generated.furigana;
            }

            const jlpt_level = lookupJlptLevel({
                surface,
                reading,
                basicForm,
            });

            return {
                surface,
                reading,
                basic_form: basicForm,
                furigana,
                jlpt_level,
            };
        });
    }

    clearCache() {
        this.cache.clear();
    }

    private hash( text: string ): string {
        return createHash( 'sha1' ).update( text ).digest( 'hex' );
    }

    private putCache( key: string, segments: OcrTextLineSegment[] ) {
        if ( this.cache.size >= MAX_CACHE_ENTRIES ) {
            const oldest = this.cache.keys().next().value;
            if ( oldest )
                this.cache.delete( oldest );
        }
        this.cache.set( key, segments );
    }
}
