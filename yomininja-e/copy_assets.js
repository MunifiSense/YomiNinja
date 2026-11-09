const fs = require('fs');
const path = require('path');

// Proto files
fs.cpSync(
    '../ocr_services/protos',
    './main/grpc/protos',
    { recursive: true }
);

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