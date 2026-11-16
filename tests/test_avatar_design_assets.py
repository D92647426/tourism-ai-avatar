"""REQ-063 / TEST-063 checks for the approved character design artwork."""
import hashlib
import json
from pathlib import Path
import struct
import unittest


ROOT = Path(__file__).resolve().parents[1]
DESIGNS = ROOT / 'docs' / 'designs' / 'yanxiaobei' / 'v7'


class AvatarDesignAssetsTest(unittest.TestCase):
    """Check selected PNG bytes and their portable generation record."""

    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((DESIGNS / 'manifest.json').read_text(encoding='utf-8'))

    def test_selected_artwork_matches_the_recorded_files_and_digests(self):
        self.assertEqual(self.manifest['version'], 'v7')
        self.assertEqual(self.manifest['role'], 'character-design-artwork')
        self.assertEqual(self.manifest['artworkLicense'], 'upstream-unspecified')
        entries = self.manifest['files']
        self.assertEqual({entry['id'] for entry in entries}, {'overalls', 'hoodie', 'tshirt'})
        self.assertEqual(len(entries), 3)
        for entry in entries:
            with self.subTest(outfit=entry['id']):
                self.assertEqual(entry['file'], entry['id'] + '.png')
                digest = hashlib.sha256((DESIGNS / entry['file']).read_bytes()).hexdigest()
                self.assertEqual(digest, entry['sha256'])

    def test_all_png_headers_are_full_size_rgba(self):
        for entry in self.manifest['files']:
            with self.subTest(outfit=entry['id']):
                data = (DESIGNS / entry['file']).read_bytes()
                self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
                self.assertEqual(data[12:16], b'IHDR')
                width, height, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', data[16:29])
                self.assertEqual((width, height), (1254, 1254))
                self.assertEqual((entry['width'], entry['height'], entry['mode']), (width, height, 'RGBA'))
                self.assertEqual((depth, color, compression, filtering, interlace), (8, 6, 0, 0, 0))

    def test_prompt_record_covers_the_selected_outfits_and_approved_basis(self):
        record = self.manifest['promptRecord']
        self.assertEqual(record['file'], 'prompt-set.json')
        content = (DESIGNS / record['file']).read_bytes()
        self.assertEqual(hashlib.sha256(content).hexdigest(), record['sha256'])
        prompts = json.loads(content)
        self.assertEqual(prompts['tool'], self.manifest['generationTool'])
        self.assertEqual(prompts['approved_basis'], self.manifest['approvedBasis'])
        self.assertEqual(set(prompts['outputs']), {entry['originalFilename'] for entry in self.manifest['files']})
        self.assertEqual(set(prompts['prompts']), {'master', 'hoodie', 'hoodie_temple_detail', 'tshirt'})
        self.assertTrue(all(isinstance(prompt, str) and len(prompt) > 500 for prompt in prompts['prompts'].values()))


if __name__ == '__main__':
    unittest.main()
