"""Build REQ-064's three v8 mesh avatars using an existing RuiC-2D checkout."""

import argparse
import importlib
import hashlib
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
ASSETS = REPO / "src/main/resources/static/media/campus/yanxiaobei-v8"
EXPRESSIONS = REPO / "docs/designs/yanxiaobei/v8/expressions"
OUTFITS = ("overalls", "hoodie", "tshirt")


def write_json(path: Path, value: dict) -> None:
    """Write editable UTF-8 build metadata for REQ-064."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def make_rig(pipeline) -> dict:
    """Bind v8's 1254px illustration coordinates, eyes, jaw and compact body."""
    rig = pipeline.make_rig(1254, 1254, [[536, 636], [724, 636], [629, 705]])
    rig["head"].update({
        "cx": 627, "cy": 475, "rx": 420, "ry": 365,
        "pivotX": 627, "pivotY": 776, "shiftX": 12, "shiftY": 7,
        "maxRoll": 0.025, "weightBand": [745, 795], "turnBand": [725, 815],
    })
    rig["body"].update({
        "pivotX": 627, "pivotY": 1230, "maxRoll": 0.01,
        "breathBand": [778, 1218], "rollBand": [776, 1235],
        "chest": {"cx": 627, "cy": 895, "rx": 165, "ry": 125},
        "shoulders": [
            {"cx": 490, "cy": 842, "rx": 45, "ry": 50},
            {"cx": 766, "cy": 842, "rx": 45, "ry": 50},
        ],
    })
    rig["mouth"].update({
        "cx": 629, "cy": 705, "halfLen": 27, "bow": 5,
        "area": {"cx": 629, "cy": 709, "rx": 40, "ry": 34, "angle": 0},
    })
    rig["face"]["mouth"] = {"cx": 629, "cy": 709, "rx": 43, "ry": 35}
    rig["face"]["nose"] = {"cx": 630, "cy": 670, "rx": 12, "ry": 12}
    rig["face"]["brow"] = {"cx": 630, "cy": 566, "rx": 150, "ry": 22, "band": [549, 583]}
    rig["face"]["jaw"] = {"cx": 629, "cy": 747, "rx": 153, "ry": 27, "band": [728, 778]}
    rig["cheeks"] = [[499, 704], [754, 704]]
    opening = [[477, 626], [483, 614], [497, 606], [517, 600], [538, 599],
               [558, 605], [572, 618], [578, 637], [575, 655], [565, 669],
               [547, 678], [527, 677], [506, 668], [489, 652], [480, 636]]
    roi = [[451, 609], [462, 587], [491, 574], [526, 574], [560, 586],
           [587, 606], [595, 634], [589, 663], [572, 685], [542, 693],
           [505, 687], [478, 671], [459, 649]]
    rig["eyes"] = [{"opening": opening, "roi": roi}, {
        "opening": [[x + 188, y] for x, y in opening],
        "roi": [[x + 188, y] for x, y in roi],
    }]
    rig["mesh"].update({
        "baseCell": 15, "fine": {"x0": 430, "x1": 824, "y0": 550, "y1": 780, "cell": 6},
        "eyeCell": 3, "eyeBallCell": 4, "spriteCell": 4,
    })
    rig["strands"] = [
        {"name": "left-hair", "nodes": [[374, 476], [296, 652], [343, 833]], "sigma": 52, "k": 0.4, "max": 1.5},
        {"name": "right-hair", "nodes": [[883, 476], [969, 652], [920, 833]], "sigma": 52, "k": 0.4, "max": 1.5},
        {"name": "ahoge", "nodes": [[633, 307], [807, 181], [729, 50]], "sigma": 50, "k": 0.25, "max": 1.1},
    ]
    rig["view"].update({"padTop": 0.025, "padSide": 0.025, "gazeCenter": [630, 636]})
    return rig


def build(ruic: Path) -> None:
    """Import generated expressions under protected masks and export runtime assets.

    Requires RuiC-2D tools plus Pillow, NumPy and OpenCV. Raises on invalid
    source dimensions or missing expressions. See docs/campus_avatar.md.
    """
    sys.path.insert(0, str(ruic / "tools"))
    pipeline = importlib.import_module("pipeline")
    art = importlib.import_module("art")
    pipeline.PROJECTS = REPO / "target/avatar-build-v8"
    pipeline.PROJECTS.mkdir(parents=True, exist_ok=True)
    for outfit in OUTFITS:
        project = pipeline.PROJECTS / outfit
        project.mkdir(exist_ok=True)
        destination = ASSETS / outfit
        with Image.open(destination / "source.png") as source:
            if source.size != (1254, 1254) or source.mode != "RGBA" or source.getchannel("A").getextrema()[0] != 0:
                raise ValueError(f"{outfit} must be transparent RGBA 1254x1254")
        shutil.copy2(destination / "source.png", project / "source.png")
        write_json(project / "rig.json", make_rig(pipeline))
        write_json(project / "workspace.json", {"version": 1, "name": f"燕小北 v8 {outfit}", "regions": []})
        (project / "generated").mkdir(exist_ok=True)
        (project / "built/sprites").mkdir(parents=True, exist_ok=True)
        write_json(project / "built/sprites/sprites.json", {"layers": {}, "geometry": "force-recrop"})
        report = art.import_assets(outfit, str(EXPRESSIONS))
        shutil.copy2(project / "rig.json", destination / "rig.json")
        shutil.copytree(project / "built", destination / "built", dirs_exist_ok=True)
        # Git's text attributes use LF. Hash the exact bytes shared by every OS.
        for metadata in destination.rglob('*.json'):
            metadata.write_bytes(metadata.read_bytes().replace(b'\r\n', b'\n'))
        write_json(destination / "import-report.json", {"requirement": "REQ-064", "expressions": report})
        print(f"Built v8 {outfit}, {len(report)} protected expression imports")
    files = []
    for outfit in OUTFITS:
        for file in sorted((ASSETS / outfit).rglob('*')):
            if file.is_file():
                files.append({"file": file.relative_to(ASSETS).as_posix(), "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    write_json(ASSETS / 'manifest.json', {
        "version": "v8", "role": "runtime-mesh-avatar", "requirement": "REQ-064",
        "generationTool": "built-in image_gen", "outfits": list(OUTFITS),
        "basis": "v7 造型，细腿、小鞋，保留收窄下巴、大呆毛及深灰黑后翼",
        "files": files,
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ruic", type=Path, required=True, help="Existing RuiC-2D checkout, used read-only")
    arguments = parser.parse_args()
    build(arguments.ruic.resolve())
