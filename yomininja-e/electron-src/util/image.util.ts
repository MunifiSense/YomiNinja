import sharp, { AvailableFormatInfo, FormatEnum } from "sharp";

export async function bufferToDataURL(
    input: {
        image: Buffer,
        format?: keyof FormatEnum | string,
        quality?: number
    }
): Promise<string> {
    const { image, quality } = input;

    let sharpImage = sharp(image);
    const metadata = await sharpImage.metadata();

    if ( !metadata.format ) return '';

    // Prefer the buffer's actual codec so JPEG captures are not mislabeled as PNG.
    const detected = metadata.format;
    const format: keyof FormatEnum | string = input.format || detected || 'png';

    // Fast path: bytes already match the desired format — only wrap as a data URL.
    if ( !input.format || input.format === detected ) {
        return 'data:image/' + detected + ';base64,' + image.toString( 'base64' );
    }

    const conversionOptions = format !== 'png' ?
        { quality } :
        undefined;

    const convertedImage = await sharpImage.toFormat( format as keyof FormatEnum, conversionOptions )
        .toBuffer()

    return 'data:image/' + format + ';base64,' + convertedImage.toString('base64');
}