"""TEST-064 checks deployable v8 models and protected expression imports."""

import hashlib
import json
import struct
import unittest
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'src/main/resources/static/media/campus/yanxiaobei-v8'


class AvatarV8AssetsTest(unittest.TestCase):
    def test_all_runtime_files_match_manifest(self):
        manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['role'], 'runtime-mesh-avatar')
        self.assertEqual(manifest['outfits'], ['overalls', 'hoodie', 'tshirt'])
        for item in manifest['files']:
            with self.subTest(file=item['file']):
                self.assertNotIn('..', Path(item['file']).parts)
                self.assertEqual(hashlib.sha256((ASSETS / item['file']).read_bytes()).hexdigest(), item['sha256'])
                if item['file'].endswith('.json'):
                    self.assertNotIn(b'\r\n', (ASSETS / item['file']).read_bytes())

    def test_each_model_has_square_rgba_portrait_and_complete_expression_layers(self):
        for outfit in ['overalls', 'hoodie', 'tshirt']:
            folder = ASSETS / outfit
            with self.subTest(outfit=outfit):
                data = (folder / 'source.png').read_bytes()
                self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
                self.assertEqual(struct.unpack('>IIBB', data[16:26]), (1254, 1254, 8, 6))
                rig = json.loads((folder / 'rig.json').read_text(encoding='utf-8'))
                self.assertEqual(rig['image'], {'width': 1254, 'height': 1254})
                sprites = json.loads((folder / 'built/sprites/sprites.json').read_text(encoding='utf-8'))['layers']
                self.assertEqual(set(sprites), {'eyes_closed_0', 'eyes_closed_1', 'eyes_half_0', 'eyes_half_1', 'mouth_a', 'mouth_a_half', 'mouth_i', 'mouth_o'})
                for name in sprites:
                    self.assertTrue((folder / f'built/sprites/{name}.png').is_file())
                layers = json.loads((folder / 'built/layers.json').read_text(encoding='utf-8'))['layers']
                for name in layers:
                    self.assertTrue((folder / f'built/{name}.png').is_file())
                self.assertTrue((folder / 'built/base.png').is_file())

    def test_expression_imports_preserve_pixels_outside_face_masks(self):
        for outfit in ['overalls', 'hoodie', 'tshirt']:
            report = json.loads((ASSETS / outfit / 'import-report.json').read_text(encoding='utf-8'))
            with self.subTest(outfit=outfit):
                self.assertEqual(len(report['expressions']), 6)
                for entry in report['expressions']:
                    self.assertEqual(entry['source'], 'imagegen')
                    self.assertEqual(entry['outsideMaskChangedPixels'], 0)
                    self.assertLessEqual(max(map(abs, entry['alignmentShift'])), 8)


if __name__ == '__main__':
    unittest.main()
