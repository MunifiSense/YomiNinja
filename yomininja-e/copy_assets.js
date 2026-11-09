const fs = require('fs');
const path = require('path');

// Proto files
fs.cpSync(
    '../ocr_services/protos',
    './main/grpc/protos',
    { recursive: true }
);

// JLPT vocab map used by OCR furigana / color coding
const jlptSrc = path.join(__dirname, 'electron-src/@core/infra/jlpt/jlpt_vocab.json');
const jlptDstDir = path.join(__dirname, 'main/electron-src/@core/infra/jlpt');
if (fs.existsSync(jlptSrc)) {
    fs.mkdirSync(jlptDstDir, { recursive: true });
    fs.copyFileSync(jlptSrc, path.join(jlptDstDir, 'jlpt_vocab.json'));
    const jlptLicense = path.join(__dirname, 'electron-src/@core/infra/jlpt/LICENSE.txt');
    if (fs.existsSync(jlptLicense))
        fs.copyFileSync(jlptLicense, path.join(jlptDstDir, 'LICENSE.txt'));
}

// Google Lens protobuf stubs (gitignored sources; generated locally via npm run grpc-lens-types)
const lensPbJs = path.join(__dirname, 'grpc/rpc/lens/lens_pb.js');
const lensPbOutDir = path.join(__dirname, 'main/grpc/rpc/lens');
if (fs.existsSync(lensPbJs)) {
    fs.mkdirSync(lensPbOutDir, { recursive: true });
    fs.copyFileSync(lensPbJs, path.join(lensPbOutDir, 'lens_pb.js'));
    const lensPbDts = path.join(__dirname, 'grpc/rpc/lens/lens_pb.d.ts');
    if (fs.existsSync(lensPbDts))
        fs.copyFileSync(lensPbDts, path.join(lensPbOutDir, 'lens_pb.d.ts'));
}