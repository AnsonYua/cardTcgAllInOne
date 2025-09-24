# Repository Guidelines

## Project Structure & Module Organization
- `cardBackend/`: Node.js + TypeScript API, core logic in `src/services/`, persisted match state in `src/gameData/`.
- `cardFrontend/`: Phaser 3 client, gameplay scenes in `src/scenes/`, shared config in `src/config/`, static shell under `public/`.
- `shared/testScenarios/`: Canonical JSON scenarios used for automated and manual verification; extend here instead of duplicating fixtures.
- Build outputs sit in each package's `dist/`; update sources only and let the build regenerate artefacts.

## Build, Test, and Development Commands
- Backend: `cd cardBackend && npm install`, then `npm run dev` for hot reload, `npm run build` to emit production JS, `npm start` to smoke-test the compiled server.
- Frontend: `cd cardFrontend && npm install`, `npm run dev` to launch Vite, `npm run build` to create optimized assets, `npm run preview` for a sanity check.
- Quality gates: `npm test` (backend Jest suite), `npm run lint` and `npm run format` (frontend ESLint/Prettier) before opening a PR.

## Coding Style & Naming Conventions
- Backend uses 4-space indentation, camelCase for variables/functions, PascalCase for classes/managers; keep side-effect logs concise and meaningful.
- Frontend adopts Prettier defaults (2-space indent, single quotes). Prefer descriptive scene names (`BattleResultScene.js`) and suffix shared helpers with their role (`*Utils.ts`).

## Testing Guidelines
- Place backend specs in `cardBackend/src/__tests__/` or alongside code as `*.test.ts`; run them with `npm test` or iterate faster via `npm run test:quick` and list scenarios with `npm run test:list`.
- Capture new shared fixtures in `shared/testScenarios/` and reference them from tests rather than embedding large payloads.
- Frontend currently depends on manual QA; document reproduction steps and expected outcomes in each PR until automated coverage lands.

## Commit & Pull Request Guidelines
- Follow an imperative subject line (e.g., `Tighten burst effect validation`) and add a succinct body noting reason + impact when the change is non-trivial.
- Keep backend and frontend adjustments in separate commits whenever possible; note cross-package coordination in the PR description.
- Every PR should include a summary, linked issue or task, relevant command output (`npm test`, `npm run lint`), and visuals for UI updates. Highlight rule changes or `gameData/` migrations so reviewers can re-run scenarios.

## Environment Notes
- Backend expects a populated `cardBackend/.env`; copy a local template (never commit secrets) and restart the dev server after edits.
- Default ports are `3001` (API) and `3000` (frontend). Free them before running both apps to avoid confusing connection errors.
