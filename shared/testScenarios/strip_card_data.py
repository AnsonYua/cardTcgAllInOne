#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import signal
from pathlib import Path
from typing import Any


def _strip_card_data_recursive(node: Any) -> int:
    if isinstance(node, list):
        return sum(_strip_card_data_recursive(item) for item in node)

    if not isinstance(node, dict):
        return 0

    removed = 0
    if "cardData" in node and ("cardId" in node or "carduid" in node):
        del node["cardData"]
        removed += 1

    for value in node.values():
        removed += _strip_card_data_recursive(value)

    return removed


def strip_card_data(document: Any) -> int:
    if not isinstance(document, dict):
        return 0

    initial_game_env = document.get("initialGameEnv")
    if isinstance(initial_game_env, dict):
        return _strip_card_data_recursive(initial_game_env)

    return 0


def _iter_json_files(root: Path) -> list[Path]:
    return sorted([p for p in root.rglob("*.json") if p.is_file()])


def main() -> int:
    try:
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    except Exception:
        pass

    parser = argparse.ArgumentParser(
        description=(
            "Remove embedded 'cardData' from deck.hand and slot*.unit/slot*.pilot in scenario JSON files."
        )
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=str(Path.cwd() / "gameStates"),
        help="Root folder to scan (default: ./gameStates).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report changes without writing files.",
    )
    parser.add_argument(
        "--include-backups",
        action="store_true",
        help="Also process folders whose name ends with '_bk'.",
    )
    args = parser.parse_args()

    root = Path(os.path.expanduser(args.root)).resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"Root folder not found or not a directory: {root}")

    json_files = _iter_json_files(root)
    if not args.include_backups:
        json_files = [p for p in json_files if "_bk" not in p.parts]

    changed_files = 0
    total_removed = 0

    for path in json_files:
        original = path.read_text(encoding="utf-8")
        try:
            doc = json.loads(original)
        except json.JSONDecodeError as e:
            raise SystemExit(f"Invalid JSON: {path} ({e})")

        removed = strip_card_data(doc)
        total_removed += removed
        if removed == 0:
            continue

        new_text = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
        if new_text == original:
            continue

        changed_files += 1
        print(f"{path}: removed {removed} cardData entr{'y' if removed == 1 else 'ies'}")

        if not args.dry_run:
            path.write_text(new_text, encoding="utf-8")

    print(f"Done. Files changed: {changed_files}. cardData removed: {total_removed}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
