import numpy as np
import cv2
import torch
from typing import List, Optional

from comic_text_detector.inference import TextDetector

def resolve_torch_device(device: Optional[str] = None) -> str:
    if device:
        return device
    if torch.cuda.is_available():
        return 'cuda'
    if torch.backends.mps.is_available():
        return 'mps'
    return 'cpu'

class TextLine:
    coordinates = []
    def __init__(self, coordinates = []) -> None:
        self.coordinates = coordinates

class TextBlock:
    is_vertical: bool = False
    coordinates: List
    lines: List[TextLine]

    def __init__(
        self,
        is_vertical = False,
        coordinates = [],
        lines: List[TextLine] = []
    ):

        self.is_vertical = is_vertical
        self.coordinates = coordinates
        self.lines = lines

class ComicTextDetector:

    text_detector: TextDetector = None

    def __init__(
        self,
        model_path = '../models/comic_text_detector/comictextdetector.pt',
        device: Optional[str] = None
    ):
        self.device = resolve_torch_device(device)
        self.text_detector = TextDetector(
            model_path,
            input_size=1024,
            device=self.device,
            act='leaky'
        )


    def detect(self, image: np.ndarray) -> List[TextBlock]:

        result: List[TextBlock] = []

        mask, mask_refined, blk_list = self.text_detector(image, refine_mode=1, keep_undetected_mask=True)


        for blk_idx, blk in enumerate(blk_list):

            is_vertical = blk.vertical

            block_rect = [ int(x.item()) for x in blk.bounding_rect() ]

            block_coordinates = self.rect_to_box_points( block_rect, blk.angle )

            text_block = TextBlock( is_vertical, block_coordinates, [] ) # Not adding an empty list of lines can cause a reference issue

            lines = blk.lines_array()

            # print(f'Block {blk_idx+1} | Number of lines: {len(lines)}')

            for line in lines:
                line = TextLine(line.tolist())
                text_block.lines.append(line)

            result.append(text_block)

        # self.display_result( image, result )

        return result

    def rect_to_box_points(self, rect, angle):
        x, y, w, h = rect

        center_x = x + w / 2
        center_y = y + h / 2

        rot_rect = ((center_x, center_y), (w, h), angle)
        
        points = np.asarray(cv2.boxPoints(rot_rect), dtype=np.int32)

        return [
            points[1],
            points[2],
            points[3],
            points[0]
        ]
    
    def display_result(self, image, text_blocks: List[TextBlock]):

        for block in text_blocks:

            block_coordinates = [ (int(x), int(y)) for x, y in block.coordinates ]

            # Convert list of points to numpy array
            pts = np.array(block_coordinates, np.int32)
            pts = pts.reshape((-1, 1, 2))
            
            # Draw the Block on the image
            cv2.polylines(image, [pts], isClosed=True, color=(255, 255, 0), thickness=4)

            for line in block.lines:

                line_coordinates = [ (int(x), int(y)) for x, y in line.coordinates ]

                # Convert list of points to numpy array
                pts = np.array(line_coordinates, np.int32)
                pts = pts.reshape((-1, 1, 2))
                
                # Draw the Line on the image
                cv2.polylines(image, [pts], isClosed=True, color=(0, 255, 0), thickness=2)
        
        cv2.imshow("Image", image)
        cv2.waitKey(0)
        cv2.destroyAllWindows()