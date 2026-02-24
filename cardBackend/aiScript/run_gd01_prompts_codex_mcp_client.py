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


DEFAULT_INPUT = Path(__file__).resolve().parent / "data" / "draft_run" / "gd01_prompt_drafts.json"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data" / "agent_runs"
DEFAULT_WORKING_DIR = Path(__file__).resolve().parent.parent


def now_utc_tag() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run prompt drafts via direct Codex MCP client")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--working-dir", type=Path, default=DEFAULT_WORKING_DIR)
    parser.add_argument("--start-index", type=int, default=0)
    parser.add_argument("--max-cards", type=int, default=0, help="0 means all")
    parser.add_argument("--timeout-seconds", type=int, default=600)
    parser.add_argument("--approval-policy", default="never", choices=["never", "on-request", "untrusted"])
    parser.add_argument(
        "--sandbox", default="workspace-write", choices=["read-only", "workspace-write", "danger-full-access"]
    )
    parser.add_argument("--model", default="")
    parser.add_argument("--profile", default="")
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
                    # Print concise event details so the console is informative but not flooded.
                    event_name = (
                        params_obj.get("event")
                        or params_obj.get("type")
                        or params_obj.get("name")
                        or "unknown"
                    )
                    status = params_obj.get("status")
                    summary = params_obj.get("summary") or params_obj.get("message")
                    thread_id = params_obj.get("threadId")
                    pieces = [f"[mcp] codex/event: {event_name}"]
                    if status:
                        pieces.append(f"status={status}")
                    if thread_id:
                        pieces.append(f"threadId={thread_id}")
                    if isinstance(summary, str) and summary.strip():
                        trimmed = summary.strip().replace("\n", " ")
                        pieces.append(f"msg={trimmed[:180]}")
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


def build_codex_args(row: dict[str, str], args: argparse.Namespace) -> dict[str, Any]:
    codex_args: dict[str, Any] = {
        "prompt": row["prompt"],
        "cwd": str(args.working_dir.resolve()),
        "sandbox": args.sandbox,
        "approval-policy": args.approval_policy,
    }
    if args.model:
        codex_args["model"] = args.model
    if args.profile:
        codex_args["profile"] = args.profile
    return codex_args


async def run_real(args: argparse.Namespace, rows: list[dict[str, str]], run_tag: str) -> None:
    results: list[dict[str, Any]] = []
    meta = {
        "mode": "codex-mcp-direct",
        "runTag": run_tag,
        "workingDir": str(args.working_dir.resolve()),
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
            args_payload = build_codex_args(row, args)
            if args.verbose:
                print(f"[mcp] calling codex with cwd={args_payload.get('cwd')}")
            try:
                result = await client.call_tool("codex", args_payload)
                structured = result.get("structuredContent", {}) if isinstance(result, dict) else {}
                content_text = ""
                if isinstance(result, dict):
                    content = result.get("content")
                    if isinstance(content, list):
                        texts = []
                        for item in content:
                            if isinstance(item, dict) and item.get("type") == "text":
                                texts.append(str(item.get("text", "")))
                        content_text = "\n".join([t for t in texts if t]).strip()
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

    out_json = args.output_dir / f"gd01_codex_mcp_results_{run_tag}.json"
    out_jsonl = args.output_dir / f"gd01_codex_mcp_results_{run_tag}.jsonl"
    write_json(out_json, results)
    write_jsonl(out_jsonl, results)
    print(f"Saved results:\n- {out_json}\n- {out_jsonl}")


def run_dry(args: argparse.Namespace, rows: list[dict[str, str]], run_tag: str) -> None:
    plan_rows = []
    for row in rows:
        plan_rows.append(
            {
                "mode": "codex-mcp-direct-dry-run",
                "runTag": run_tag,
                "workingDir": str(args.working_dir.resolve()),
                "cardId": row["cardId"],
                "cardName": row["cardName"],
                "codexArguments": build_codex_args(row, args),
            }
        )
    out_json = args.output_dir / f"gd01_codex_mcp_plan_{run_tag}.json"
    out_jsonl = args.output_dir / f"gd01_codex_mcp_plan_{run_tag}.jsonl"
    write_json(out_json, plan_rows)
    write_jsonl(out_jsonl, plan_rows)
    print("Dry run only (no MCP tool call made).")
    print(f"Prepared {len(plan_rows)} request(s).")
    print(f"Saved plan:\n- {out_json}\n- {out_jsonl}")


def main() -> None:
    args = parse_args()
    args.working_dir = args.working_dir.resolve()
    if not args.working_dir.exists() or not args.working_dir.is_dir():
        raise FileNotFoundError(f"Working dir not found or not a directory: {args.working_dir}")

    all_rows = load_prompts(args.input)
    rows = select_rows(all_rows, start_index=args.start_index, max_cards=args.max_cards)
    if not rows:
        print("No prompts selected. Nothing to do.")
        return

    run_tag = now_utc_tag()
    if args.dry_run:
        run_dry(args, rows, run_tag)
    else:
        asyncio.run(run_real(args, rows, run_tag))


if __name__ == "__main__":
    main()
