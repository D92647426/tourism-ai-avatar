#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""REQ-035 知识库与景点数据的结构检查命令行工具（只读）。

用途
----
检查外部默认知识库 ``data/knowledge.json``、打包默认知识库
``src/main/resources/knowledge.json`` 与景点数据
``src/main/resources/spots.json`` 的 **结构** 是否正确，并校验打包库与外部库
解析后的 JSON 语义一致（防止两份知识库漂移）。

本脚本只做结构检查，**不做事实核验**：结构检查通过不代表知识内容真实可靠。
需求与方案见 ``docs/knowledge_integrity.md``（REQ-035，第 6 节自动检查）。

用法示例
--------
    python scripts/check_data_integrity.py
    python scripts/check_data_integrity.py --help
    python scripts/check_data_integrity.py --knowledge data/knowledge.json

退出码
------
0：全部结构检查通过；1：发现结构问题（问题逐条打印）；``--help`` 退出码 0。

输入输出
--------
只读取上述 JSON 文件，不写入任何文件；stdout 打印检查计数、错误明细，
最后一行为「结构检查不等同事实核验」的说明。
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

# 仓库根目录：由脚本自身位置推导（scripts/ 的上一级），不依赖当前工作目录。
REPO_ROOT = Path(__file__).resolve().parent.parent

DEFAULT_KNOWLEDGE_PATH = REPO_ROOT / "data" / "knowledge.json"
DEFAULT_PACKAGED_KNOWLEDGE_PATH = REPO_ROOT / "src" / "main" / "resources" / "knowledge.json"
DEFAULT_SPOTS_PATH = REPO_ROOT / "src" / "main" / "resources" / "spots.json"

#: 知识条目除 id 外必须提供的非空字符串字段（顺序与数据文件一致）。
KNOWLEDGE_REQUIRED_STRING_FIELDS = (
    "title",
    "category",
    "content",
    "keywords",
    "createTime",
)

#: 景点条目除 id 与 highlights 外必须提供的非空字符串字段。
SPOTS_REQUIRED_STRING_FIELDS = (
    "name",
    "brief",
    "category",
    "history",
    "address",
    "openingHours",
    "ticket",
    "transportation",
)

#: Unicode 替换字符：出现即说明数据在编码/转换过程中损坏。
REPLACEMENT_CHAR = "\ufffd"

#: 结构检查与事实核验的边界说明（同时作为 CLI 最后一行输出）。
FACT_CHECK_DISCLAIMER = "结构检查不等同事实核验"


@dataclass
class CheckResult:
    """一次完整检查的结果。

    REQ-035；方案见 ``docs/knowledge_integrity.md``。

    属性：
        errors：结构问题描述列表，空列表表示结构检查通过。
        knowledge_count：外部默认知识库条目数，无法解析时为 None。
        packaged_knowledge_count：打包默认知识库条目数，无法解析时为 None。
        spots_count：景点数据条目数，无法解析时为 None。
        parity_checked：是否执行了「打包库 vs 外部库」语义一致性检查。
    """

    errors: List[str] = field(default_factory=list)
    knowledge_count: Optional[int] = None
    packaged_knowledge_count: Optional[int] = None
    spots_count: Optional[int] = None
    parity_checked: bool = False

    @property
    def ok(self) -> bool:
        """结构检查是否通过（errors 为空）。"""
        return not self.errors


def _display(path: Path) -> str:
    """把路径格式化为便于阅读的文本：仓库内用相对路径，仓库外用绝对路径。"""
    try:
        return str(Path(path).resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _type_name(value: Any) -> str:
    """返回值的类型名（用于错误信息，避免直接打印可能损坏的原始值）。"""
    return type(value).__name__


def _is_positive_int(value: Any) -> bool:
    """判断是否为真正的正整数（``bool`` 是 ``int`` 子类，必须排除）。"""
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def _iter_strings(value: Any, location: str) -> Any:
    """递归遍历 JSON 值中的全部字符串，产出 ``(位置, 字符串)``。

    REQ-035；用于统一检查 U+FFFD 替换字符，覆盖嵌套 dict/list 内的字符串。
    """
    if isinstance(value, str):
        yield location, value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from _iter_strings(item, "{0}.{1}".format(location, key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _iter_strings(item, "{0}[{1}]".format(location, index))


def load_json(path: Path) -> Tuple[Any, List[str]]:
    """读取 UTF-8 JSON 文件，返回 ``(解析结果, 错误列表)``。

    REQ-035；方案见 ``docs/knowledge_integrity.md``。

    参数：
        path：JSON 文件路径。
    返回：
        (data, errors)：解析成功时 errors 为空列表；读取失败、非 UTF-8 或
        JSON 语法错误时 data 为 None，errors 含一条中文错误描述。
    """
    path = Path(path)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return None, [
            "{0}: 无法读取文件（{1}: {2}）".format(_display(path), _type_name(exc), exc)
        ]
    except UnicodeDecodeError as exc:
        return None, [
            "{0}: 不是合法的 UTF-8 文本（UnicodeDecodeError: {1}）".format(
                _display(path), exc.reason
            )
        ]
    try:
        return json.loads(text), []
    except json.JSONDecodeError as exc:
        return None, [
            "{0}: JSON 解析失败（第 {1} 行第 {2} 列：{3}）".format(
                _display(path), exc.lineno, exc.colno, exc.msg
            )
        ]


def _check_content_not_title(data: List[Any], source: str) -> List[str]:
    """检查任一知识条目的 content 是否等于某条 title（正文/标题错配迹象）。

    REQ-035；方案见 ``docs/knowledge_integrity.md``（第 6 节：正文等于任一标题）。
    """
    errors: List[str] = []
    titles: Dict[str, List[Tuple[int, Any]]] = {}
    for index, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        title = item.get("title")
        if isinstance(title, str) and title.strip():
            titles.setdefault(title, []).append((index, item.get("id")))

    for index, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if not isinstance(content, str) or not content.strip():
            continue
        for other_index, other_id in titles.get(content, []):
            if other_index == index:
                errors.append(
                    "{0}[{1}]（id={2}）: content 与本条 title 完全相同，疑似正文/标题错配".format(
                        source, index, item.get("id")
                    )
                )
            else:
                errors.append(
                    "{0}[{1}]（id={2}）: content 等于 id={3} 的 title，疑似两条知识正文/标题错配".format(
                        source, index, item.get("id"), other_id
                    )
                )
    return errors


def validate_knowledge(data: Any, source: str = "knowledge") -> List[str]:
    """校验知识库结构，返回结构问题列表（空列表表示通过）。

    REQ-035；方案见 ``docs/knowledge_integrity.md``（第 6 节自动检查）。

    检查项：
        1. 顶层必须是 JSON 数组；合法的空数组 ``[]`` 视为通过。
        2. 每项必须是 JSON 对象。
        3. ``id`` 必须是正整数（``bool`` 不算），且全局唯一。
        4. ``title`` / ``category`` / ``content`` / ``keywords`` / ``createTime``
           必须存在且为非空字符串。
        5. 任意字符串（含 ``keywords`` 及嵌套值）不得含 U+FFFD 替换字符。
        6. ``content`` 不得等于任何一条 ``title``（含本条），否则提示疑似错配。

    参数：
        data：``json.loads`` 解析后的知识库数据。
        source：错误信息中使用的来源名（文件路径等）。
    返回：
        List[str]：问题描述列表；为空表示结构检查通过。
    """
    errors: List[str] = []
    if not isinstance(data, list):
        return ["{0}: 顶层必须是 JSON 数组(list)，实际为 {1}".format(source, _type_name(data))]
    if not data:  # 合法的空知识库视为通过
        return []

    first_index_by_id: Dict[int, int] = {}
    for index, item in enumerate(data):
        where = "{0}[{1}]".format(source, index)
        if not isinstance(item, dict):
            errors.append("{0}: 条目必须是 JSON 对象(dict)，实际为 {1}".format(where, _type_name(item)))
            continue

        ident = item.get("id")
        if not _is_positive_int(ident):
            errors.append("{0}: 字段 id 必须是正整数(int)，实际为 {1}".format(where, _type_name(ident)))
        elif ident in first_index_by_id:
            errors.append(
                "{0}: id={1} 与 {2}[{3}] 重复，知识库 id 必须全局唯一".format(
                    where, ident, source, first_index_by_id[ident]
                )
            )
        else:
            first_index_by_id[ident] = index

        for name in KNOWLEDGE_REQUIRED_STRING_FIELDS:
            if name not in item:
                errors.append("{0}: 缺少必填字段 {1}".format(where, name))
                continue
            value = item[name]
            if not isinstance(value, str):
                errors.append(
                    "{0}: 字段 {1} 必须是字符串，实际为 {2}".format(where, name, _type_name(value))
                )
            elif not value.strip():
                errors.append("{0}: 字段 {1} 不得为空字符串".format(where, name))

        for location, text in _iter_strings(item, where):
            if REPLACEMENT_CHAR in text:
                errors.append("{0}: 含 U+FFFD 替换字符（编码损坏迹象）".format(location))

    errors.extend(_check_content_not_title(data, source))
    return errors


def validate_spots(data: Any, source: str = "spots") -> List[str]:
    """校验景点数据结构，返回结构问题列表（空列表表示通过）。

    REQ-035；方案见 ``docs/knowledge_integrity.md``（第 6 节自动检查）。

    检查项：
        1. 顶层必须是 JSON 数组；合法的空数组 ``[]`` 视为通过。
        2. 每项必须是 JSON 对象。
        3. ``id`` 必须是正整数（``bool`` 不算），且全局唯一。
        4. ``name`` / ``brief`` / ``category`` / ``history`` / ``address`` /
           ``openingHours`` / ``ticket`` / ``transportation`` 必须存在且为非空字符串。
        5. ``highlights`` 必须存在、必须是数组，且每项为非空字符串。
        6. 任意字符串不得含 U+FFFD 替换字符。

    参数：
        data：``json.loads`` 解析后的景点数据。
        source：错误信息中使用的来源名（文件路径等）。
    返回：
        List[str]：问题描述列表；为空表示结构检查通过。
    """
    errors: List[str] = []
    if not isinstance(data, list):
        return ["{0}: 顶层必须是 JSON 数组(list)，实际为 {1}".format(source, _type_name(data))]
    if not data:
        return []

    first_index_by_id: Dict[int, int] = {}
    for index, item in enumerate(data):
        where = "{0}[{1}]".format(source, index)
        if not isinstance(item, dict):
            errors.append("{0}: 条目必须是 JSON 对象(dict)，实际为 {1}".format(where, _type_name(item)))
            continue

        ident = item.get("id")
        if not _is_positive_int(ident):
            errors.append("{0}: 字段 id 必须是正整数(int)，实际为 {1}".format(where, _type_name(ident)))
        elif ident in first_index_by_id:
            errors.append(
                "{0}: id={1} 与 {2}[{3}] 重复，景点 id 必须全局唯一".format(
                    where, ident, source, first_index_by_id[ident]
                )
            )
        else:
            first_index_by_id[ident] = index

        for name in SPOTS_REQUIRED_STRING_FIELDS:
            if name not in item:
                errors.append("{0}: 缺少必填字段 {1}".format(where, name))
                continue
            value = item[name]
            if not isinstance(value, str):
                errors.append(
                    "{0}: 字段 {1} 必须是字符串，实际为 {2}".format(where, name, _type_name(value))
                )
            elif not value.strip():
                errors.append("{0}: 字段 {1} 不得为空字符串".format(where, name))

        highlights = item.get("highlights")
        if "highlights" not in item:
            errors.append("{0}: 缺少必填字段 highlights".format(where))
        elif not isinstance(highlights, list):
            errors.append(
                "{0}: 字段 highlights 必须是数组(list)，实际为 {1}".format(
                    where, _type_name(highlights)
                )
            )
        else:
            for position, highlight in enumerate(highlights):
                if not isinstance(highlight, str):
                    errors.append(
                        "{0}.highlights[{1}]: 必须是字符串，实际为 {2}".format(
                            where, position, _type_name(highlight)
                        )
                    )
                elif not highlight.strip():
                    errors.append("{0}.highlights[{1}]: 不得为空字符串".format(where, position))

        for location, text in _iter_strings(item, where):
            if REPLACEMENT_CHAR in text:
                errors.append("{0}: 含 U+FFFD 替换字符（编码损坏迹象）".format(location))

    return errors


def check_parity(
    external_data: Any,
    packaged_data: Any,
    external_source: str = "data/knowledge.json",
    packaged_source: str = "src/main/resources/knowledge.json",
) -> List[str]:
    """比较打包默认库与外部默认库解析后的 JSON 语义是否一致（防漂移）。

    REQ-035；方案见 ``docs/knowledge_integrity.md``（第 6 节：打包/外部库一致）。

    只比较解析后的数据（语义），不比较文本格式或字节；两者语义相等时返回空列表。
    不一致时尽量指出条目的 id 与字段名。

    参数：
        external_data：外部默认库解析结果。
        packaged_data：打包默认库解析结果。
        external_source：外部库来源名（用于错误信息）。
        packaged_source：打包库来源名（用于错误信息）。
    返回：
        List[str]：漂移描述列表；为空表示一致。
    """
    if external_data == packaged_data:
        return []

    errors: List[str] = []
    if not isinstance(external_data, list) or not isinstance(packaged_data, list):
        errors.append(
            "打包库与外部库语义不一致：{0} 与 {1} 至少一方顶层不是数组".format(
                external_source, packaged_source
            )
        )
        return errors

    if len(external_data) != len(packaged_data):
        errors.append(
            "打包库与外部库条目数量不一致：{0} 有 {1} 条，{2} 有 {3} 条".format(
                external_source, len(external_data), packaged_source, len(packaged_data)
            )
        )

    shared = min(len(external_data), len(packaged_data))
    for index in range(shared):
        left = external_data[index]
        right = packaged_data[index]
        if left == right:
            continue
        if not isinstance(left, dict) or not isinstance(right, dict):
            errors.append(
                "第 {0} 条（索引 {1}）条目不一致：{2} 与 {3}".format(
                    index + 1, index, external_source, packaged_source
                )
            )
            continue
        left_id = left.get("id")
        right_id = right.get("id")
        if left_id != right_id:
            errors.append(
                "第 {0} 条（索引 {1}）id 不一致：{2} 中为 {3}，{4} 中为 {5}".format(
                    index + 1, index, external_source, left_id, packaged_source, right_id
                )
            )
            continue
        field_names = sorted(set(left) | set(right))
        drifted = [name for name in field_names if left.get(name) != right.get(name)]
        if drifted:
            errors.append(
                "id={0} 存在字段漂移：{1}（外部库 {2} vs 打包库 {3}）".format(
                    left_id, ", ".join(drifted), external_source, packaged_source
                )
            )
        else:
            errors.append(
                "id={0} 条目整体不一致（字段名相同但值不等）".format(left_id)
            )

    if len(external_data) > shared:
        extra_ids = [
            item.get("id") if isinstance(item, dict) else "索引{0}".format(position)
            for position, item in enumerate(external_data[shared:], start=shared)
        ]
        errors.append("外部库 {0} 多出条目：{1}".format(external_source, extra_ids))
    if len(packaged_data) > shared:
        extra_ids = [
            item.get("id") if isinstance(item, dict) else "索引{0}".format(position)
            for position, item in enumerate(packaged_data[shared:], start=shared)
        ]
        errors.append("打包库 {0} 多出条目：{1}".format(packaged_source, extra_ids))

    return errors


def run_checks(
    knowledge_path: Path = DEFAULT_KNOWLEDGE_PATH,
    packaged_knowledge_path: Path = DEFAULT_PACKAGED_KNOWLEDGE_PATH,
    spots_path: Path = DEFAULT_SPOTS_PATH,
) -> CheckResult:
    """加载并检查默认知识库、打包知识库、景点数据，返回汇总结果。

    REQ-035；方案见 ``docs/knowledge_integrity.md``（第 6 节自动检查）。

    参数：
        knowledge_path：外部默认知识库路径。
        packaged_knowledge_path：打包默认知识库路径。
        spots_path：景点数据路径。
    返回：
        CheckResult：包含全部结构问题、各文件条目数以及是否执行一致性检查。
    异常：
        不抛出预期内的异常；读取/解析问题都转成 ``errors`` 文本。
    """
    result = CheckResult()

    knowledge, knowledge_errors = load_json(knowledge_path)
    result.errors.extend(knowledge_errors)
    if not knowledge_errors:
        if isinstance(knowledge, list):
            result.knowledge_count = len(knowledge)
        result.errors.extend(validate_knowledge(knowledge, _display(knowledge_path)))

    packaged, packaged_errors = load_json(packaged_knowledge_path)
    result.errors.extend(packaged_errors)
    if not packaged_errors:
        if isinstance(packaged, list):
            result.packaged_knowledge_count = len(packaged)
        result.errors.extend(validate_knowledge(packaged, _display(packaged_knowledge_path)))

    spots, spots_errors = load_json(spots_path)
    result.errors.extend(spots_errors)
    if not spots_errors:
        if isinstance(spots, list):
            result.spots_count = len(spots)
        result.errors.extend(validate_spots(spots, _display(spots_path)))

    if not knowledge_errors and not packaged_errors:
        result.parity_checked = True
        result.errors.extend(
            check_parity(
                knowledge,
                packaged,
                _display(knowledge_path),
                _display(packaged_knowledge_path),
            )
        )

    return result


def _configure_console() -> None:
    """尽量让 stdout/stderr 在遇到不可编码字符时替换而不是抛异常（仅影响输出）。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(errors="replace")
        except (ValueError, OSError):
            pass


def _format_count(count: Optional[int]) -> str:
    """把条目数格式化为 CLI 文本；无法统计时返回占位说明。"""
    return "{0} 条".format(count) if count is not None else "无法统计"


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI 入口：执行结构检查并返回进程退出码。

    REQ-035；方案见 ``docs/knowledge_integrity.md``（第 6 节自动检查）。

    参数：
        argv：命令行参数列表（不含程序名）；None 时使用 ``sys.argv[1:]``。
    返回：
        0 表示结构检查通过，1 表示发现问题；``--help`` 由 argparse 直接退出 0。
    """
    parser = argparse.ArgumentParser(
        prog="check_data_integrity.py",
        description=(
            "REQ-035 知识库与景点数据结构检查（只读，结构检查不等同事实核验）。"
            "方案见 docs/knowledge_integrity.md。"
        ),
    )
    parser.add_argument(
        "--knowledge",
        type=Path,
        default=DEFAULT_KNOWLEDGE_PATH,
        help="外部默认知识库路径（默认：data/knowledge.json）",
    )
    parser.add_argument(
        "--packaged-knowledge",
        type=Path,
        default=DEFAULT_PACKAGED_KNOWLEDGE_PATH,
        help="打包默认知识库路径（默认：src/main/resources/knowledge.json）",
    )
    parser.add_argument(
        "--spots",
        type=Path,
        default=DEFAULT_SPOTS_PATH,
        help="景点数据路径（默认：src/main/resources/spots.json）",
    )
    args = parser.parse_args(argv)

    _configure_console()
    result = run_checks(args.knowledge, args.packaged_knowledge, args.spots)

    print("REQ-035 数据完整性结构检查")
    print("  外部默认知识库 {0}: {1}".format(_display(args.knowledge), _format_count(result.knowledge_count)))
    print(
        "  打包默认知识库 {0}: {1}".format(
            _display(args.packaged_knowledge), _format_count(result.packaged_knowledge_count)
        )
    )
    print("  景点数据 {0}: {1}".format(_display(args.spots), _format_count(result.spots_count)))
    print(
        "  打包库与外部库语义一致性: {0}".format(
            "已检查" if result.parity_checked else "未检查（存在解析错误）"
        )
    )

    for message in result.errors:
        print("  - {0}".format(message))

    if result.errors:
        print("FAILED: 发现 {0} 个结构问题".format(len(result.errors)))
        print(FACT_CHECK_DISCLAIMER)
        return 1

    print("OK: 结构检查通过")
    print(FACT_CHECK_DISCLAIMER)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
