# CLAUDE.md

This playbook gives Claude Code the context it needs to work inside `cardFrontend/`. Use it to stay aligned with the current Phaser/Vite codebase.

## Quick Start
- Install deps once: `cd cardFrontend && npm install`
- Local dev (Vite + HMR on port 3000): `npm run dev`
- Production bundle (outputs to `dist/`): `npm run build`
- Preview the build: `npm run preview`
- Quality gates: `npm run lint` (ESLint) and `npm run format` (Prettier write mode)

## Tech Stack & Standards
- Phaser 3.70 running in web canvas/WebGL; physics uses the Arcade plugin with gravity disabled.
- Vite 4 for bundling and module resolution; config lives in `vite.config.js`.
- ES2022 class-based code, modules use explicit `.js` extensions.
- ESLint (flat config) + Prettier 3 enforce two-space indentation, single quotes; do not mix tabs or semi-freeform styles.
- Assets are plain image files under `src/assets/`; keep the repo ASCII-safe unless the file already contains Unicode metadata.

## Runtime Entry Points
1. `src/main.js` builds the Phaser `config`, registers all scenes, and starts `PreloaderScene`.
2. `PreloaderScene` loads core UI assets, then hands off to `CardResourcePreloader` for card art and atlases.
3. `MenuScene` handles room entry: host/join flow, player name capture, and manual polling toggles.
4. `GameScene` is the primary board experience. It wires managers, renders areas, polls the backend, and reacts to the processing queue.
5. `BattleResultScene` summarizes round outcomes; `GameOverScene` shows the final victory state.
6. `DemoScene` / `DemoSceneBasic` exist for sandboxing animations without contacting the backend.

## Major Subsystems
### Managers (`src/managers/`)
- `GameStateManager` holds canonical client state (`gameEnv`, `uiState`) and exposes helpers for zones, rounds, shields, etc.; also coordinates API polling timers.
- `GameFlowManager` sequences post-poll transitions (hand reveal, shuffles, ready checks) and cooperates with `FrontEventProcessor` to gate UI updates.
- `FrontEventProcessor` inspects `gameEnv.processingQueue` and routes blocking events (burst effects, target choices) to `DialogManager`.
- `BoardLayoutManager` computes dynamic coordinates for slots, shields, bases, and UI overlays; `ZoneManager` binds those layouts to Phaser containers.
- `HandCardManager`, `CardPreviewManager`, `GameSceneUIManager`, and `UIMessageManager` split responsibilities for card sprites, preview panes, HUD, and toast/status text respectively.
- `ResourceManager` handles lazy asset loads and retry logic; keep new assets registered through it to surface missing-file errors cleanly.
- `DialogManager` + `DialogUIManager` drive modal interactions (burst confirmations, target selection) and rely on `handlers/` for resolution.

### Components (`src/components/`)
- `Card` is the interactive sprite wrapper: drag/drop, PowerOverlay, rested/active status, target highlighting, and total AP/HP labels.
- `SlotAreaManager`, `BaseAndShieldAreaManager`, and `EnergyAreaManager` build the board containers for each zone and maintain alignment with the layout manager.
- `ShuffleAnimationManager` plays entry animations and coordinates with hand visibility toggles.
- `PowerOverlay` renders stat labels, icons, and backgrounds; use `configureTotalLabels` to toggle aggregated stats on dialogs or slots.

### Systems, Services, Utilities
- Systems (`src/systems/ActionButtonManager.js`, `CardActionRegistry.js`) register context-driven buttons and the allowed actions per card.
- Handlers (`src/handlers/`) encapsulate burst/deploy logic and call into the backend through `GameApiService`.
- `GameApiService` wraps the raw `APIManager` (injected from MenuScene) with standardized response handling, UI messaging, and hand refresh behaviour.
- Utilities include `CardAnimationUtils`, `CardInteractionHelper`, `CardDisplayUtils`, `PowerOverlayCoordinator`, `ItemDataResolver`, and `ZoneMapping`; prefer extending these helpers over inlining logic inside scenes.
- `src/mock/scenarioLoader.js` can load JSON fixtures from `shared/testScenarios/` for offline testing; keep new fixtures in that shared directory.

## Data & Event Flow
- `GameStateManager.gameState` mirrors backend payloads. Key fields: `gameEnv.players[<id>].zones`, `processingQueue`, `victoryPoints`, and computed values inside `gameEnv.computedState`.
- After each poll (or API mutation), `GameApiService.handleStandardResponse` updates `gameEnv`, optionally triggers `checkHandUIDChangesAndSetScenario`, and flags `GameScene` to refresh board visuals.
- `FrontEventProcessor.processAllEvents()` should run before rendering updates; return `true` when a modal blocks further interaction.
- Card interactions flow: `CardInteractionManager` listens to pointer events → `CardActionHandler` / `DeployEffectHandler` interpret the intent → `GameApiService` performs the mutation → updated state re-renders via `HandCardManager`, `ZoneManager`, and animation helpers.
- Slots and bases now attach a `fieldCardValue` object with the shape `{ totalOriginalAP, totalOriginalHP, totalContinueModifyAP, totalContinueModifyHP, totalTempModifyAP, totalTempModifyHP, totalDamageReceived, totalAP, totalHP, isRested }`. Use `totalAP/totalHP` for rendered totals, `totalOriginal*` when you need baseline stats, and `isRested` to keep rested badges consistent with the backend.

## Assets & Configuration
- `src/config/gameConfig.js` stores dimensions, scaling rules, and phase constants. Modify when changing canvas size or adding phases.
- `src/config/cardConfig.js` contains per-faction colour palettes and icon lookups.
- Place new imagery in `src/assets/<type>/`; update `ResourceManager` registration and preloader manifests together.
- The Vite entry HTML is `index.html`; static shell lives in `public/`.

## Working Guidelines
- Keep scene constructors minimal; instantiate new managers inside `init`/`create` to honour Phaser lifecycle.
- When adding managers, pass only the scene and already-initialized collaborators—avoid circular construction.
- Prefer extending existing helper methods (`GameSceneUtils`, `UIGraphicsHelper`) instead of duplicating drawing logic.
- Maintain audible console logging but keep it concise; the repo standard logs scene lifecycle starts, API intents, and decision points.
- Run `npm run lint` before committing JS changes; Prettier must run on any file you touch.

## Troubleshooting Tips
- If card art is missing, confirm `ResourceManager` registered the key and that `CardResourcePreloader` queues it before `MenuScene` starts.
- UI freezes usually indicate an unhandled event in `processingQueue`; add handlers through `FrontEventProcessor.registerEventType` and surface dialogs via `DialogManager`.
- Desynchronised hands often stem from skipping `checkHandUIDChangesAndSetScenario`; ensure calls requesting redraws set the `updateHand` flag.
- Phaser layout issues: inspect `BoardLayoutManager.createLayout()` output and verify `ZoneManager` bounds before adding new zones.
- For backend calls that should not auto-poll, enable `isManualPollingMode` in `MenuScene`; use the debug buttons rendered at the top of `GameScene`.

## When Extending
- Add new scenes to the array in `main.js` **and** export them so Vite can include the module.
- Any new processing-queue event needs: backend contract, `FrontEventProcessor` registration, dialog/UI handling, and `GameApiService` plumbing.
- Keep large constants (card stats, presets) out of the scenes; create a file under `src/config/` or `shared/testScenarios/` depending on runtime vs fixture usage.
- Document reproduction steps for manual QA in PRs until automated coverage is introduced.

Use this guide as the single source of truth for `cardFrontend/`; update it when architecture or workflows change.
