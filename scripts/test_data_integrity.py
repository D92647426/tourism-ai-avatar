#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""REQ-035 数据完整性结构检查的回归测试（标准库 unittest，不访问用户数据）。

测试对象：``scripts/check_data_integrity.py`` 的结构检查函数与 CLI 入口。
需求与方案见 ``docs/knowledge_integrity.md``（REQ-035）。

运行方式：
    python scripts/test_data_integrity.py

所有坏样本都写入 ``tempfile.TemporaryDirectory()``，不读写
``data/users.json``、``data/interactions.json`` 等用户数据文件。
"""

from __future__ import annotations

import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from typing import Any, Dict

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import check_data_integrity as cdi  # noqa: E402  （需先补充 scripts 目录到 sys.path）

DISCLAIMER = "结构检查不等同事实核验"


def knowledge_entry(**overrides: Any) -> Dict[str, Any]:
    """构造一条结构合法的知识条目，可用关键字参数覆盖任意字段。"""
    entry: Dict[str, Any] = {
        "id": 1,
        "title": "标题一",
        "category": "文史资料",
        "content": "正文一",
        "keywords": "关键词一",
        "createTime": "2024-01-01",
    }
    entry.update(overrides)
    return entry


def spot_entry(**overrides: Any) -> Dict[str, Any]:
    """构造一条结构合法的景点条目，可用关键字参数覆盖任意字段。"""
    entry: Dict[str, Any] = {
        "id": 1,
        "name": "景点一",
        "brief": "简介一",
        "category": "景点讲解",
        "gradient": "linear-gradient(1,2)",
        "icon": "icon.png",
        "history": "历史一",
        "address": "地址一",
        "openingHours": "08:00-17:00",
        "ticket": "免费",
        "transportation": "公交一",
        "highlights": ["亮点一", "亮点二"],
        "imageUrl": "image.png",
    }
    entry.update(overrides)
    return entry


class _FallbackTempDir:
    """``tempfile.TemporaryDirectory`` 的降级替身：默认权限目录 + 尽力清理。

    仅用于「受限 Windows 沙箱把 mode=0o700 目录收成当前进程不可写」的环境；
    正常开发机与 CI 不会走到这里（见 ``create_temp_dir`` 的说明）。
    """

    def __init__(self, path: Path) -> None:
        self.name = str(path)

    def cleanup(self) -> None:
        """尽力删除临时目录；失败不影响测试结论。"""
        shutil.rmtree(self.name, ignore_errors=True)


def create_temp_dir() -> Any:
    """创建一个一次性临时目录（REQ-035 回归测试使用，不触碰用户数据）。

    优先使用 ``tempfile.TemporaryDirectory``；部分受限 Windows 沙箱会把
    ``tempfile.mkdtemp`` 固定使用的 ``mode=0o700`` 目录设置成当前进程无法写入/
    列举，此时退回同目录下默认权限的一次性目录，保证测试本身可运行。
    正常开发机和 CI 上不会触发该降级分支。
    """
    context = tempfile.TemporaryDirectory()
    try:
        probe = Path(context.name) / "write-probe.json"
        probe.write_text("{}", encoding="utf-8")
        probe.unlink()
        return context
    except OSError:
        try:
            context.cleanup()
        except OSError:
            pass
        fallback = Path(tempfile.gettempdir()) / "req035-tests-{0}".format(uuid.uuid4().hex)
        fallback.mkdir()
        return _FallbackTempDir(fallback)


class TempJsonTestCase(unittest.TestCase):
    """提供一次性临时目录的测试基类（REQ-035；不触碰仓库用户数据）。"""

    def setUp(self) -> None:
        self._tmpdir = create_temp_dir()
        self.addCleanup(self._tmpdir.cleanup)
        self.tmp = Path(self._tmpdir.name)

    def write_json(self, name: str, data: Any) -> Path:
        """把数据以 UTF-8 JSON 写入临时文件并返回路径。"""
        path = self.tmp / name
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return path

    def write_text(self, name: str, text: str) -> Path:
        """把原始文本写入临时文件并返回路径（用于构造坏 JSON）。"""
        path = self.tmp / name
        path.write_text(text, encoding="utf-8")
        return path


class TestLoadJson(TempJsonTestCase):
    """``load_json`` 对正常文件、坏 JSON、缺失文件、非 UTF-8 的处理。"""

    def test_valid_file_returns_data(self) -> None:
        sample = [knowledge_entry()]
        data, errors = cdi.load_json(self.write_json("ok.json", sample))
        self.assertEqual(errors, [])
        self.assertEqual(data, sample)

    def test_invalid_json_returns_error(self) -> None:
        data, errors = cdi.load_json(self.write_text("bad.json", "[{"))
        self.assertIsNone(data)
        self.assertEqual(len(errors), 1)
        self.assertIn("JSON 解析失败", errors[0])

    def test_missing_file_returns_error(self) -> None:
        data, errors = cdi.load_json(self.tmp / "absent.json")
        self.assertIsNone(data)
        self.assertEqual(len(errors), 1)
        self.assertIn("无法读取", errors[0])

    def test_non_utf8_file_returns_error(self) -> None:
        path = self.tmp / "gbk.json"
        path.write_bytes(b"[\xff\xfe]")
        data, errors = cdi.load_json(path)
        self.assertIsNone(data)
        self.assertEqual(len(errors), 1)
        self.assertIn("UTF-8", errors[0])


class TestValidateKnowledge(unittest.TestCase):
    """知识库结构校验：合法样本、空数组、类型/ID/字段/U+FFFD/正文等于标题。"""

    def test_valid_sample_passes(self) -> None:
        data = [knowledge_entry(), knowledge_entry(id=2, title="标题二", content="正文二")]
        self.assertEqual(cdi.validate_knowledge(data, "k.json"), [])

    def test_empty_array_passes(self) -> None:
        self.assertEqual(cdi.validate_knowledge([], "k.json"), [])

    def test_top_level_null_fails(self) -> None:
        errors = cdi.validate_knowledge(None, "k.json")
        self.assertTrue(errors)
        self.assertIn("顶层必须是 JSON 数组", errors[0])

    def test_top_level_object_fails(self) -> None:
        errors = cdi.validate_knowledge({"id": 1}, "k.json")
        self.assertTrue(errors)
        self.assertIn("顶层必须是 JSON 数组", errors[0])

    def test_duplicate_id_fails(self) -> None:
        data = [knowledge_entry(id=5), knowledge_entry(id=5, title="标题二", content="正文二")]
        joined = "\n".join(cdi.validate_knowledge(data, "k.json"))
        self.assertIn("重复", joined)

    def test_zero_id_fails(self) -> None:
        joined = "\n".join(cdi.validate_knowledge([knowledge_entry(id=0)], "k.json"))
        self.assertIn("id", joined)
        self.assertIn("正整数", joined)

    def test_negative_id_fails(self) -> None:
        joined = "\n".join(cdi.validate_knowledge([knowledge_entry(id=-3)], "k.json"))
        self.assertIn("正整数", joined)

    def test_string_id_fails(self) -> None:
        joined = "\n".join(cdi.validate_knowledge([knowledge_entry(id="1")], "k.json"))
        self.assertIn("正整数", joined)

    def test_bool_id_fails(self) -> None:
        joined = "\n".join(cdi.validate_knowledge([knowledge_entry(id=True)], "k.json"))
        self.assertIn("正整数", joined)

    def test_missing_required_field_fails(self) -> None:
        entry = knowledge_entry()
        del entry["keywords"]
        errors = cdi.validate_knowledge([entry], "k.json")
        self.assertTrue(errors)
        self.assertIn("缺少必填字段 keywords", "\n".join(errors))

    def test_empty_string_field_fails(self) -> None:
        errors = cdi.validate_knowledge([knowledge_entry(title="   ")], "k.json")
        self.assertTrue(errors)
        self.assertIn("不得为空字符串", "\n".join(errors))

    def test_non_string_field_fails(self) -> None:
        errors = cdi.validate_knowledge([knowledge_entry(category=123)], "k.json")
        self.assertTrue(errors)
        self.assertIn("必须是字符串", "\n".join(errors))

    def test_replacement_character_in_content_fails(self) -> None:
        errors = cdi.validate_knowledge([knowledge_entry(content="正常\ufffd内容")], "k.json")
        self.assertTrue(errors)
        self.assertIn("U+FFFD", "\n".join(errors))

    def test_replacement_character_in_keywords_fails(self) -> None:
        errors = cdi.validate_knowledge([knowledge_entry(keywords="灵山\ufffd大佛")], "k.json")
        self.assertTrue(errors)
        self.assertIn("U+FFFD", "\n".join(errors))

    def test_content_equals_other_title_fails(self) -> None:
        data = [
            knowledge_entry(id=1, title="标题甲", content="标题乙"),
            knowledge_entry(id=2, title="标题乙", content="正文乙"),
        ]
        joined = "\n".join(cdi.validate_knowledge(data, "k.json"))
        self.assertIn("id=1", joined)
        self.assertIn("id=2", joined)
        self.assertIn("疑似", joined)

    def test_content_equals_own_title_fails(self) -> None:
        errors = cdi.validate_knowledge([knowledge_entry(title="同一文本", content="同一文本")], "k.json")
        self.assertTrue(errors)
        self.assertIn("本条 title", "\n".join(errors))


class TestValidateSpots(unittest.TestCase):
    """景点结构校验：合法样本、必填字段、highlights、ID、U+FFFD。"""

    def test_valid_sample_passes(self) -> None:
        data = [spot_entry(), spot_entry(id=2, name="景点二")]
        self.assertEqual(cdi.validate_spots(data, "s.json"), [])

    def test_empty_array_passes(self) -> None:
        self.assertEqual(cdi.validate_spots([], "s.json"), [])

    def test_missing_required_field_fails(self) -> None:
        entry = spot_entry()
        del entry["history"]
        errors = cdi.validate_spots([entry], "s.json")
        self.assertTrue(errors)
        self.assertIn("缺少必填字段 history", "\n".join(errors))

    def test_empty_string_field_fails(self) -> None:
        errors = cdi.validate_spots([spot_entry(address="  ")], "s.json")
        self.assertTrue(errors)
        self.assertIn("不得为空字符串", "\n".join(errors))

    def test_missing_highlights_fails(self) -> None:
        entry = spot_entry()
        del entry["highlights"]
        errors = cdi.validate_spots([entry], "s.json")
        self.assertTrue(errors)
        self.assertIn("缺少必填字段 highlights", "\n".join(errors))

    def test_highlights_not_list_fails(self) -> None:
        errors = cdi.validate_spots([spot_entry(highlights="亮点一")], "s.json")
        self.assertTrue(errors)
        self.assertIn("必须是数组", "\n".join(errors))

    def test_highlights_empty_item_fails(self) -> None:
        errors = cdi.validate_spots([spot_entry(highlights=["亮点一", " "])], "s.json")
        self.assertTrue(errors)
        self.assertIn("不得为空字符串", "\n".join(errors))

    def test_highlights_non_string_item_fails(self) -> None:
        errors = cdi.validate_spots([spot_entry(highlights=[1, "亮点二"])], "s.json")
        self.assertTrue(errors)
        self.assertIn("必须是字符串", "\n".join(errors))

    def test_duplicate_id_fails(self) -> None:
        data = [spot_entry(id=3), spot_entry(id=3, name="景点二")]
        joined = "\n".join(cdi.validate_spots(data, "s.json"))
        self.assertIn("重复", joined)

    def test_replacement_character_fails(self) -> None:
        errors = cdi.validate_spots([spot_entry(brief="简介\ufffd")], "s.json")
        self.assertTrue(errors)
        self.assertIn("U+FFFD", "\n".join(errors))


class TestCheckParity(unittest.TestCase):
    """打包库与外部库语义一致性（防漂移）检查。"""

    def test_equal_semantics_passes(self) -> None:
        data = [knowledge_entry()]
        self.assertEqual(cdi.check_parity(data, json.loads(json.dumps(data))), [])

    def test_field_drift_reports_id_and_field(self) -> None:
        external = [knowledge_entry(id=1, content="外部正文")]
        packaged = [knowledge_entry(id=1, content="打包正文")]
        joined = "\n".join(cdi.check_parity(external, packaged))
        self.assertIn("id=1", joined)
        self.assertIn("content", joined)
        self.assertIn("漂移", joined)

    def test_count_mismatch_reports(self) -> None:
        external = [knowledge_entry(id=1), knowledge_entry(id=2, title="标题二", content="正文二")]
        packaged = [knowledge_entry(id=1)]
        joined = "\n".join(cdi.check_parity(external, packaged))
        self.assertIn("数量不一致", joined)
        self.assertIn("多出条目", joined)

    def test_top_level_mismatch_reports(self) -> None:
        joined = "\n".join(cdi.check_parity([], {"id": 1}))
        self.assertIn("顶层不是数组", joined)


class TestRunChecksAndCli(TempJsonTestCase):
    """``run_checks`` 汇总行为与 ``main`` 的退出码/输出约定。"""

    def write_valid_bundle(self) -> Dict[str, Path]:
        """在临时目录写一套结构与语义都合法的三份数据文件。"""
        knowledge = [knowledge_entry(id=1), knowledge_entry(id=2, title="标题二", content="正文二")]
        spots = [spot_entry(id=1), spot_entry(id=2, name="景点二")]
        return {
            "knowledge": self.write_json("knowledge.json", knowledge),
            "packaged": self.write_json("packaged_knowledge.json", knowledge),
            "spots": self.write_json("spots.json", spots),
        }

    def test_run_checks_valid_temp_repo_passes(self) -> None:
        paths = self.write_valid_bundle()
        result = cdi.run_checks(paths["knowledge"], paths["packaged"], paths["spots"])
        self.assertTrue(result.ok, msg="\n".join(result.errors))
        self.assertEqual(result.knowledge_count, 2)
        self.assertEqual(result.packaged_knowledge_count, 2)
        self.assertEqual(result.spots_count, 2)
        self.assertTrue(result.parity_checked)

    def test_run_checks_empty_knowledge_bundle_passes(self) -> None:
        knowledge = self.write_json("knowledge.json", [])
        packaged = self.write_json("packaged.json", [])
        spots = self.write_json("spots.json", [spot_entry()])
        result = cdi.run_checks(knowledge, packaged, spots)
        self.assertTrue(result.ok, msg="\n".join(result.errors))
        self.assertEqual(result.knowledge_count, 0)

    def test_run_checks_parity_drift_fails(self) -> None:
        paths = self.write_valid_bundle()
        drifted = [knowledge_entry(id=1, content="被改动的正文"), knowledge_entry(id=2, title="标题二", content="正文二")]
        self.write_json("packaged_knowledge.json", drifted)
        result = cdi.run_checks(paths["knowledge"], paths["packaged"], paths["spots"])
        self.assertFalse(result.ok)
        self.assertTrue(result.parity_checked)
        joined = "\n".join(result.errors)
        self.assertIn("content", joined)
        self.assertIn("id=1", joined)

    def test_run_checks_missing_files_fails(self) -> None:
        result = cdi.run_checks(self.tmp / "none-a.json", self.tmp / "none-b.json", self.tmp / "none-c.json")
        self.assertFalse(result.ok)
        self.assertFalse(result.parity_checked)
        self.assertIsNone(result.knowledge_count)

    def test_main_exit_code_0_and_disclaimer(self) -> None:
        paths = self.write_valid_bundle()
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            code = cdi.main(
                [
                    "--knowledge",
                    str(paths["knowledge"]),
                    "--packaged-knowledge",
                    str(paths["packaged"]),
                    "--spots",
                    str(paths["spots"]),
                ]
            )
        output = buffer.getvalue()
        self.assertEqual(code, 0)
        self.assertIn("OK: 结构检查通过", output)
        self.assertIn("2 条", output)
        self.assertEqual(output.strip().splitlines()[-1], DISCLAIMER)

    def test_main_exit_code_1_on_bad_json(self) -> None:
        paths = self.write_valid_bundle()
        self.write_text("knowledge.json", "[{")
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            code = cdi.main(
                [
                    "--knowledge",
                    str(paths["knowledge"]),
                    "--packaged-knowledge",
                    str(paths["packaged"]),
                    "--spots",
                    str(paths["spots"]),
                ]
            )
        output = buffer.getvalue()
        self.assertEqual(code, 1)
        self.assertIn("JSON 解析失败", output)
        self.assertIn("FAILED", output)
        self.assertEqual(output.strip().splitlines()[-1], DISCLAIMER)

    def test_default_paths_point_into_repository(self) -> None:
        self.assertEqual(cdi.DEFAULT_KNOWLEDGE_PATH, cdi.REPO_ROOT / "data" / "knowledge.json")
        self.assertEqual(
            cdi.DEFAULT_PACKAGED_KNOWLEDGE_PATH,
            cdi.REPO_ROOT / "src" / "main" / "resources" / "knowledge.json",
        )
        self.assertEqual(cdi.DEFAULT_SPOTS_PATH, cdi.REPO_ROOT / "src" / "main" / "resources" / "spots.json")

    def test_real_repository_defaults_pass(self) -> None:
        result = cdi.run_checks()
        self.assertTrue(result.ok, msg="\n".join(result.errors))
        self.assertTrue(result.parity_checked)
        self.assertGreaterEqual(result.knowledge_count or 0, 1)
        self.assertEqual(result.knowledge_count, result.packaged_knowledge_count)
        self.assertGreaterEqual(result.spots_count or 0, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
