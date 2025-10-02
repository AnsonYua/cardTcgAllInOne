# Backend Guidance

These notes capture the backend shape as of today. Anything that is unclear is flagged for follow-up—please review the **Unclear** section and let me know if we should adjust the understanding.

## Project Snapshot
- Runtime: Node.js (TypeScript)
- Entry: `server.ts` boots an Express HTTP API
- Build: `npm run build` (typescript → `dist/`); dev via `npm run dev` (ts-node + nodemon)
- Tests: Jest (`npm test`, `npm run test:quick`, etc. in `package.json`)
- Core gameplay lives in `src/services/` with supporting models/utilities under `src/models/` and `src/utils/`

## Key Modules

### Services layer (game logic)
- `GameEngine.ts` – primary execution engine; processes events, combat, base damage, and integrates effect managers.
- `GameLogic.ts` – higher-level orchestration (game/session creation, deck setup, state mutations).
- `ContinuousEffectManager.ts`, `DeployEffectManager.ts`, `PairingEffectManager.ts`, `TargetChoiceManager.ts`, `PhaseTransitionManager.ts` – specialized managers for effect normalization, pairing logic, target selection, and phase transitions.
- `PlayerCardManager.ts` – handles card placement, movement between zones, and stat lookups (`getCurrentUnitCardInSlotAPandHP`).
- `BaseCardManager.ts`, `EnergyManager.ts`, `ShieldCardManager.ts` – zone-specific helpers.
- `effects/EffectExecutor.ts` – shared execution utilities for resolved effects.

### Models & Utilities
- `src/models/CardSystem.ts` – canonical definitions for zone cards, card data interfaces, `FieldCardValue`, etc.
- `src/models/Player.ts` – server-side player representation including zone serialization (`serializeZonesForResponse`) and slot value calculation.
- `src/models/GameEnvironment.ts` (implied by imports) – global state object passed through services.
- `src/utils/SlotZoneUtils.ts` – locating cards/slots across players, validating slot structures.
- `src/utils/EffectNormalizationUtils.ts` – shared normalization for effect data (used heavily by effect managers).

### API surface
- `src/controllers/gameController.ts` – Express handlers for start/join game, ready phase, actions, etc. (TypeScript).
- `src/routes/` – Express route registration (not detailed here, but controller uses typical REST endpoints).
- Server bootstrapped from `server.ts` with CORS, env loading (`dotenv`), and the above routes.

## Data & Test Assets
- `src/data/` – current card/deck JSON files (exact schema should be cross-checked before edits; the legacy “leader/character” references in the old README no longer match).
- `src/gameData/` – persisted match state / scenario data.
- Tests live under `src/tests/` and various helper scripts (see package scripts like `test:quick`, `test:list`).

## Commands (verified in package.json)
- `npm run dev` – nodemon + ts-node for live-reload development.
- `npm run build` – TypeScript compile to `dist/`.
- `npm start` – run compiled server (`node dist/server.js`).
- `npm test`, plus additional scripted runners (`test:quick`, `test:interactive`, `test:list`, etc.).

## Unclear / Needs Confirmation
- **Card data schema in `src/data/`:** Files remain, but the exact field names and effect definitions need cross-checking with current game logic before editing.
- **Event queue initialization:** Comments in `gameController.ts` reference an event processor that might still be TODO—verify whether `GameEngine` now covers this or if additional setup is required.
- **Legacy scripts (`test.cjs`, `test_case1.cjs`):** Still present in `package.json`; ensure they reflect the new effect/zone logic if you plan to run them.

Let me know if any section should drill deeper (e.g., detailed effect normalization flow, pairing rule shapes, or serialization contract for the frontend).
