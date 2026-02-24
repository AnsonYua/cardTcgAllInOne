# Codex MCP Client Runbook (No Agents SDK)

## Purpose
- Run prompt drafts by calling Codex MCP directly.
- No `openai-agents` dependency.
- Can use local Codex login session (`codex login`) instead of `OPENAI_API_KEY`.

## Script
- `run_gd01_prompts_codex_mcp_client.py`

## Prerequisites
- Node.js 18+ (`npx` available)
- Codex CLI available: `npx -y codex --help`
- Codex auth session:
  - `codex login`
  - `codex login status`

## Dry Run (No MCP calls)
```bash
python3 run_gd01_prompts_codex_mcp_client.py \
  --dry-run \
  --working-dir /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend \
  --max-cards 5
```

## Real Run (Direct Codex MCP calls)
```bash
python3 run_gd01_prompts_codex_mcp_client.py \
  --working-dir /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend \
  --max-cards 5
```

## Useful Options
- `--start-index`: continue from an index for batch runs
- `--max-cards`: run a small batch first
- `--timeout-seconds`: per-request timeout
- `--approval-policy`: `never | on-request | untrusted`
- `--sandbox`: `read-only | workspace-write | danger-full-access`
- `--model`, `--profile`: optional Codex overrides

## Outputs
- Dry run:
  - `data/agent_runs/gd01_codex_mcp_plan_<timestamp>.json`
  - `data/agent_runs/gd01_codex_mcp_plan_<timestamp>.jsonl`
- Real run:
  - `data/agent_runs/gd01_codex_mcp_results_<timestamp>.json`
  - `data/agent_runs/gd01_codex_mcp_results_<timestamp>.jsonl`
