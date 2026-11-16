"""REQ-061 Prepare offline OSM campus geometry and reference points.

Read the catalog boundary, download the public OSM map API with a bounded timeout,
and atomically replace the two derived JSON documents. The outputs carry reference
coordinates and entrance verification metadata. See docs/config_reference.md and docs/test_reference.md.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
EPSILON = 1e-10
ATTRIBUTION = "© OpenStreetMap contributors"
LICENSE_URL = "https://www.openstreetmap.org/copyright"


def valid_coordinate(point: object) -> bool:
    """Accept finite WGS84 longitude/latitude pairs, including zero values."""
    return (isinstance(point, (list, tuple)) and len(point) == 2
            and all(type(value) in (int, float) and math.isfinite(value) for value in point)
            and abs(point[0]) <= 180 and abs(point[1]) <= 90)


def campus_geometry(catalog: dict) -> tuple[dict, list, list]:
    """REQ-061 Resolve and validate the existing Pingleyuan boundary without inventing points."""
    campus = next((item for item in catalog["campuses"] if item["id"] == "pingleyuan"), None)
    if campus is None:
        raise ValueError("Catalog has no Pingleyuan campus")
    preview = campus["mapPreview"]
    bbox, boundary = preview["bbox"], preview["boundary"]
    if (preview.get("coordinateSystem") != "WGS84" or not isinstance(bbox, list) or len(bbox) != 4
            or not valid_coordinate(bbox[:2]) or not valid_coordinate(bbox[2:])
            or bbox[0] >= bbox[2] or bbox[1] >= bbox[3]):
        raise ValueError("Invalid WGS84 campus bbox")
    if (not isinstance(boundary, list) or len(boundary) < 4 or boundary[0] != boundary[-1]
            or not all(valid_coordinate(point) for point in boundary)
            or not all(bbox[0] <= p[0] <= bbox[2] and bbox[1] <= p[1] <= bbox[3] for p in boundary)):
        raise ValueError("Invalid closed campus boundary")
    return campus, bbox, boundary


def cross(a: tuple, b: tuple) -> float:
    return a[0] * b[1] - a[1] * b[0]


def point_inside(point: tuple | list, boundary: list) -> bool:
    """Return whether a point belongs to the boundary polygon, including its edges."""
    x, y = point
    inside = False
    for a, b in zip(boundary, boundary[1:]):
        edge, offset = (b[0] - a[0], b[1] - a[1]), (x - a[0], y - a[1])
        if (abs(cross(edge, offset)) <= EPSILON
                and min(a[0], b[0]) - EPSILON <= x <= max(a[0], b[0]) + EPSILON
                and min(a[1], b[1]) - EPSILON <= y <= max(a[1], b[1]) + EPSILON):
            return True
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def polygon_center(points: list) -> list | None:
    """Compute an area centroid relative to the first vertex for numerical stability."""
    if len(points) < 4 or points[0] != points[-1] or len(set(map(tuple, points[:-1]))) < 3:
        return None
    origin = points[0]
    local = [(p[0] - origin[0], p[1] - origin[1]) for p in points]
    area = x_sum = y_sum = 0.0
    for a, b in zip(local, local[1:]):
        weight = cross(a, b)
        area += weight
        x_sum += (a[0] + b[0]) * weight
        y_sum += (a[1] + b[1]) * weight
    if abs(area) < 1e-16:
        return None
    return [origin[0] + x_sum / (3 * area), origin[1] + y_sum / (3 * area)]


def clip_line(points: list, boundary: list) -> list:
    """Clip each road segment to a possibly concave campus polygon, preserving separate parts."""
    parts = []
    for a, b in zip(points, points[1:]):
        direction = (b[0] - a[0], b[1] - a[1])
        if direction == (0, 0):
            continue
        cuts = [0.0, 1.0]
        for c, d in zip(boundary, boundary[1:]):
            edge = (d[0] - c[0], d[1] - c[1])
            denominator = cross(direction, edge)
            if abs(denominator) < 1e-18:
                continue
            offset = (c[0] - a[0], c[1] - a[1])
            t, u = cross(offset, edge) / denominator, cross(offset, direction) / denominator
            if -EPSILON <= t <= 1 + EPSILON and -EPSILON <= u <= 1 + EPSILON:
                cuts.append(max(0.0, min(1.0, t)))
        cuts = sorted(set(round(value, 12) for value in cuts))
        for low, high in zip(cuts, cuts[1:]):
            if high - low < EPSILON:
                continue
            middle = (low + high) / 2
            if not point_inside((a[0] + middle * direction[0], a[1] + middle * direction[1]), boundary):
                continue
            start = [a[0] + low * direction[0], a[1] + low * direction[1]]
            end = [a[0] + high * direction[0], a[1] + high * direction[1]]
            if parts and all(abs(x - y) < EPSILON for x, y in zip(parts[-1][-1], start)):
                parts[-1].append(end)
            else:
                parts.append([start, end])
    return parts


def geometry_kind(tags: dict) -> str | None:
    if tags.get("building") and tags["building"] != "no":
        return "building"
    if tags.get("highway"):
        return "road"
    if tags.get("natural") == "water" or tags.get("waterway") == "riverbank":
        return "water"
    if (tags.get("leisure") in ("pitch", "track", "sports_centre", "swimming_pool")
            or tags.get("leisure") == "playground" and "操场" in tags.get("name", "")):
        return "sports"
    return None


def normalized_name(name: str) -> str:
    """Only remove the campus prefix. Exact catalog names and aliases remain required."""
    for prefix in ("北京工业大学", "北工大"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name.strip()


def prepare_documents(raw: bytes, catalog: dict, fetched_at: str) -> tuple[dict, dict]:
    """REQ-061 Convert OSM XML into clipped geometry and exact-name reference points.

    Duplicate elements, missing geometry nodes and invalid coordinates raise ValueError.
    Relations are excluded, preventing unrelated route members from becoming campus POIs.
    """
    campus, bbox, boundary = campus_geometry(catalog)
    tree = ET.fromstring(raw)
    if tree.tag != "osm":
        raise ValueError("Expected OSM XML")
    seen, nodes, elements = set(), {}, []
    for element in tree:
        if element.tag not in ("node", "way", "relation"):
            continue
        identifier = element.attrib.get("id", "")
        if not identifier.isdigit() or (element.tag, identifier) in seen:
            raise ValueError("Missing or duplicate OSM element ID")
        seen.add((element.tag, identifier))
        tags = {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}
        if element.tag == "node":
            point = [float(element.attrib["lon"]), float(element.attrib["lat"])]
            if not valid_coordinate(point):
                raise ValueError("Invalid OSM node coordinates")
            nodes[identifier] = point
        elements.append((element, tags))
    source_url = "https://api.openstreetmap.org/api/0.6/map?" + urlencode({"bbox": ",".join(map(str, bbox))})
    metadata = {"campusId": campus["id"], "coordinateSystem": "WGS84", "provider": "OpenStreetMap",
                "sourceUrl": source_url, "fetchedAt": fetched_at, "license": "ODbL-1.0",
                "licenseUrl": LICENSE_URL, "attribution": ATTRIBUTION,
                "sourceSha256": hashlib.sha256(raw).hexdigest(), "entranceVerified": False,
                "notice": "OSM参考轮廓和建筑中心，建筑入口、开放状态与通行路线待现场核验。"}
    features, candidates = [], []
    for element, tags in elements:
        kind = geometry_kind(tags)
        if element.tag == "relation":
            continue
        identifier = element.attrib["id"]
        if element.tag == "node":
            center = nodes[identifier]
            if tags.get("name") and point_inside(center, boundary):
                candidates.append((element.tag, identifier, tags, center, "osm-node"))
            continue
        if not kind:
            continue
        references = [node.attrib["ref"] for node in element.findall("nd")]
        if any(reference not in nodes for reference in references):
            raise ValueError("Missing node in OSM way " + identifier)
        points = [nodes[reference] for reference in references]
        center = polygon_center(points)
        is_area = kind != "road" or tags.get("area") == "yes"
        if is_area:
            if center is None or not point_inside(center, boundary):
                continue
            geometry = {"type": "Polygon", "coordinates": [points]}
        else:
            parts = clip_line(points, boundary)
            if not parts:
                continue
            geometry = {"type": "LineString", "coordinates": parts[0]} if len(parts) == 1 else {"type": "MultiLineString", "coordinates": parts}
        source = "https://www.openstreetmap.org/" + element.tag + "/" + identifier
        properties = {"kind": kind, "osmType": element.tag, "osmId": int(identifier),
                      "name": tags.get("name", ""), "sourceUrl": source,
                      "coordinateStatus": "reference", "entranceVerified": False}
        for key in ("building", "highway", "access", "foot", "bicycle", "area", "natural", "water", "leisure", "sport"):
            if key in tags:
                properties[key] = tags[key]
        features.append({"type": "Feature", "id": element.tag + "/" + identifier,
                         "properties": properties, "geometry": geometry})
        if center and point_inside(center, boundary):
            candidates.append((element.tag, identifier, tags, center, "polygon-area-centroid"))
    features.sort(key=lambda item: item["id"])
    features.insert(0, {"type": "Feature", "id": "campus/pingleyuan",
                       "properties": {"kind": "campus", "name": campus["name"],
                                      "sourceUrl": campus["mapPreview"]["sourceUrl"],
                                      "coordinateStatus": "reference", "entranceVerified": False},
                       "geometry": {"type": "Polygon", "coordinates": [boundary]}})
    points, unknown = [], []
    for place in catalog["places"]:
        if place["campusId"] != campus["id"]:
            continue
        names = {normalized_name(name) for name in [place["name"], *place.get("aliases", [])]} - {""}
        matches = [item for item in candidates if normalized_name(item[2].get("name", "")) in names]
        if len(matches) != 1:
            unknown.append(place["id"])
            continue
        element_type, identifier, tags, center, method = matches[0]
        points.append({"placeId": place["id"], "name": place["name"], "campusId": campus["id"],
                       "latitude": round(center[1], 8), "longitude": round(center[0], 8),
                       "coordinateStatus": "reference", "entranceVerified": False,
                       "osmType": element_type, "osmId": int(identifier), "osmName": tags["name"],
                       "sourceUrl": "https://www.openstreetmap.org/" + element_type + "/" + identifier,
                       "coordinateMethod": method})
    collection = {"type": "FeatureCollection", "bbox": bbox,
                  "metadata": dict(metadata, counts=dict(Counter(feature["properties"]["kind"] for feature in features))),
                  "features": features}
    reference_points = dict(metadata, points=points, unknownPlaceIds=unknown)
    return collection, reference_points


def write_documents(documents: dict[Path, dict]) -> None:
    """Stage complete JSON for both outputs, then replace atomically, rolling back on failure."""
    staged, backups, replaced = {}, {}, []
    try:
        for path, data in documents.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            backups[path] = path.read_bytes() if path.exists() else None
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as output:
                staged[path] = Path(output.name)
                json.dump(data, output, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
                output.write("\n")
                output.flush()
                os.fsync(output.fileno())
        for path, temporary in staged.items():
            os.replace(temporary, path)
            replaced.append(path)
    except Exception:
        for path in reversed(replaced):
            original = backups[path]
            if original is None:
                path.unlink(missing_ok=True)
            else:
                with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as restored:
                    restored.write(original)
                    restore_path = Path(restored.name)
                os.replace(restore_path, path)
        raise
    finally:
        for temporary in staged.values():
            temporary.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    """REQ-061 CLI returns 0 after two valid outputs, 1 for source, schema or write failures."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument("--catalog", type=Path, default=ROOT / "src/main/resources/campus/catalog.json", help="Read campus boundary and exact place aliases from this catalog")
    parser.add_argument("--output", type=Path, default=ROOT / "src/main/resources/static/media/campus/pingleyuan-features.geojson", help="Write the offline GeoJSON feature collection here")
    parser.add_argument("--points-output", type=Path, default=ROOT / "src/main/resources/static/media/campus/campus-map-points.json", help="Write exact-name reference points and unknown place IDs here")
    parser.add_argument("--source-file", type=Path, help="Read a previously downloaded OSM XML copy for offline regeneration")
    parser.add_argument("--timeout", type=float, default=30, help="Public map API timeout in seconds")
    args = parser.parse_args(argv)
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error("--timeout must be finite and positive")
    if args.output.resolve() == args.points_output.resolve():
        parser.error("output files must have distinct paths")
    inputs = {args.catalog.resolve()}
    if args.source_file:
        inputs.add(args.source_file.resolve())
    if args.output.resolve() in inputs or args.points_output.resolve() in inputs:
        parser.error("output files must differ from the input files")
    try:
        catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
        _, bbox, _ = campus_geometry(catalog)
        source = "https://api.openstreetmap.org/api/0.6/map?" + urlencode({"bbox": ",".join(map(str, bbox))})
        if args.source_file:
            raw = args.source_file.read_bytes()
            fetched_at = datetime.fromtimestamp(args.source_file.stat().st_mtime, timezone.utc).isoformat()
        else:
            with urlopen(Request(source, headers={"User-Agent": "BJUT-Campus-Course-Map/1.0"}), timeout=args.timeout) as response:
                raw = response.read(8 * 1024 * 1024 + 1)
            if len(raw) > 8 * 1024 * 1024:
                raise ValueError("OSM response exceeds the 8 MiB campus extract limit")
            fetched_at = datetime.now(timezone.utc).isoformat()
        collection, points = prepare_documents(raw, catalog, fetched_at)
        write_documents({args.output: collection, args.points_output: points})
        print(json.dumps({"status": "prepared", "counts": collection["metadata"]["counts"],
                          "referencePoints": len(points["points"]), "unknownPlaceIds": points["unknownPlaceIds"],
                          "sourceUrl": source}, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, ET.ParseError) as error:
        print("Campus map preparation failed: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
