#!/usr/bin/env python3
"""
Run GD01 prompt drafts through Codex via OpenAI Agents SDK.

Default mode is dry-run and does not call any API.
Use --run to execute real calls.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path(__file__).resolve().parent / "data" / "draft_run" / "gd01_prompt_drafts.json"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data" / "agent_runs"
DEFAULT_WORKSPACE_CWD = Path(__file__).resolve().parent.parent


@dataclass
class PromptRecord:
    card_id: str
    card_name: str
    prompt: str


def now_utc_tag() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run prompt drafts with OpenAI Agents SDK + Codex MCP server"
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Input prompt draft JSON")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory for run artifacts",
    )
    parser.add_argument(
        "--workspace-cwd",
        "--working-dir",
        dest="workspace_cwd",
        type=Path,
        default=DEFAULT_WORKSPACE_CWD,
        help="Working directory path Codex should use when running tool calls",
    )
    parser.add_argument("--model", default="gpt-5", help="Planner model used by Agents SDK")
    parser.add_argument("--max-turns", type=int, default=20, help="Max turns per prompt")
    parser.add_argument("--start-index", type=int, default=0, help="Start index in prompt list")
    parser.add_argument("--max-cards", type=int, default=0, help="Limit number of prompts (0 = all)")
    parser.add_argument(
        "--approval-policy",
        default="never",
        choices=["never", "on-request", "untrusted"],
        help="Codex approval policy",
    )
    parser.add_argument(
        "--sandbox",
        default="workspace-write",
        choices=["read-only", "workspace-write", "danger-full-access"],
        help="Codex sandbox mode",
    )
    parser.add_argument("--profile", default="", help="Optional Codex profile from config.toml")
    parser.add_argument(
        "--run",
        action="store_true",
        help="Execute real API calls. If omitted, script only prepares dry-run outputs.",
    )
    return parser.parse_args()


def load_prompt_records(path: Path) -> list[PromptRecord]:
    if not path.exists():
        raise FileNotFoundError(f"Input prompt file not found: {path}")

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Input JSON must be a list of prompt records.")

    records: list[PromptRecord] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        card_id = str(item.get("cardId", "")).strip()
        card_name = str(item.get("cardName", "")).strip()
        prompt = str(item.get("prompt", "")).strip()
        if not card_id or not prompt:
            continue
        records.append(PromptRecord(card_id=card_id, card_name=card_name, prompt=prompt))
    return records


def validate_workspace_dir(workspace_dir: Path) -> Path:
    resolved = workspace_dir.resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"Working directory does not exist: {resolved}")
    if not resolved.is_dir():
        raise NotADirectoryError(f"Working directory is not a directory: {resolved}")
    return resolved


def select_records(records: list[PromptRecord], start_index: int, max_cards: int) -> list[PromptRecord]:
    sliced = records[start_index:] if start_index > 0 else records
    if max_cards > 0:
        sliced = sliced[:max_cards]
    return sliced


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def build_agent_instructions(
    approval_policy: str, sandbox: str, workspace_cwd: Path, profile: str
) -> str:
    profile_line = f' and "profile":"{profile}"' if profile else ""
    return (
        "You run card test-planning prompts using Codex MCP. "
        "For file/system work, call the codex tool and include "
        f'"approval-policy":"{approval_policy}", "sandbox":"{sandbox}", "cwd":"{workspace_cwd}"'
        f"{profile_line}. "
        "Do not write frontend test cases and do not change source code. "
        "Focus only on gameEnv setup JSON suggestions and manual verification steps. "
        "If an effect is unclear, ask clarifying questions."
    )


async def execute_records(args: argparse.Namespace, selected: list[PromptRecord], run_tag: str) -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        load_dotenv = None

    if load_dotenv is not None:
        load_dotenv(override=False)

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for --run mode.")

    from agents import Agent, Runner, set_default_openai_api
    from agents.mcp import MCPServerStdio

    set_default_openai_api(api_key)

    workspace_dir = validate_workspace_dir(args.workspace_cwd)

    instructions = build_agent_instructions(
        approval_policy=args.approval_policy,
        sandbox=args.sandbox,
        workspace_cwd=workspace_dir,
        profile=args.profile.strip(),
    )

    output_dir = args.output_dir
    result_jsonl = output_dir / f"gd01_agents_results_{run_tag}.jsonl"
    result_json = output_dir / f"gd01_agents_results_{run_tag}.json"

    rows: list[dict[str, Any]] = []
    run_meta = {
        "runTag": run_tag,
        "mode": "run",
        "workspaceDir": str(workspace_dir),
        "model": args.model,
        "approvalPolicy": args.approval_policy,
        "sandbox": args.sandbox,
        "maxTurns": args.max_turns,
    }

    async with MCPServerStdio(
        name="Codex CLI",
        params={"command": "npx", "args": ["-y", "codex", "mcp-server"]},
        client_session_timeout_seconds=360000,
    ) as codex_mcp_server:
        agent = Agent(
            name="GD01 Test Planner Runner",
            instructions=instructions,
            model=args.model,
            mcp_servers=[codex_mcp_server],
        )

        for index, rec in enumerate(selected):
            print(f"[{index + 1}/{len(selected)}] Running {rec.card_id} {rec.card_name}")
            try:
                result = await Runner.run(agent, rec.prompt, max_turns=args.max_turns)
                output = getattr(result, "final_output", "")
                rows.append(
                    {
                        **run_meta,
                        "cardId": rec.card_id,
                        "cardName": rec.card_name,
                        "status": "ok",
                        "output": output,
                    }
                )
            except Exception as exc:  # noqa: BLE001
                rows.append(
                    {
                        **run_meta,
                        "cardId": rec.card_id,
                        "cardName": rec.card_name,
                        "status": "error",
                        "error": str(exc),
                    }
                )

    write_jsonl(result_jsonl, rows)
    write_json(result_json, rows)
    print(f"Saved results:\n- {result_json}\n- {result_jsonl}")


def dry_run(args: argparse.Namespace, selected: list[PromptRecord], run_tag: str) -> None:
    workspace_dir = validate_workspace_dir(args.workspace_cwd)
    output_dir = args.output_dir
    plan_json = output_dir / f"gd01_agents_plan_{run_tag}.json"
    plan_jsonl = output_dir / f"gd01_agents_plan_{run_tag}.jsonl"

    plan_rows = [
        {
            "runTag": run_tag,
            "mode": "dry-run",
            "workspaceDir": str(workspace_dir),
            "model": args.model,
            "approvalPolicy": args.approval_policy,
            "sandbox": args.sandbox,
            "maxTurns": args.max_turns,
            "cardId": rec.card_id,
            "cardName": rec.card_name,
            "prompt": rec.prompt,
        }
        for rec in selected
    ]

    write_json(plan_json, plan_rows)
    write_jsonl(plan_jsonl, plan_rows)
    print("Dry run only (no API calls made).")
    print(f"Working directory: {workspace_dir}")
    print(f"Prepared {len(plan_rows)} prompt(s).")
    print(f"Plan files:\n- {plan_json}\n- {plan_jsonl}")


def main() -> None:
    args = parse_args()
    records = load_prompt_records(args.input)
    selected = select_records(records, start_index=args.start_index, max_cards=args.max_cards)
    run_tag = now_utc_tag()

    if not selected:
        print("No prompts selected. Nothing to do.")
        return

    if args.run:
        asyncio.run(execute_records(args, selected, run_tag))
    else:
        dry_run(args, selected, run_tag)


if __name__ == "__main__":
    main()
