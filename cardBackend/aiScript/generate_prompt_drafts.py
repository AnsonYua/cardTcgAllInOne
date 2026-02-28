#!/usr/bin/env python3
"""
Generate draft prompts for each card set (for example, gd01/gd02).

This script intentionally does not call any AI agent/API.
It only prepares prompt payloads for manual review and later execution.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
import re


DEFAULT_SET_ID = "gd01"
BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data" / "draft_run"

PROMPT_TEMPLATE = (
    "based on my context in createGameEnvTest agent skill, i want to create test case "
    "for {card_id} to test {effect_description} dont change code and dont start write test "
    "case frontend. help me thin of what is the gameEnv should be and what manual step i need "
    "to do. if u dont understand the effect ,ask me. you can look at createGameEnvTest agent skill in /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/skil/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/agentOnboarding if you can clear use createGameEnvTest agent skill to do create the test environment file (json) for me, make sure u add the test scenoria file path to const SCENARIO_PRESET_GROUPS =  in make sure u add the test scenoria file path to const SCENARIO_PRESET_GROUPS =  in /Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/DebugControls.ts as skill required (not /Users/hello/Desktop/card/unity/cardGameRevamp/cardFrontend/src/phaser/controllers/DebugControls.ts)) as skill required"
)

# Effects covered by shared tests and safe to ignore in per-card prompt generation.
IGNORED_EXACT_EFFECTS = {
    "[Burst]Deploy this card.",
    "[Deploy]Add 1 of your Shields to your hand.",
    "<Repair 1> (At the end of your turn, this Unit recovers the specified number of HP.)",
    "<Blocker> (Rest this Unit to change the attack target to it.)",
}

FALLBACK_EMPTY_EFFECT_DESCRIPTION = (
    "(no effect description in source card JSON; validate this card's intended behavior and "
    "prepare a scenario to verify its in-game behavior)"
)

FALLBACK_IGNORED_ONLY_EFFECT_DESCRIPTION = (
    "(only shared/ignored effects are present in source card JSON; create a scenario to verify "
    "the shared keyword behavior for this card)"
)


def normalize_set_id(value: str) -> str:
    set_id = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", set_id):
        raise ValueError(f"Invalid --set-id: {value!r}. Use lowercase letters, digits, '_' or '-'.")
    return set_id


def default_input_for_set(set_id: str) -> Path:
    return BACKEND_ROOT / "src" / "data" / f"{set_id}Card.json"


def default_existing_test_dir_for_set(set_id: str) -> Path:
    return BACKEND_ROOT / "shared" / "testScenarios" / "gameStates" / set_id.upper()


def default_output_stem_for_set(set_id: str) -> str:
    return f"{set_id}_prompt_drafts"


def _extract_effect_lines(card: dict[str, Any]) -> list[str]:
    effects = card.get("effects", {})
    raw = effects.get("description", "")

    if isinstance(raw, str):
        text = raw.strip()
        return [text] if text else []

    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item).strip()]

    return []


def get_existing_tested_card_ids(existing_test_dir: Path) -> set[str]:
    if not existing_test_dir.exists() or not existing_test_dir.is_dir():
        return set()
    return {
        child.name
        for child in existing_test_dir.iterdir()
        if child.is_dir() and child.name.strip()
    }


def generate_prompt_records(
    data: dict[str, Any], existing_tested_ids: set[str], include_empty_effects: bool
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

        # If no effect remains after ignore-rules, either skip or include with fallback text.
        if not kept_effect_lines:
            if not include_empty_effects:
                continue
            if not all_effect_lines:
                effect_description = FALLBACK_EMPTY_EFFECT_DESCRIPTION
            else:
                effect_description = FALLBACK_IGNORED_ONLY_EFFECT_DESCRIPTION
        else:
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


def write_outputs(
    records: list[dict[str, str]], output_dir: Path, output_stem: str
) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / f"{output_stem}.json"
    jsonl_path = output_dir / f"{output_stem}.jsonl"

    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    with jsonl_path.open("w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    return json_path, jsonl_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate draft prompts for all cards in a set JSON (for example gd01/gd02)."
    )
    parser.add_argument(
        "--set-id",
        default=DEFAULT_SET_ID,
        help=f"Card set id (default: {DEFAULT_SET_ID}), for example gd01 or gd02.",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Path to source card JSON. If omitted, uses src/data/<set-id>Card.json.",
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
        default=None,
        help=(
            "Directory with existing card test folders to skip. "
            "If omitted, uses shared/testScenarios/gameStates/<SET-ID-UPPER>."
        ),
    )
    parser.add_argument(
        "--include-empty-effects",
        action="store_true",
        help="Include cards with empty/ignored-only effects using fallback effect descriptions.",
    )
    parser.add_argument(
        "--output-stem",
        default="",
        help="Output file stem. If omitted, uses <set-id>_prompt_drafts.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.set_id = normalize_set_id(args.set_id)
    source = args.input or default_input_for_set(args.set_id)
    output_dir = args.output_dir
    existing_test_dir = args.existing_test_dir or default_existing_test_dir_for_set(args.set_id)
    output_stem = args.output_stem.strip() or default_output_stem_for_set(args.set_id)

    if not source.exists():
        raise FileNotFoundError(f"Input file not found: {source}")

    data = json.loads(source.read_text(encoding="utf-8"))
    existing_tested_ids = get_existing_tested_card_ids(existing_test_dir)
    records = generate_prompt_records(
        data, existing_tested_ids, include_empty_effects=args.include_empty_effects
    )
    json_path, jsonl_path = write_outputs(records, output_dir, output_stem=output_stem)

    print(f"Generated {len(records)} prompt draft(s).")
    print(f"Skipped {len(existing_tested_ids)} card(s) due to existing test folders.")
    print(f"JSON:  {json_path}")
    print(f"JSONL: {jsonl_path}")


if __name__ == "__main__":
    main()
