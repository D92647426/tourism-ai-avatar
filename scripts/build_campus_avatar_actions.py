"""REQ-065 builds pose-specific mesh bindings from immutable ImageGen artwork."""

import argparse
import copy
import hashlib
import importlib
import json
import math
import shutil
import sys
from pathlib import Path

from PIL import Image

from build_campus_avatar_v8 import REPO, make_rig, write_json

ASSETS = REPO / 'src/main/resources/static/media/campus/yanxiaobei-actions'
OUTFITS = ('overalls', 'hoodie', 'tshirt')
POSES = ('study', 'dining', 'thinking', 'hungry')
# Each tuple is eye centre x/y, horizontal/vertical scale and rotation in degrees.
# Coordinates follow the approved three-quarter artwork, independently per outfit.
SIDE = {
    ('overalls', 'study'): ([[482, 677, .70, .90, -25], [638, 672, .92, .98, -10]], [569, 736]),
    ('hoodie', 'study'): ([[498, 677, .76, .90, -22], [651, 674, .94, .98, -8]], [580, 739]),
    ('tshirt', 'study'): ([[486, 678, .70, .90, -25], [636, 666, 1, .98, -8]], [563, 734]),
    ('overalls', 'dining'): ([[633, 666, 1.02, .95, 10], [785, 643, .65, .92, 20]], [722, 709]),
    ('hoodie', 'dining'): ([[510, 674, .70, .92, -23], [651, 654, 1, .97, -8]], [589, 725]),
    ('tshirt', 'dining'): ([[643, 654, 1.08, .98, 5], [784, 654, .56, .98, 20]], [720, 723]),
}


def transform_polygon(points: list, source: tuple, target: list) -> list:
    """Map an eye contour into its pose-specific orientation for REQ-065."""
    cx, cy, sx, sy, degrees = target
    angle = math.radians(degrees)
    transformed = []
    for x, y in points:
        dx, dy = (x - source[0]) * sx, (y - source[1]) * sy
        transformed.append([round(cx + dx * math.cos(angle) - dy * math.sin(angle), 2),
                            round(cy + dx * math.sin(angle) + dy * math.cos(angle), 2)])
    return transformed


def pose_rig(pipeline, outfit: str, pose: str) -> dict:
    """Define face anchors, stable furniture and arm/wing deformation regions."""
    rig = make_rig(pipeline)
    eyes, mouth = SIDE.get((outfit, pose), ([[536, 636, 1, 1, 0], [724, 636, 1, 1, 0]], [629, 705]))
    original_eyes = copy.deepcopy(rig['eyes'])
    for index, (origin, target) in enumerate(zip([(536, 636), (724, 636)], eyes)):
        rig['eyes'][index] = {name: transform_polygon(original_eyes[index][name], origin, target)
                              for name in ('opening', 'roi')}
        rig['face']['eyeA' if index == 0 else 'eyeB'].update(cx=target[0], cy=target[1], rx=57 * target[2], ry=44 * target[3])
    mx, my = mouth
    rig['mouth'].update(cx=mx, cy=my, halfLen=26, bow=4,
                        angle=math.atan2(eyes[1][1] - eyes[0][1], eyes[1][0] - eyes[0][0]))
    rig['mouth']['area'].update(cx=mx, cy=my + 4)
    rig['face']['mouth'].update(cx=mx, cy=my + 4)
    rig['face']['nose'].update(cx=mx, cy=my - 33)
    rig['face']['jaw'].update(cx=mx, cy=my + 43, band=[my + 23, my + 68])
    midx, midy = (eyes[0][0] + eyes[1][0]) / 2, (eyes[0][1] + eyes[1][1]) / 2
    rig['face']['brow'].update(cx=midx, cy=midy - 70, band=[midy - 88, midy - 52])
    rig['cheeks'] = [[eyes[0][0] - 20, my], [eyes[1][0] + 20, my]]
    rig['head'].update(pivotY=my + 67, maxRoll=.045, shiftX=18,
                       weightBand=[my + 40, my + 90], turnBand=[my + 20, my + 110])
    rig['body']['maxRoll'] = .035
    rig['view']['gazeCenter'] = [midx, midy]
    rig['mesh']['fine'].update(x0=380, x1=870, y0=550, y1=820)
    if pose == 'study':
        rig['body'].update(pivotY=960, rollBand=[780, 960], breathBand=[780, 960])
        rig['appendages'] = [{
            'name': 'keyboard-hand', 'kind': 'ear', 'outline': [[405, 912], [509, 906], [527, 980], [411, 985]],
            'pivot': [493, 903], 'tip': [444, 964], 'amplitude': .035, 'period': .75, 'duration': .55, 'feather': 12,
        }]
    else:
        rig['appendages'] = [{
            'name': 'left-rear-wing', 'kind': 'ear', 'outline': [[353, 790], [468, 789], [442, 1088], [325, 980]],
            'pivot': [433, 795], 'tip': [376, 1050], 'amplitude': .055, 'period': 3.8, 'feather': 16,
        }, {
            'name': 'right-rear-wing', 'kind': 'ear', 'outline': [[780, 790], [899, 790], [922, 980], [810, 1090]],
            'pivot': [815, 795], 'tip': [870, 1050], 'amplitude': -.055, 'period': 3.8, 'phase': .2, 'feather': 16,
        }]
    return rig


def build(ruic: Path) -> None:
    """Build all twelve poses locally. Raises on bad PNGs or an invalid binding.

    Uses RuiC-2D's analytic eyelids and mouth for the independent side views.
    Original artwork stays byte-identical. See docs/avatar_actions.md.
    """
    sys.path.insert(0, str(ruic / 'tools'))
    pipeline = importlib.import_module('pipeline')
    pipeline.PROJECTS = REPO / 'target/avatar-actions-build'
    pipeline.PROJECTS.mkdir(parents=True, exist_ok=True)
    files = []
    for outfit in OUTFITS:
        for pose in POSES:
            destination = ASSETS / outfit / pose
            with Image.open(destination / 'source.png') as image:
                image.verify()
            with Image.open(destination / 'source.png') as image:
                if image.size != (1254, 1254) or image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] != 0:
                    raise ValueError(f'Invalid transparent portrait for {outfit}/{pose}')
            project = pipeline.PROJECTS / f'{outfit}-{pose}'
            project.mkdir(exist_ok=True)
            shutil.copy2(destination / 'source.png', project / 'source.png')
            write_json(project / 'rig.json', pose_rig(pipeline, outfit, pose))
            write_json(project / 'workspace.json', {'name': f'燕小北 {outfit} {pose}', 'regions': []})
            write_json(project / 'built/sprites/sprites.json', {'layers': {}})
            pipeline.build(project.name)
            shutil.copy2(project / 'rig.json', destination / 'rig.json')
            shutil.copytree(project / 'built', destination / 'built', dirs_exist_ok=True)
            for metadata in destination.rglob('*.json'):
                metadata.write_bytes(metadata.read_bytes().replace(b'\r\n', b'\n'))
            for file in sorted(destination.rglob('*')):
                if file.is_file():
                    files.append({'file': file.relative_to(ASSETS).as_posix(), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
            print(f'Bound {outfit}/{pose}', flush=True)
    write_json(ASSETS / 'manifest.json', {'requirement': 'REQ-065', 'role': 'contextual-mesh-poses',
                                         'outfits': list(OUTFITS), 'poses': list(POSES), 'files': files})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ruic', type=Path, required=True, help='Existing RuiC-2D checkout')
    build(parser.parse_args().ruic.resolve())
