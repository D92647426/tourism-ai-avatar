"""TEST-065 validates the twelve immutable contextual action models."""
import hashlib
import json
import struct
import unittest
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'src/main/resources/static/media/campus/yanxiaobei-actions'


class AvatarActionAssetsTest(unittest.TestCase):
    def test_deployable_files_and_canonical_metadata_match_manifest(self):
        manifest = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['outfits'], ['overalls', 'hoodie', 'tshirt'])
        self.assertEqual(manifest['poses'], ['study', 'dining', 'thinking', 'hungry'])
        self.assertEqual(len(manifest['files']), 168)
        for entry in manifest['files']:
            data = (ASSETS / entry['file']).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(), entry['sha256'], entry['file'])
            if entry['file'].endswith('.json'):
                self.assertNotIn(b'\r\n', data)

    def test_all_poses_have_rgba_artwork_and_eye_layers(self):
        for outfit in ['overalls', 'hoodie', 'tshirt']:
            for pose in ['study', 'dining', 'thinking', 'hungry']:
                folder = ASSETS / outfit / pose
                with self.subTest(outfit=outfit, pose=pose):
                    png = (folder / 'source.png').read_bytes()
                    self.assertEqual(struct.unpack('>IIBB', png[16:26]), (1254, 1254, 8, 6))
                    layers = json.loads((folder / 'built/layers.json').read_text(encoding='utf-8'))['layers']
                    for name in layers:
                        self.assertTrue((folder / f'built/{name}.png').is_file())
                    self.assertTrue((folder / 'built/base.png').is_file())

    def test_side_view_bindings_and_complete_prompt_records_are_present(self):
        prompts = json.loads((ASSETS / 'prompts.json').read_text(encoding='utf-8'))
        self.assertEqual(len(prompts['prompts']), 12)
        self.assertEqual(prompts['reference']['name'], 'dsh-pet')
        for entry in prompts['prompts']:
            self.assertTrue(entry['basePrompt'])
            if entry['action'] in ['study', 'dining']:
                self.assertIn('three-quarter', entry['sideRefinement'])
                rig = json.loads((ASSETS / entry['outfit'] / entry['action'] / 'rig.json').read_text(encoding='utf-8'))
                self.assertNotEqual(rig['face']['eyeA']['cx'], 536)


if __name__ == '__main__':
    unittest.main()
