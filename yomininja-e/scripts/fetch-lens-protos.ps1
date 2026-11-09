# Download Chromium Lens overlay protos and generate protobufjs stubs for GoogleLensOcrGrpcAdapter.
# These paths are gitignored; run after clone (or when Chromium protos change).
$ErrorActionPreference = 'Stop'

# This script lives in yomininja-e/scripts/
$yn = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$protoDir = Join-Path $yn 'grpc\lens_proto'
$outDir = Join-Path $yn 'grpc\rpc\lens'

New-Item -ItemType Directory -Force -Path $protoDir | Out-Null
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$base = 'https://raw.githubusercontent.com/chromium/chromium/main/third_party/lens_server_proto'
# Core overlay set + deps used by LensOverlayServerRequest/Response. Skip AIM/search extras.
$files = @(
    'LICENSE',
    'lens_overlay_client_context.proto',
    'lens_overlay_client_logs.proto',
    'lens_overlay_client_platform.proto',
    'lens_overlay_cluster_info.proto',
    'lens_overlay_content_metadata.proto',
    'lens_overlay_contextual_inputs.proto',
    'lens_overlay_deep_gleam_data.proto',
    'lens_overlay_document.proto',
    'lens_overlay_filters.proto',
    'lens_overlay_geometry.proto',
    'lens_overlay_image_crop.proto',
    'lens_overlay_image_data.proto',
    'lens_overlay_interaction_request_metadata.proto',
    'lens_overlay_knowledge_intent_query.proto',
    'lens_overlay_knowledge_query.proto',
    'lens_overlay_math_solver_query.proto',
    'lens_overlay_message_set.proto',
    'lens_overlay_overlay_object.proto',
    'lens_overlay_payload.proto',
    'lens_overlay_phase_latencies_metadata.proto',
    'lens_overlay_platform.proto',
    'lens_overlay_polygon.proto',
    'lens_overlay_request_id.proto',
    'lens_overlay_request_type.proto',
    'lens_overlay_routing_info.proto',
    'lens_overlay_selection_type.proto',
    'lens_overlay_server.proto',
    'lens_overlay_service_deps.proto',
    'lens_overlay_stickiness_signals.proto',
    'lens_overlay_surface.proto',
    'lens_overlay_text.proto',
    'lens_overlay_text_query.proto',
    'lens_overlay_translate_stickiness_signals.proto',
    'lens_overlay_video_context_input_params.proto',
    'lens_overlay_video_params.proto',
    'lens_overlay_visual_input_type.proto',
    'lens_overlay_visual_search_interaction_data.proto',
    'lens_overlay_visual_search_interaction_log_data.proto',
    'lens_overlay_lens_file.proto'
)

Write-Host "Downloading Chromium lens_server_proto ($($files.Count) files)..."
$failed = @()
foreach ($f in $files) {
    $out = Join-Path $protoDir $f
    try {
        Invoke-WebRequest -Uri "$base/$f" -OutFile $out -UseBasicParsing -TimeoutSec 60
        if ((Get-Item $out).Length -lt 10) { throw 'empty download' }
    } catch {
        $failed += $f
        Remove-Item $out -Force -ErrorAction SilentlyContinue
    }
}
if ($failed.Count) {
    Write-Warning "Failed downloads: $($failed -join ', ')"
}

Write-Host "Converting Protobuf Editions -> proto3 for protobufjs..."
Get-ChildItem (Join-Path $protoDir '*.proto') | ForEach-Object {
    $lines = Get-Content $_.FullName
    $changed = $false
    $outLines = foreach ($line in $lines) {
        if ($line -match '^\s*edition\s*=') {
            $changed = $true
            'syntax = "proto3";'
        } elseif ($line -match '^\s*option\s+features\.' -or $line -match '^\s*features\.') {
            $changed = $true
        } else {
            $line
        }
    }
    if ($changed) {
        Set-Content -Path $_.FullName -Value $outLines
    }
}

Push-Location $yn
try {
    Write-Host "Generating lens_pb.js / lens_pb.d.ts..."
    npm run grpc-lens-types
    if ($LASTEXITCODE -ne 0) { throw "grpc-lens-types failed with exit $LASTEXITCODE" }

    # pbts sometimes emits SelectionMetadata.object (invalid) instead of .Object
    $dts = Join-Path $outDir 'lens_pb.d.ts'
    if (Test-Path $dts) {
        $c = Get-Content -Raw $dts
        $fixed = $c.Replace('SelectionMetadata.object', 'SelectionMetadata.Object')
        if ($fixed -ne $c) {
            Set-Content -Path $dts -Value $fixed -NoNewline
            Write-Host "Patched lens_pb.d.ts Object casing."
        }
    }

    # Runtime resolve path used by compiled adapter under main/
    $runtimeDir = Join-Path $yn 'main\grpc\rpc\lens'
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    Copy-Item (Join-Path $outDir 'lens_pb.js') (Join-Path $runtimeDir 'lens_pb.js') -Force
    if (Test-Path (Join-Path $outDir 'lens_pb.d.ts')) {
        Copy-Item (Join-Path $outDir 'lens_pb.d.ts') (Join-Path $runtimeDir 'lens_pb.d.ts') -Force
    }
    Write-Host "Lens protos ready."
} finally {
    Pop-Location
}
