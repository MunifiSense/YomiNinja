import cv2
import os
import numpy as np
from typing import List, Tuple
from PIL import Image
from importlib.metadata import PackageNotFoundError, version as pkg_version
from ocr_service_pb2 import Result, Box, Vertex, TextLine, RecognizeDefaultResponse, HardwareAccelerationOption


def _ensure_cuda_dll_path() -> None:
    """
    onnxruntime-gpu needs CUDA/cuDNN DLLs on PATH. YomiNinja's env usually
    gets those via Torch's bundled CUDA libs (no system CUDA toolkit required).
    """
    try:
        import torch
        torch_lib = os.path.join( os.path.dirname( torch.__file__ ), 'lib' )
        if not os.path.isdir( torch_lib ):
            return

        path = os.environ.get( 'PATH', '' )
        if torch_lib not in path.split( os.pathsep ):
            os.environ['PATH'] = torch_lib + os.pathsep + path

        if hasattr( os, 'add_dll_directory' ):
            os.add_dll_directory( torch_lib )
    except Exception:
        pass


def parse_meiki_options( language_code: str ) -> Tuple[ float, float ]:
    """Parse det/rec thresholds from language_code: 'ja-JP|det=0.5|rec=0.1'."""
    det_threshold = 0.5
    rec_threshold = 0.1

    if not language_code:
        return det_threshold, rec_threshold

    for part in language_code.split( '|' )[ 1: ]:
        if part.startswith( 'det=' ):
            try:
                det_threshold = float( part[ 4: ] )
            except ValueError:
                pass
        elif part.startswith( 'rec=' ):
            try:
                rec_threshold = float( part[ 4: ] )
            except ValueError:
                pass

    return det_threshold, rec_threshold


class MeikiOcrService:

    meiki = None

    def init( self ):
        _ensure_cuda_dll_path()
        from meikiocr import MeikiOCR
        try:
            self.meiki = MeikiOCR()
        except Exception as error:
            # CUDA may be listed as available but fail at session creation.
            print( f'MeikiOCR init failed ({error}); falling back to CPU' )
            self.meiki = MeikiOCR( provider='CPUExecutionProvider' )

    def recognize(
        self,
        image: Image.Image,
        request_id: str,
        language_code: str = 'ja-JP',
    ) -> RecognizeDefaultResponse:

        if not self.meiki:
            self.init()

        det_threshold, rec_threshold = parse_meiki_options( language_code )

        # Meiki expects OpenCV BGR
        rgb = np.array( image.convert( 'RGB' ) )
        bgr = cv2.cvtColor( rgb, cv2.COLOR_RGB2BGR )

        # Use the full pipeline. run_recognition() alone returns crop-local char
        # boxes; using those as image coords places overlays at the top-left.
        ocr_results = self.meiki.run_ocr( bgr, det_threshold, rec_threshold )
        results: List[ Result ] = []

        for idx, rec in enumerate( ocr_results ):
            text = ( rec.get( 'text' ) or '' ).strip()
            if not text:
                continue

            chars = rec.get( 'chars' ) or []
            if not chars:
                continue

            xs1, ys1, xs2, ys2 = [], [], [], []
            for char_info in chars:
                cx1, cy1, cx2, cy2 = char_info[ 'bbox' ]
                xs1.append( cx1 )
                ys1.append( cy1 )
                xs2.append( cx2 )
                ys2.append( cy2 )

            bbox = [ min( xs1 ), min( ys1 ), max( xs2 ), max( ys2 ) ]
            box = self.xyxy_to_box( bbox )
            is_vertical = bool( rec.get( 'is_vertical' ) )

            line = TextLine( box=box, content=text )
            results.append(
                Result(
                    box=box,
                    text_lines=[ line ],
                    is_vertical=is_vertical,
                    id=str( idx ),
                    recognition_state='RECOGNIZED',
                )
            )

        return RecognizeDefaultResponse(
            context_resolution={
                'width': image.width,
                'height': image.height,
            },
            id=request_id,
            results=results,
        )

    def xyxy_to_box( self, bbox: List[ int ] ) -> Box:
        x1, y1, x2, y2 = [ int( v ) for v in bbox ]
        return Box(
            top_left=Vertex( x=x1, y=y1 ),
            top_right=Vertex( x=x2, y=y1 ),
            bottom_right=Vertex( x=x2, y=y2 ),
            bottom_left=Vertex( x=x1, y=y2 ),
        )

    def get_supported_languages( self ) -> List[ str ]:
        return [ 'ja-JP' ]

    def _is_package_installed( self, package_name: str ) -> bool:
        try:
            pkg_version( package_name )
            return True
        except PackageNotFoundError:
            return False

    def get_hardware_acceleration_options( self ) -> List[ HardwareAccelerationOption ]:
        """
        MeikiOCR uses ONNX Runtime.
        CPU: onnxruntime
        CUDA: onnxruntime-gpu (mutually exclusive packages)
        """
        gpu_installed = self._is_package_installed( 'onnxruntime-gpu' )

        # Fall back to provider probe when package metadata is ambiguous
        if not gpu_installed:
            try:
                _ensure_cuda_dll_path()
                import onnxruntime as ort
                gpu_installed = 'CUDAExecutionProvider' in ort.get_available_providers()
            except Exception:
                gpu_installed = False

        # Pin GPU build to a CUDA 12.x wheel. Newer builds (e.g. 1.31) need CUDA 13
        # (cublasLt64_13.dll), which breaks on machines that only have CUDA 12 / Torch cu128.
        return [
            HardwareAccelerationOption(
                backend='ONNX Runtime',
                compute_platform='CPU',
                compute_platform_version='',
                installed=not gpu_installed,
                install_command='pip install onnxruntime',
            ),
            HardwareAccelerationOption(
                backend='ONNX Runtime',
                compute_platform='CUDA',
                compute_platform_version='12',
                installed=gpu_installed,
                install_command='pip install onnxruntime-gpu==1.22.0',
            ),
        ]
