"""REQ-061 Offline regression checks for OSM geometry and reference-point preparation."""
from collections import Counter
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("update_campus_map", ROOT / "scripts/update_campus_map.py")
maps = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(maps)
FETCHED = "2026-11-16T00:00:00+00:00"


def catalog():
    return {"campuses": [{"id": "pingleyuan", "name": "平乐园", "mapPreview": {
        "coordinateSystem": "WGS84", "bbox": [0, 0, 10, 10],
        "boundary": [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        "sourceUrl": "https://www.openstreetmap.org/way/1"}}],
        "places": [{"id": "library", "campusId": "pingleyuan", "name": "逸夫图书馆", "aliases": ["图书馆"]},
                   {"id": "dining", "campusId": "pingleyuan", "name": "北区餐厅", "aliases": []}]}


def source():
    tree = ET.Element("osm", version="0.6")
    points = {1: (2, 2), 2: (4, 2), 3: (4, 4), 4: (2, 4),
              5: (20, 20), 6: (24, 20), 7: (24, 24), 8: (20, 24),
              9: (-2, 5), 10: (12, 5)}
    for identifier, (longitude, latitude) in points.items():
        ET.SubElement(tree, "node", id=str(identifier), lat=str(latitude), lon=str(longitude))
    for identifier, refs, tags in [(101, [1, 2, 3, 4, 1], {"building": "yes", "name": "北工大逸夫图书馆"}),
                                    (102, [5, 6, 7, 8, 5], {"building": "yes", "name": "远处建筑"}),
                                    (103, [9, 9, 10], {"highway": "footway", "name": "穿过校区的路"})]:
        way = ET.SubElement(tree, "way", id=str(identifier))
        for ref in refs:
            ET.SubElement(way, "nd", ref=str(ref))
        for key, value in tags.items():
            ET.SubElement(way, "tag", k=key, v=value)
    relation = ET.SubElement(tree, "relation", id="104")
    ET.SubElement(relation, "tag", k="name", v="逸夫图书馆")
    return tree


def prepare(tree=None, data=None):
    return maps.prepare_documents(ET.tostring(source() if tree is None else tree), catalog() if data is None else data, FETCHED)


def geometry_points(geometry):
    if geometry["type"] == "LineString":
        return geometry["coordinates"]
    return [point for part in geometry["coordinates"] for point in part]


class CampusMapPreparationTests(unittest.TestCase):
    def test_only_campus_building_and_clipped_roads_survive_external_members(self):
        geometry, points = prepare()
        self.assertEqual({"campus/pingleyuan", "way/101", "way/103"}, {feature["id"] for feature in geometry["features"]})
        road = next(feature for feature in geometry["features"] if feature["id"] == "way/103")
        self.assertEqual("LineString", road["geometry"]["type"])
        for actual, expected in zip(road["geometry"]["coordinates"], [[0.0, 5.0], [10.0, 5.0]]):
            for value, target in zip(actual, expected):
                self.assertAlmostEqual(value, target, places=9)
        self.assertEqual(1, len(points["points"]))
        self.assertEqual(["dining"], points["unknownPlaceIds"])

    def test_reference_point_uses_exact_name_area_centroid_and_retains_source(self):
        _, result = prepare()
        point = result["points"][0]
        self.assertEqual((3.0, 3.0), (point["longitude"], point["latitude"]))
        self.assertEqual("reference", point["coordinateStatus"])
        self.assertFalse(point["entranceVerified"])
        self.assertEqual("polygon-area-centroid", point["coordinateMethod"])
        self.assertEqual("https://www.openstreetmap.org/way/101", point["sourceUrl"])

    def test_node_reference_uses_exact_alias_without_treating_unknown_names_as_campus_facts(self):
        tree = source()
        node = ET.SubElement(tree, "node", id="11", lat="7", lon="7")
        ET.SubElement(node, "tag", k="name", v="北区餐厅")
        ET.SubElement(node, "tag", k="amenity", v="canteen")
        _, result = prepare(tree)
        point = next(point for point in result["points"] if point["placeId"] == "dining")
        self.assertEqual("osm-node", point["coordinateMethod"])
        self.assertEqual([], result["unknownPlaceIds"])

    def test_duplicate_element_ids_are_rejected(self):
        tree = source()
        tree.append(copy.deepcopy(tree.find("node")))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            prepare(tree)

    def test_missing_geometry_nodes_are_rejected(self):
        tree = source()
        tree.find("way").find("nd").set("ref", "999999")
        with self.assertRaisesRegex(ValueError, "Missing node"):
            prepare(tree)

    def test_ambiguous_exact_names_stay_unknown(self):
        tree = source()
        node = ET.SubElement(tree, "node", id="11", lat="7", lon="7")
        ET.SubElement(node, "tag", k="name", v="逸夫图书馆")
        _, result = prepare(tree)
        self.assertEqual([], result["points"])
        self.assertEqual(["library", "dining"], result["unknownPlaceIds"])

    def test_nonfinite_or_out_of_range_coordinates_are_rejected(self):
        for value in ("nan", "inf", "91"):
            with self.subTest(value=value):
                tree = source()
                tree.find("node").set("lat", value)
                with self.assertRaisesRegex(ValueError, "coordinates"):
                    prepare(tree)

    def test_invalid_catalog_boundary_and_coordinate_system_are_rejected(self):
        for field, value in (("coordinateSystem", "GCJ02"), ("bbox", [0, 0, 200, 10]),
                             ("boundary", [[0, 0], [10, 0], [10, 10]])):
            data = catalog()
            data["campuses"][0]["mapPreview"][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "Invalid"):
                prepare(data=data)

    def test_concave_boundary_clips_one_road_into_separate_parts(self):
        boundary = [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6], [0, 0]]
        parts = maps.clip_line([[-1, 4], [7, 4]], boundary)
        self.assertEqual(2, len(parts))
        self.assertEqual([[0.0, 4.0], [2.0, 4.0]], parts[0])
        self.assertEqual([[4.0, 4.0], [6.0, 4.0]], parts[1])

    def test_atomic_pair_write_replaces_valid_documents_and_cleans_temporary_files(self):
        geometry, points = prepare()
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / "map.json", Path(directory) / "points.json"
            maps.write_documents({first: geometry, second: points})
            self.assertEqual(geometry, json.loads(first.read_text(encoding="utf-8")))
            self.assertEqual(points, json.loads(second.read_text(encoding="utf-8")))
            self.assertEqual({first.name, second.name}, {path.name for path in Path(directory).iterdir()})

    def test_pair_write_rolls_back_when_second_replace_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            first, second = Path(directory) / "map.json", Path(directory) / "points.json"
            first.write_text("old-map", encoding="utf-8")
            second.write_text("old-points", encoding="utf-8")
            replace = maps.os.replace
            calls = 0

            def fail_second(*args):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError("injected replace failure")
                return replace(*args)

            with mock.patch.object(maps.os, "replace", side_effect=fail_second), self.assertRaises(OSError):
                maps.write_documents({first: {"new": True}, second: {"new": True}})
            self.assertEqual("old-map", first.read_text(encoding="utf-8"))
            self.assertEqual("old-points", second.read_text(encoding="utf-8"))
            self.assertEqual(2, len(list(Path(directory).iterdir())))

    def test_preparation_never_mutates_the_official_catalog_coordinates(self):
        data = catalog()
        for place in data["places"]:
            place.update(coordinates=None, coordinateStatus="unverified")
        original = copy.deepcopy(data)
        prepare(data=data)
        self.assertEqual(original, data)

    def test_cli_offline_generation_writes_both_files_and_returns_machine_readable_status(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            catalog_file, source_file = folder / "catalog.json", folder / "source.osm"
            catalog_file.write_text(json.dumps(catalog()), encoding="utf-8")
            source_file.write_bytes(ET.tostring(source()))
            output, points = folder / "map.geojson", folder / "points.json"
            with mock.patch("sys.stdout", new_callable=io.StringIO) as stdout:
                status = maps.main(["--catalog", str(catalog_file), "--source-file", str(source_file),
                                    "--output", str(output), "--points-output", str(points)])
            self.assertEqual(0, status)
            self.assertEqual("prepared", json.loads(stdout.getvalue())["status"])
            self.assertEqual("FeatureCollection", json.loads(output.read_text(encoding="utf-8"))["type"])
            self.assertEqual(1, len(json.loads(points.read_text(encoding="utf-8"))["points"]))

    def test_cli_download_uses_public_api_with_selected_timeout_and_user_agent(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            catalog_file = folder / "catalog.json"
            catalog_file.write_text(json.dumps(catalog()), encoding="utf-8")
            with mock.patch.object(maps, "urlopen", return_value=io.BytesIO(ET.tostring(source()))) as request:
                with mock.patch("sys.stdout", new_callable=io.StringIO):
                    status = maps.main(["--catalog", str(catalog_file), "--output", str(folder / "map.json"),
                                        "--points-output", str(folder / "points.json"), "--timeout", "12"])
            self.assertEqual(0, status)
            self.assertEqual(12, request.call_args.kwargs["timeout"])
            self.assertTrue(request.call_args.args[0].full_url.startswith("https://api.openstreetmap.org/api/0.6/map?"))
            self.assertEqual("BJUT-Campus-Course-Map/1.0", request.call_args.args[0].get_header("User-agent"))


class PackagedCampusMapTests(unittest.TestCase):
    def test_packaged_geometry_and_reference_points_are_consistent_offline(self):
        folder = ROOT / "src/main/resources/static/media/campus"
        geometry = json.loads((folder / "pingleyuan-features.geojson").read_text(encoding="utf-8"))
        points = json.loads((folder / "campus-map-points.json").read_text(encoding="utf-8"))
        data = json.loads((ROOT / "src/main/resources/campus/catalog.json").read_text(encoding="utf-8"))
        _, bbox, boundary = maps.campus_geometry(data)
        self.assertEqual("FeatureCollection", geometry["type"])
        self.assertEqual("WGS84", points["coordinateSystem"])
        self.assertEqual("ODbL-1.0", points["license"])
        self.assertEqual(maps.ATTRIBUTION, points["attribution"])
        self.assertEqual(points["sourceSha256"], geometry["metadata"]["sourceSha256"])
        self.assertTrue(points["sourceUrl"].startswith("https://api.openstreetmap.org/api/0.6/map?"))
        self.assertRegex(points["fetchedAt"], r"^\d{4}-\d{2}-\d{2}T")
        self.assertEqual(64, len(points["sourceSha256"]))
        self.assertEqual(len(geometry["features"]), len({feature["id"] for feature in geometry["features"]}))
        counts = Counter(feature["properties"]["kind"] for feature in geometry["features"])
        self.assertEqual(dict(counts), geometry["metadata"]["counts"])
        self.assertGreater(counts["building"], 20)
        self.assertGreater(counts["road"], 20)
        for feature in geometry["features"]:
            self.assertEqual("reference", feature["properties"]["coordinateStatus"])
            self.assertFalse(feature["properties"]["entranceVerified"])
            self.assertTrue(feature["properties"]["sourceUrl"].startswith("https://www.openstreetmap.org/"))
            for longitude, latitude in geometry_points(feature["geometry"]):
                self.assertTrue(maps.valid_coordinate([longitude, latitude]))
                self.assertTrue(bbox[0] - 1e-8 <= longitude <= bbox[2] + 1e-8)
                self.assertTrue(bbox[1] - 1e-8 <= latitude <= bbox[3] + 1e-8)
        by_id = {place["id"]: place for place in data["places"] if place["campusId"] == "pingleyuan"}
        known = {point["placeId"] for point in points["points"]}
        self.assertEqual(set(by_id), known | set(points["unknownPlaceIds"]))
        self.assertFalse(known & set(points["unknownPlaceIds"]))
        for point in points["points"]:
            self.assertEqual("reference", point["coordinateStatus"])
            self.assertFalse(point["entranceVerified"])
            self.assertTrue(maps.point_inside([point["longitude"], point["latitude"]], boundary))
            names = {maps.normalized_name(name) for name in [by_id[point["placeId"]]["name"], *by_id[point["placeId"]]["aliases"]]}
            self.assertIn(maps.normalized_name(point["osmName"]), names)
            self.assertEqual("unverified", by_id[point["placeId"]]["coordinateStatus"])
            self.assertIsNone(by_id[point["placeId"]]["coordinates"])


if __name__ == "__main__":
    unittest.main()
