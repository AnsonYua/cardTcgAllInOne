# GD01 Agents SDK Runbook

## Purpose
- Run prompts from `data/draft_run/gd01_prompt_drafts.json` using OpenAI Agents SDK + Codex MCP server.
- Default behavior is dry-run (no API calls).

## Script
- `run_gd01_prompts_agents_sdk.py`

## Prerequisites
- Python `3.10+`
- Node.js `18+` (`npx` required)
- Codex CLI available via `npx codex`
- OpenAI API key in environment:
  - `OPENAI_API_KEY=...`

## Recommended Environment Setup
```bash
cd /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/aiScript
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade openai openai-agents python-dotenv
```

## Dry Run (No API calls)
```bash
python3 run_gd01_prompts_agents_sdk.py \
  --working-dir /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend \
  --max-cards 5
```

## Real Run
```bash
export OPENAI_API_KEY=sk-...
python3 run_gd01_prompts_agents_sdk.py \
  --run \
  --working-dir /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend \
  --max-cards 5
```

## Useful Options
- `--input`: prompt source JSON (default: `data/draft_run/gd01_prompt_drafts.json`)
- `--output-dir`: output folder (default: `data/agent_runs`)
- `--working-dir` (alias: `--workspace-cwd`): working directory for Codex tool calls (default: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend`)
- `--model`: planner model for Agents SDK (default: `gpt-5`)
- `--approval-policy`: `never | on-request | untrusted` (default: `never`)
- `--sandbox`: `read-only | workspace-write | danger-full-access` (default: `workspace-write`)
- `--start-index`, `--max-cards`: batch control for retries/chunking

## Outputs
- Dry run:
  - `data/agent_runs/gd01_agents_plan_<timestamp>.json`
  - `data/agent_runs/gd01_agents_plan_<timestamp>.jsonl`
- Real run:
  - `data/agent_runs/gd01_agents_results_<timestamp>.json`
  - `data/agent_runs/gd01_agents_results_<timestamp>.jsonl`

## Suggested Improvements Before Large Batch
- Use `--max-cards` in small batches first (e.g., 5-10) to validate output quality.
- Keep `--sandbox workspace-write` to avoid accidental global writes.
- If your API key is in `.env`, ensure `.env` is gitignored.
- Consider adding rate-limit retry/backoff if running full batch frequently.
