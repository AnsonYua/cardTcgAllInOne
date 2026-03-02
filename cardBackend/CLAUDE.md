# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
- **Type**: Custom Trading Card Game Backend
- **Runtime**: Node.js (TypeScript)
- **Framework**: Express HTTP API
- **Entry Point**: `server.ts` boots the server
- **Architecture**: Event-driven game state management with complex effect system

## Development Commands

### Core Commands
- `npm run dev` - Start development server with hot reload (nodemon + ts-node)
- `npm run build` - Compile TypeScript to `dist/`
- `npm start` - Run production server (`node dist/server.js`)
- `npm run type-check` - TypeScript type checking without compilation

### Testing Commands
- `npm test` - Run Jest tests
- `npm run test:quick` - Quick test runner
- `npm run test:watch` - Watch mode for Jest tests
- `npm run test:interactive` - Interactive test runner
- `npm run test:list` - List available tests
- `npm run test:single <test>` - Run specific test

### Effect Management Scripts
- `npm run review:effects` - Generate effect alignment review
- `npm run review:effects:st` - Generate ST set effect audit
- `npm run review:unresolved` - Generate unresolved effect catalog
- `npm run review:unresolved:check` - Check unresolved effect baseline
- `npm run review:effects:apply` - Apply effect canonicalization
- `npm run validate:effects:canonical` - Validate effects canonical
- `npm run validate:effects:strict` - Strict effects validation

## Architecture Overview

### Core Execution Flow
**GameEngine** (`src/services/GameEngine.ts`) - Primary event-driven execution engine that processes all game state changes through a centralized `execute()` method. Routes events to specialized managers based on event type.

**GameLogic** (`src/services/GameLogic.ts`) - Higher-level orchestration layer that handles game/session creation, deck setup, and coordinates between GameEngine and persistence.

### Key Architectural Patterns

#### Event-Driven Architecture
- All game state changes flow through typed events (`src/services/EventQueue/interfaces/GameEvent.ts`)
- Event types are dispatched to appropriate effect managers
- Results are returned as `ExecutionResult` objects containing success/failure and updated game state

#### Effect System
**Effect Management** (`src/services/effects/`) - Complex multi-layered effect system:
- `EffectExecutor.ts` - Shared execution utilities for resolved effects
- `DeployEffectManager.ts` - Handles deploy-time effect processing
- `ContinuousEffectManager.ts` - Ongoing stat modifications and passive effects
- `TriggeredEffectProcessor.ts` - Event-triggered effects (on damage, on draw, etc.)
- `SequenceEffectManager.ts` - Sequenced effect chains
- Canonical effect system in `src/services/effects/canonical/` for normalized effect representation

#### Card Play System
**CardPlayExecutor** (`src/services/CardPlayExecutor.ts`) - Coordinates card placement with effect resolution
**PlayerCardManager** (`src/services/PlayerCardManager.ts`) - Handles card movement between zones (hand→slot, etc.)
**DeployTargetManager** (`src/services/DeployTargetManager.ts`) - Manages target selection for deploy effects

#### Battle System
**BattlePhaseManager** (`src/services/BattlePhaseManager.ts`) - Orchestrates combat phases
**AttackPreparationManager** (`src/services/AttackPreparationManager.ts`) - Prepares attack actions
**BurstEffectManager** (`src/services/BurstEffectManager.ts`) - Handles burst mechanic effects

#### Zone Management
**SlotZoneUtils** (`src/utils/SlotZoneUtils.ts`) - Card/slot location utilities
**DeckZoneManager** (`src/services/zones/DeckZoneManager.ts`) - Deck operations
**HandZoneManager** (`src/services/zones/HandZoneManager.ts`) - Hand operations

### Data Models
**GameEnvironment** (`src/models/GameEnvironment.ts`) - Global game state container
**Player** (`src/models/Player.ts`) - Player state with zone serialization
**CardSystem** (`src/models/CardSystem.ts`) - Card definitions and data structures

### API Layer
**gameController** (`src/controllers/gameController.ts`) - Express handlers for all game endpoints
**GameEnvViewBuilder** (`src/services/views/GameEnvViewBuilder.ts`) - Builds player-specific game views
**SessionManager** (`src/services/SessionManager.ts`) - Player session management

### Specialized Systems
- **AI System**: `src/services/ai/` - AI opponents with `GameAiService`, `AiAutoplayCoordinator`
- **Cost System**: `src/services/costs/` - Cost payment and replacement flows
- **Target System**: `src/services/targets/` - Target selection and resolution
- **Condition System**: `src/services/conditions/` - Effect condition evaluation
- **Notification System**: `src/services/notifications/` - Event notification management
- **Choice System**: `src/services/choices/` - Player choice handling

## Key Design Patterns

### Effect Normalization
All card effects pass through normalization pipeline in `EffectNormalizationUtils.ts` before execution. This ensures consistent effect representation across different card data sources.

### Choice/Confirmation Flow
Many effects require player choices (targets, options, etc.). This follows a pattern:
1. Effect manager creates choice event
2. Frontend presents choices to player
3. Player confirmation endpoint processes selection
4. Effect execution continues with confirmed choices

### State Persistence
Game state is persisted to JSON files in `src/gameData/`. Uses `GameEnvironment.toJSON()` for serialization and reload capabilities for testing scenarios.

## Testing Strategy
- **Unit Tests**: Jest framework in `src/tests/`
- **Scenario Tests**: Game state scenarios in `shared/testScenarios/gameStates/`
- **Test Runners**: Multiple specialized runners for different testing needs
- **Effect Validation**: Dedicated scripts for effect system validation

## Configuration & Data
- **Card Data**: `src/data/` - JSON card definitions (set-specific: `st01Card.json`, `st02Card.json`, etc.)
- **Environment**: `dotenv` configuration via `.env` file
- **CORS**: Configured for local development and specific origins
- **Port**: Configurable via `PORT` environment variable (default: 8080)

## Important Implementation Notes

### Effect System Complexity
The effect system is highly sophisticated with:
- Multiple effect types (deploy, continuous, triggered, sequence)
- Complex target resolution with filters and scopes
- Condition evaluation system
- Effect scaling and scaling types
- Continuous effect registration and scope resolution

### Zone Architecture
- 6 slot zones per player (`slot1` through `slot6`)
- Hand zone for card storage
- Deck zone for draw pile
- Trash/exile zones for removed cards
- Base zone for base cards
- Shield zone for shield cards

### Card Types
- **Unit Cards**: Deploy to slots, have AP/HP stats
- **Pilot Cards**: Attached to units, provide bonuses
- **Command Cards**: One-time use effects
- **Base Cards**: Special cards in base zone
- **Token Cards**: Generated by effects (format: T-#, e.g., T-1)

### AI Integration
AI system integrates with game flow through:
- `AiAutoplayCoordinator` - Manages AI decision-making
- `GameAiService` - Provides AI decision logic
- Session-aware AI player identification

## Development Workflow
1. Start dev server: `npm run dev`
2. Test endpoints via API (e.g., start game, join room, play cards)
3. Use `npm run test:quick` for rapid feedback
4. Run effect validation scripts when modifying effects
5. Use scenario testing for complex game states

## Critical Dependencies
- **Express**: HTTP server framework
- **TypeScript**: Type safety
- **Jest**: Testing framework
- **uuid**: Unique ID generation
- **cors**: Cross-origin requests
- **dotenv**: Environment configuration