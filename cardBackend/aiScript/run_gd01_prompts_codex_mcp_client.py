#!/usr/bin/env python3
"""
Run GD01 prompt drafts through Codex MCP directly (no OpenAI Agents SDK).

Auth is handled by local Codex CLI session (for example, `codex login`).
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import re


DEFAULT_INPUT = Path(__file__).resolve().parent / "data" / "draft_run" / "gd01_prompt_drafts.json"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data" / "agent_runs"
DEFAULT_WORKING_DIR = Path(__file__).resolve().parent.parent


def now_utc_tag() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run prompt drafts via direct Codex MCP client")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--working-dir",
        dest="working_dirs",
        type=Path,
        action="append",
        default=None,
        help="Can be passed multiple times to run the same prompt selection against multiple directories.",
    )
    parser.add_argument("--start-index", type=int, default=0)
    parser.add_argument("--max-cards", type=int, default=0, help="0 means all")
    parser.add_argument("--timeout-seconds", type=int, default=600)
    parser.add_argument("--approval-policy", default="never", choices=["never", "on-request", "untrusted"])
    parser.add_argument(
        "--sandbox", default="workspace-write", choices=["read-only", "workspace-write", "danger-full-access"]
    )
    parser.add_argument("--model", default="")
    parser.add_argument("--profile", default="")
    parser.add_argument(
        "--skill-file",
        type=Path,
        default=None,
        help=(
            "Optional absolute/relative path to a skill markdown file to inject into each prompt. "
            "If omitted, script tries requirement/skills/createGameEnvTest/SKILL.md under each working dir."
        ),
    )
    parser.add_argument(
        "--no-skill-injection",
        action="store_true",
        help="Disable automatic skill injection.",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true", help="Print MCP debug events")
    parser.add_argument(
        "--print-conversation",
        action="store_true",
        help="Print returned conversation/output text for each card",
    )
    return parser.parse_args()


def load_prompts(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Input JSON must be a list.")
    rows: list[dict[str, str]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        card_id = str(item.get("cardId", "")).strip()
        card_name = str(item.get("cardName", "")).strip()
        prompt = str(item.get("prompt", "")).strip()
        if not card_id or not prompt:
            continue
        rows.append({"cardId": card_id, "cardName": card_name, "prompt": prompt})
    return rows


def select_rows(rows: list[dict[str, str]], start_index: int, max_cards: int) -> list[dict[str, str]]:
    out = rows[start_index:] if start_index > 0 else rows
    if max_cards > 0:
        out = out[:max_cards]
    return out


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def slugify_working_dir(path: Path) -> str:
    parts = [p for p in path.resolve().parts if p not in ("/", "\\")]
    tail = "-".join(parts[-3:]) if parts else "root"
    return re.sub(r"[^A-Za-z0-9._-]+", "-", tail).strip("-") or "working-dir"


def resolve_skill_file(args: argparse.Namespace, working_dir: Path) -> Path | None:
    if args.no_skill_injection:
        return None

    if args.skill_file:
        candidate = args.skill_file.resolve()
        return candidate if candidate.exists() and candidate.is_file() else None

    default_candidates = [
        working_dir / "requirement" / "skills" / "createGameEnvTest" / "SKILL.md",
        working_dir / "requirement" / "skills" / "createGameEnvTest.md",
    ]
    for candidate in default_candidates:
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def load_skill_text(skill_file: Path | None) -> str:
    if skill_file is None:
        return ""
    return skill_file.read_text(encoding="utf-8").strip()


def compose_prompt_with_skill(prompt: str, skill_text: str, skill_file: Path | None) -> str:
    if not skill_text:
        return prompt
    source_label = str(skill_file) if skill_file else "(unknown skill source)"
    return (
        "Use the following skill instructions as highest-priority local guidance for this task.\n"
        f"Skill source: {source_label}\n\n"
        f"{skill_text}\n\n"
        "Now complete the user task below.\n\n"
        f"{prompt}"
    )


class CodexMCPClient:
    def __init__(self, timeout_seconds: int, verbose: bool = False) -> None:
        self.timeout_seconds = timeout_seconds
        self.verbose = verbose
        self.proc: asyncio.subprocess.Process | None = None
        self._id = 1
        self._stderr_task: asyncio.Task[None] | None = None

    async def __aenter__(self) -> "CodexMCPClient":
        self.proc = await asyncio.create_subprocess_exec(
            "npx",
            "-y",
            "codex",
            "mcp-server",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            # Codex events can be large; raise reader buffer limit to avoid readline overrun.
            limit=1024 * 1024 * 8,
        )
        self._stderr_task = asyncio.create_task(self._pump_stderr())
        print("Started Codex MCP server process.")
        await self._initialize()
        print("Codex MCP initialize completed.")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self.proc is None:
            return
        if self.proc.stdin:
            self.proc.stdin.close()
        try:
            await asyncio.wait_for(self.proc.wait(), timeout=2)
        except asyncio.TimeoutError:
            self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=2)
            except asyncio.TimeoutError:
                self.proc.kill()
                await self.proc.wait()
        if self._stderr_task is not None:
            self._stderr_task.cancel()
            try:
                await self._stderr_task
            except asyncio.CancelledError:
                pass

    async def _pump_stderr(self) -> None:
        if self.proc is None or self.proc.stderr is None:
            return
        while True:
            line = await self.proc.stderr.readline()
            if line == b"":
                return
            text = line.decode("utf-8", errors="replace").rstrip()
            if text:
                print(f"[codex-mcp] {text}")

    async def _read_message(self) -> dict[str, Any]:
        if self.proc is None or self.proc.stdout is None:
            raise RuntimeError("MCP process is not running.")

        first_line = await self.proc.stdout.readline()
        if first_line == b"":
            raise RuntimeError("Codex MCP server closed stdout.")

        # Preferred: newline-delimited JSON-RPC over stdio.
        stripped = first_line.strip()
        if stripped and not stripped.lower().startswith(b"content-length:"):
            return json.loads(stripped.decode("utf-8"))

        # Compatibility fallback for Content-Length framed responses.
        content_length: int | None = None
        line = first_line
        while True:
            if line == b"":
                raise RuntimeError("Codex MCP server closed stdout.")
            if line in (b"\r\n", b"\n"):
                break
            text = line.decode("utf-8", errors="replace").strip()
            if ":" in text:
                key, value = text.split(":", 1)
                if key.lower().strip() == "content-length":
                    content_length = int(value.strip())
            line = await self.proc.stdout.readline()

        if content_length is None:
            raise RuntimeError("Invalid MCP framed message: missing Content-Length.")

        body = await self.proc.stdout.readexactly(content_length)
        return json.loads(body.decode("utf-8"))

    async def _write_message(self, payload: dict[str, Any]) -> None:
        if self.proc is None or self.proc.stdin is None:
            raise RuntimeError("MCP process is not running.")
        # Codex MCP server expects JSON-RPC messages as JSON lines over stdio.
        body = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        self.proc.stdin.write(body)
        await self.proc.stdin.drain()

    async def _request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        req_id = self._id
        self._id += 1
        payload: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
        if params is not None:
            payload["params"] = params
        await self._write_message(payload)

        while True:
            message = await asyncio.wait_for(self._read_message(), timeout=self.timeout_seconds)

            # Handle server request by returning method-not-found.
            if "method" in message and "id" in message and message.get("id") is not None:
                if self.verbose:
                    print(f"[mcp] server request: {message.get('method')}")
                await self._write_message(
                    {
                        "jsonrpc": "2.0",
                        "id": message["id"],
                        "error": {"code": -32601, "message": "Method not supported by this client"},
                    }
                )
                continue

            if self.verbose and "method" in message and message.get("id") is None:
                method_name = str(message.get("method"))
                params_obj = message.get("params", {})
                if method_name == "codex/event" and isinstance(params_obj, dict):
                    # Codex event payloads can be under params.msg or params.event.
                    event_obj = params_obj.get("msg")
                    if event_obj is None:
                        event_obj = params_obj.get("event")
                    event_name = "unknown"
                    status = params_obj.get("status")
                    summary: str | None = None
                    thread_id = params_obj.get("threadId") or params_obj.get("conversationId")

                    if isinstance(event_obj, dict):
                        event_name = str(
                            event_obj.get("type")
                            or event_obj.get("name")
                            or event_obj.get("event")
                            or "unknown"
                        )
                        status = status or event_obj.get("status")
                        summary = (
                            event_obj.get("summary")
                            or event_obj.get("message")
                            or event_obj.get("delta")
                            or event_obj.get("text")
                            or event_obj.get("output")
                        )
                        thread_id = thread_id or event_obj.get("threadId")
                    elif isinstance(event_obj, str):
                        event_name = event_obj
                    else:
                        event_name = str(
                            params_obj.get("type")
                            or params_obj.get("name")
                            or params_obj.get("event")
                            or "unknown"
                        )
                        summary = params_obj.get("summary") or params_obj.get("message")

                    pieces = [f"[mcp] codex/event: {event_name}"]
                    if status:
                        pieces.append(f"status={status}")
                    if thread_id:
                        pieces.append(f"threadId={thread_id}")
                    if isinstance(summary, str) and summary.strip():
                        trimmed = summary.strip().replace("\n", " ")
                        pieces.append(f"msg={trimmed[:180]}")
                    elif event_name == "unknown":
                        pieces.append(f"keys={list(params_obj.keys())[:6]}")
                    print(" ".join(pieces))
                else:
                    print(f"[mcp] notification: {method_name}")

            if message.get("id") != req_id:
                continue
            if "error" in message:
                raise RuntimeError(f"MCP error on {method}: {message['error']}")
            return message.get("result", {})

    async def _notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        payload: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        await self._write_message(payload)

    async def _initialize(self) -> None:
        await self._request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "gd01-codex-mcp-client", "version": "0.1.0"},
            },
        )
        await self._notify("notifications/initialized", {})

    async def list_tools(self) -> dict[str, Any]:
        return await self._request("tools/list", {})

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return await self._request("tools/call", {"name": name, "arguments": arguments})


def build_codex_args(
    row: dict[str, str], args: argparse.Namespace, working_dir: Path, skill_text: str, skill_file: Path | None
) -> dict[str, Any]:
    codex_args: dict[str, Any] = {
        "prompt": compose_prompt_with_skill(row["prompt"], skill_text, skill_file),
        "cwd": str(working_dir.resolve()),
        "sandbox": args.sandbox,
        "approval-policy": args.approval_policy,
    }
    if args.model:
        codex_args["model"] = args.model
    if args.profile:
        codex_args["profile"] = args.profile
    return codex_args


def _extract_text_chunks_from_obj(obj: Any) -> list[str]:
    chunks: list[str] = []
    if obj is None:
        return chunks
    if isinstance(obj, str):
        s = obj.strip()
        if s:
            chunks.append(s)
        return chunks
    if isinstance(obj, dict):
        for key in ("text", "message", "summary", "content", "output", "finalOutput", "final_output"):
            if key in obj:
                chunks.extend(_extract_text_chunks_from_obj(obj.get(key)))
        return chunks
    if isinstance(obj, list):
        for item in obj:
            chunks.extend(_extract_text_chunks_from_obj(item))
        return chunks
    return chunks


def extract_result_text(result: dict[str, Any]) -> str:
    texts: list[str] = []

    # Legacy/content-first path
    content = result.get("content")
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                texts.extend(_extract_text_chunks_from_obj(item.get("text")))
            else:
                texts.extend(_extract_text_chunks_from_obj(item))

    # Structured payload often carries final output in Codex MCP.
    structured = result.get("structuredContent")
    texts.extend(_extract_text_chunks_from_obj(structured))

    # Fallback: scan top-level keys.
    texts.extend(_extract_text_chunks_from_obj(result))

    # De-duplicate while preserving order.
    deduped: list[str] = []
    seen: set[str] = set()
    for t in texts:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return "\n".join(deduped).strip()


async def run_real(
    args: argparse.Namespace,
    rows: list[dict[str, str]],
    run_tag: str,
    working_dir: Path,
    output_suffix: str,
) -> None:
    results: list[dict[str, Any]] = []
    skill_file = resolve_skill_file(args, working_dir)
    skill_text = load_skill_text(skill_file)
    if skill_file:
        print(f"Skill injection enabled: {skill_file}")
    else:
        print("Skill injection not enabled (no skill file found or disabled).")
    meta = {
        "mode": "codex-mcp-direct",
        "runTag": run_tag,
        "workingDir": str(working_dir.resolve()),
        "skillFile": str(skill_file) if skill_file else "",
        "sandbox": args.sandbox,
        "approvalPolicy": args.approval_policy,
        "model": args.model,
        "profile": args.profile,
    }

    async with CodexMCPClient(timeout_seconds=args.timeout_seconds, verbose=args.verbose) as client:
        tools = await client.list_tools()
        tool_names = [t.get("name") for t in tools.get("tools", []) if isinstance(t, dict)]
        print(f"Available MCP tools: {tool_names}")
        if "codex" not in tool_names:
            raise RuntimeError(f"`codex` tool not found. Available tools: {tool_names}")

        for idx, row in enumerate(rows):
            print(f"[{idx + 1}/{len(rows)}] {row['cardId']} {row['cardName']}")
            args_payload = build_codex_args(row, args, working_dir, skill_text, skill_file)
            if args.verbose:
                print(f"[mcp] calling codex with cwd={args_payload.get('cwd')}")
            try:
                result = await client.call_tool("codex", args_payload)
                structured = result.get("structuredContent", {}) if isinstance(result, dict) else {}
                content_text = extract_result_text(result) if isinstance(result, dict) else ""
                results.append(
                    {
                        **meta,
                        "cardId": row["cardId"],
                        "cardName": row["cardName"],
                        "status": "ok",
                        "threadId": structured.get("threadId"),
                        "content": content_text,
                        "structuredContent": structured,
                    }
                )
                if args.print_conversation:
                    print(f"----- {row['cardId']} conversation -----")
                    if content_text:
                        print(content_text)
                    else:
                        print("(no text content returned)")
                    print("----- end -----")
            except Exception as exc:  # noqa: BLE001
                results.append(
                    {
                        **meta,
                        "cardId": row["cardId"],
                        "cardName": row["cardName"],
                        "status": "error",
                        "error": str(exc),
                    }
                )
                print(f"[error] {row['cardId']} {row['cardName']}: {exc}")

    out_json = args.output_dir / f"gd01_codex_mcp_results_{run_tag}{output_suffix}.json"
    out_jsonl = args.output_dir / f"gd01_codex_mcp_results_{run_tag}{output_suffix}.jsonl"
    write_json(out_json, results)
    write_jsonl(out_jsonl, results)
    print(f"Saved results:\n- {out_json}\n- {out_jsonl}")


def run_dry(
    args: argparse.Namespace,
    rows: list[dict[str, str]],
    run_tag: str,
    working_dir: Path,
    output_suffix: str,
) -> None:
    plan_rows = []
    skill_file = resolve_skill_file(args, working_dir)
    skill_text = load_skill_text(skill_file)
    if skill_file:
        print(f"Skill injection enabled: {skill_file}")
    else:
        print("Skill injection not enabled (no skill file found or disabled).")
    for row in rows:
        plan_rows.append(
            {
                "mode": "codex-mcp-direct-dry-run",
                "runTag": run_tag,
                "workingDir": str(working_dir.resolve()),
                "skillFile": str(skill_file) if skill_file else "",
                "cardId": row["cardId"],
                "cardName": row["cardName"],
                "codexArguments": build_codex_args(row, args, working_dir, skill_text, skill_file),
            }
        )
    out_json = args.output_dir / f"gd01_codex_mcp_plan_{run_tag}{output_suffix}.json"
    out_jsonl = args.output_dir / f"gd01_codex_mcp_plan_{run_tag}{output_suffix}.jsonl"
    write_json(out_json, plan_rows)
    write_jsonl(out_jsonl, plan_rows)
    print("Dry run only (no MCP tool call made).")
    print(f"Prepared {len(plan_rows)} request(s).")
    print(f"Saved plan:\n- {out_json}\n- {out_jsonl}")


def main() -> None:
    args = parse_args()
    working_dirs = args.working_dirs or [DEFAULT_WORKING_DIR]
    resolved_working_dirs: list[Path] = []
    for working_dir in working_dirs:
        resolved = working_dir.resolve()
        if not resolved.exists() or not resolved.is_dir():
            raise FileNotFoundError(f"Working dir not found or not a directory: {resolved}")
        resolved_working_dirs.append(resolved)
    args.working_dirs = resolved_working_dirs

    all_rows = load_prompts(args.input)
    rows = select_rows(all_rows, start_index=args.start_index, max_cards=args.max_cards)
    if not rows:
        print("No prompts selected. Nothing to do.")
        return

    base_run_tag = now_utc_tag()
    multi_dir = len(args.working_dirs) > 1
    for index, working_dir in enumerate(args.working_dirs):
        run_tag = base_run_tag if not multi_dir else f"{base_run_tag}_{index + 1:02d}"
        output_suffix = f"_{slugify_working_dir(working_dir)}" if multi_dir else ""
        print(f"Running prompts with working-dir: {working_dir}")
        if args.dry_run:
            run_dry(args, rows, run_tag, working_dir, output_suffix)
        else:
            asyncio.run(run_real(args, rows, run_tag, working_dir, output_suffix))


if __name__ == "__main__":
    main()
