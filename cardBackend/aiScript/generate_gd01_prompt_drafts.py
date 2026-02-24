#!/usr/bin/env python3
"""
Generate draft prompts for each card in gd01Card.json.

This script intentionally does not call any AI agent/API.
It only prepares prompt payloads for manual review and later execution.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path(
    "/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json"
)
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data" / "draft_run"
DEFAULT_EXISTING_TEST_DIR = Path(
    "/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01"
)

PROMPT_TEMPLATE = (
    "based on my context in createGameEnvTest agent skill, i want to create test case "
    "for {card_id} to test {effect_description} dont change code and dont start write test "
    "case frontend. help me thin of what is the gameEnv should be and what manual step i need "
    "to do. if u dont understand the effect , ask me. you can look at createGameEnvTest agent "
    "skill in "
    "/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/skil/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/agentOnboarding "
    "if you can clear use createGameEnvTest agent skill to do create the test environment file "
    "(json) for me, please add in DebugControls.ts as skill required"
)

# Effects covered by shared tests and safe to ignore in per-card prompt generation.
IGNORED_EXACT_EFFECTS = {
    "[Burst]Deploy this card.",
    "[Deploy]Add 1 of your Shields to your hand.",
    "<Repair 1> (At the end of your turn, this Unit recovers the specified number of HP.)",
    "<Blocker> (Rest this Unit to change the attack target to it.)",
}


def _extract_effect_lines(card: dict[str, Any]) -> list[str]:
    effects = card.get("effects", {})
    raw = effects.get("description", "")

    if isinstance(raw, str):
        text = raw.strip()
        return [text] if text else []

    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]

    return []


def _normalize_effect_description(card: dict[str, Any]) -> str:
    lines = _extract_effect_lines(card)
    return " and ".join(lines) if lines else "(no effect description)"


def get_existing_tested_card_ids(existing_test_dir: Path) -> set[str]:
    if not existing_test_dir.exists() or not existing_test_dir.is_dir():
        return set()
    return {
        child.name
        for child in existing_test_dir.iterdir()
        if child.is_dir() and child.name.strip()
    }


def generate_prompt_records(
    data: dict[str, Any], existing_tested_ids: set[str]
) -> list[dict[str, Any]]:
    cards = data.get("cards")
    if not isinstance(cards, dict):
        raise ValueError("Invalid input JSON: expected `cards` object")

    records: list[dict[str, Any]] = []
    for card_id, card in cards.items():
        if not isinstance(card, dict):
            continue

        resolved_card_id = str(card.get("id", card_id))
        if resolved_card_id in existing_tested_ids:
            continue

        all_effect_lines = _extract_effect_lines(card)
        kept_effect_lines = [
            line for line in all_effect_lines if line not in IGNORED_EXACT_EFFECTS
        ]
        ignored_effect_lines = [
            line for line in all_effect_lines if line in IGNORED_EXACT_EFFECTS
        ]

        # If no effect remains after ignore-rules, skip this card in prompt drafts.
        if not kept_effect_lines:
            continue

        effect_description = " and ".join(kept_effect_lines)
        prompt = PROMPT_TEMPLATE.format(
            card_id=resolved_card_id, effect_description=effect_description
        )

        records.append(
            {
                "cardId": resolved_card_id,
                "cardName": str(card.get("name", "")),
                "effectDescription": effect_description,
                "ignoredEffects": ignored_effect_lines,
                "prompt": prompt,
            }
        )

    return records


def write_outputs(records: list[dict[str, str]], output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "gd01_prompt_drafts.json"
    jsonl_path = output_dir / "gd01_prompt_drafts.jsonl"

    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    with jsonl_path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    return json_path, jsonl_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate draft prompts for all cards in gd01Card.json"
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Path to source card JSON (default: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for generated draft files (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--existing-test-dir",
        type=Path,
        default=DEFAULT_EXISTING_TEST_DIR,
        help=(
            "Directory that contains existing card test folders to skip "
            f"(default: {DEFAULT_EXISTING_TEST_DIR})"
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = args.input
    output_dir = args.output_dir
    existing_test_dir = args.existing_test_dir

    if not source.exists():
        raise FileNotFoundError(f"Input file not found: {source}")

    data = json.loads(source.read_text(encoding="utf-8"))
    existing_tested_ids = get_existing_tested_card_ids(existing_test_dir)
    records = generate_prompt_records(data, existing_tested_ids)
    json_path, jsonl_path = write_outputs(records, output_dir)

    print(f"Generated {len(records)} prompt draft(s).")
    print(f"Skipped {len(existing_tested_ids)} card(s) due to existing test folders.")
    print(f"JSON:  {json_path}")
    print(f"JSONL: {jsonl_path}")


if __name__ == "__main__":
    main()
