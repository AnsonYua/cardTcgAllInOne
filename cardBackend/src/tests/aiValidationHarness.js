const fs = require('fs');
const os = require('os');
const path = require('path');

const { GameEnvironment } = require('../models/GameEnvironment');
const { GameLogic } = require('../services/GameLogic');
const { CardDatabaseManager } = require('../models/CardSystem');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');
const { GameAiService } = require('../services/ai/GameAiService');
const { AiDecisionExecutor } = require('../services/ai/AiDecisionExecutor');
const { AiAutoplayCoordinator } = require('../services/ai/AiAutoplayCoordinator');
const { CHOICE_EVENT_TYPES } = require('../services/ai/AiTypes');
const { buildAiDebugPayload } = require('../services/ai/AiDebugTelemetry');
const { getChoiceOwner, getPendingAiChoiceOwners } = require('../services/ai/AiAutoplayChoiceGuards');
const { loadJson, resolveScenarioFilePath, sharedGameStatesRoot } = require('./testScenarioUtils');

const AI_SCENARIO_IDS = [
  'ai-v1-lethal-race',
  'ai-v1-blocker-redirect',
  'ai-v1-burst-target-choice',
  'ai-v1-action-step-response',
  'ai-v1-full-board-replacement',
  'ai-v1-forced-attack-target'
];

const AI_TUNING_SCENARIO_IDS = [
  'ai-v1-tuning-attack-order',
  'ai-v1-tuning-shield-push',
  'ai-v1-tuning-pair-now',
  'ai-v1-tuning-blocker-preservation',
  'ai-v1-tuning-action-step-confirm',
  'ai-v1-tuning-crackback-risk'
];

const STARTER_SET_IDS = ['ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08'];
const STARTER_CROSS_MATCH_SAMPLE_PAIRS = [
  ['ST01', 'ST02'],
  ['ST01', 'ST04'],
  ['ST02', 'ST05'],
  ['ST03', 'ST06'],
  ['ST04', 'ST07'],
  ['ST05', 'ST08'],
  ['ST06', 'ST01'],
  ['ST07', 'ST03']
];
const STARTER_DECK_SOURCE_FILES = {
  ST01: 'gcgdecks.json',
  ST02: 'gcgdecks_st02.json',
  ST03: 'gcgdecks_st03.json'
};

const DEFAULT_AUTOPLAY_STEPS = 300;
const DEFAULT_MATRIX_TURNS = 40;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(baseValue, overrideValue) {
  if (Array.isArray(overrideValue)) {
    return deepClone(overrideValue);
  }

  if (!overrideValue || typeof overrideValue !== 'object') {
    return overrideValue;
  }

  const base = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
    ? deepClone(baseValue)
    : {};

  for (const [key, value] of Object.entries(overrideValue)) {
    if (Array.isArray(value)) {
      base[key] = deepClone(value);
      continue;
    }
    if (value && typeof value === 'object') {
      base[key] = deepMerge(base[key], value);
      continue;
    }
    base[key] = value;
  }

  return base;
}

function createTempGameLogic() {
  const logic = new GameLogic();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-validation-'));
  logic.baseDataPath = tempDir;

  return {
    logic,
    cleanup() {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
}

function normalizeScenarioFileName(scenarioId) {
  return scenarioId.endsWith('.json') ? scenarioId : `${scenarioId}.json`;
}

function loadAiScenarioDefinition(scenarioId) {
  const filename = normalizeScenarioFileName(scenarioId);
  const filePath = path.join(sharedGameStatesRoot(), filename);
  return loadJson(filePath);
}

function loadSourceScenario(sourceScenarioPath) {
  const filePath = resolveScenarioFilePath(sourceScenarioPath);
  const scenario = loadJson(filePath);
  if (!scenario || typeof scenario !== 'object' || !scenario.initialGameEnv) {
    throw new Error(`Invalid scenario source: ${sourceScenarioPath}`);
  }
  return scenario;
}

function buildGameEnvFromScenarioDefinition(definition) {
  const sourceScenario = definition.sourceScenarioPath
    ? loadSourceScenario(definition.sourceScenarioPath)
    : null;
  const sourceEnv = definition.sourceScenarioPath
    ? deepMerge(sourceScenario?.initialGameEnv || {}, definition.initialGameEnvOverrides || {})
    : definition.initialGameEnv;
  if (!sourceEnv) {
    throw new Error(`Scenario ${definition.id || definition.name || 'unknown'} is missing an initial game state`);
  }

  const gameEnv = GameEnvironment.fromJSON(deepClone(sourceEnv));
  gameEnv.aiPlayerIds = Array.isArray(definition.aiPlayerIds)
    ? [...definition.aiPlayerIds]
    : (typeof definition.actingAiPlayerId === 'string' ? [definition.actingAiPlayerId] : []);
  return gameEnv;
}

function getStateValue(target, pathExpression) {
  if (!pathExpression) return undefined;
  return pathExpression.split('.').reduce((current, token) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (/^\d+$/.test(token)) {
      return current[Number(token)];
    }
    return current[token];
  }, target);
}

function isSubsetMatch(actual, expected) {
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    return actual === expected;
  }
  if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
    return false;
  }

  return Object.entries(expected).every(([key, value]) => isSubsetMatch(actual[key], value));
}

function evaluateStateAssertions(target, assertions = []) {
  return assertions.map((assertion) => {
    const actual = getStateValue(target, assertion.path);
    const passed = assertion.exists === true
      ? actual !== undefined && actual !== null && actual !== ''
      : Array.isArray(assertion.oneOf)
        ? assertion.oneOf.includes(actual)
        : Object.prototype.hasOwnProperty.call(assertion, 'equals')
          ? actual === assertion.equals
          : isSubsetMatch(actual, assertion.matches || {});

    return {
      ...assertion,
      actual,
      passed
    };
  });
}

function validateDecisionShape(decision) {
  const payload = decision?.payload || {};
  const problems = [];

  if (!decision || typeof decision !== 'object') {
    return ['decision_missing'];
  }
  if (typeof decision.kind !== 'string' || decision.kind.length === 0) {
    problems.push('decision_kind_missing');
  }
  if (typeof decision.reason !== 'string' || decision.reason.length === 0) {
    problems.push('decision_reason_missing');
  }

  switch (decision.kind) {
    case 'playerAction':
      if (typeof payload.actionType !== 'string' || payload.actionType.length === 0) {
        problems.push('playerAction.actionType_missing');
      }
      break;
    case 'playCard':
      if (!payload.action || typeof payload.action !== 'object') {
        problems.push('playCard.action_missing');
      }
      break;
    case 'confirmBurstChoice':
      if (typeof payload.eventId !== 'string') {
        problems.push('confirmBurstChoice.eventId_missing');
      }
      if (typeof payload.confirmed !== 'boolean') {
        problems.push('confirmBurstChoice.confirmed_missing');
      }
      break;
    case 'confirmTargetChoice':
    case 'confirmBlockerChoice':
      if (typeof payload.eventId !== 'string') {
        problems.push(`${decision.kind}.eventId_missing`);
      }
      if (!Array.isArray(payload.selectedTargets)) {
        problems.push(`${decision.kind}.selectedTargets_missing`);
      }
      break;
    case 'confirmTokenChoice':
      if (typeof payload.eventId !== 'string' || typeof payload.selectedChoiceIndex !== 'number') {
        problems.push('confirmTokenChoice_payload_invalid');
      }
      break;
    case 'confirmOptionChoice':
      if (typeof payload.eventId !== 'string' || typeof payload.selectedOptionIndex !== 'number') {
        problems.push('confirmOptionChoice_payload_invalid');
      }
      break;
    default:
      break;
  }

  return problems;
}

function countUnresolvedAiPrompts(gameEnv, aiPlayerIds) {
  const aiSet = new Set(aiPlayerIds || []);
  const queueCount = Array.isArray(gameEnv?.processingQueue)
    ? gameEnv.processingQueue.filter((event) => {
        if (!event || event.status !== 'DECLARED' || !CHOICE_EVENT_TYPES.has(String(event.type))) {
          return false;
        }
        const owner = getChoiceOwner(event);
        return owner && aiSet.has(owner);
      }).length
    : 0;

  const notificationCount = Array.isArray(gameEnv?.notificationQueue)
    ? gameEnv.notificationQueue.filter((notification) => {
        if (!notification || !CHOICE_EVENT_TYPES.has(String(notification.type))) {
          return false;
        }
        const payload = notification.payload && typeof notification.payload === 'object' ? notification.payload : {};
        return payload.isCompleted !== true && typeof payload.playerId === 'string' && aiSet.has(payload.playerId);
      }).length
    : 0;

  return queueCount + notificationCount;
}

async function injectGameEnv(logic, gameId, gameEnv) {
  const result = await logic.injectGameState(gameId, gameEnv.toPersistenceJSON ? gameEnv.toPersistenceJSON() : gameEnv);
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to inject AI validation game state');
  }
}

async function getLiveState(logic, gameId, viewerPlayerId) {
  const result = await logic.getPlayerGameState(gameId, viewerPlayerId);
  if (!result?.success || !result.gameEnv) {
    throw new Error(result?.error || 'Failed to load AI validation game state');
  }
  return result.gameEnv;
}

async function executeDecisionLike(logic, gameId, playerId, decisionLike) {
  const executor = new AiDecisionExecutor(logic);
  const decision = {
    kind: decisionLike.kind,
    reason: decisionLike.reason || `scenario_${decisionLike.kind}`,
    payload: decisionLike.payload || {}
  };
  return executor.execute(gameId, playerId, decision);
}

async function applySetupActions(logic, gameId, setupActions = []) {
  for (const action of setupActions) {
    const result = await executeDecisionLike(logic, gameId, action.playerId, action);
    if (!result?.success) {
      throw new Error(result?.error || `Setup action failed: ${action.kind}`);
    }
  }
}

async function requestAiDecision(logic, gameId, aiPlayerId, viewerPlayerId = aiPlayerId) {
  const gameEnv = await getLiveState(logic, gameId, viewerPlayerId);
  const view = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
  const startedAt = Date.now();
  const decision = await GameAiService.decide(view, aiPlayerId, { rawGameEnv: gameEnv });
  const latencyMs = Date.now() - startedAt;
  const malformedProblems = validateDecisionShape(decision);
  return {
    gameEnv,
    decision,
    debugPayload: buildAiDebugPayload(decision),
    latencyMs,
    malformedProblems,
    fallbackReason: decision?.telemetry?.fallbackReason || null,
    simulatedNodeCount: Number(decision?.telemetry?.simulatedNodeCount || 0),
    budgetUsedMs: Number(decision?.telemetry?.budgetUsedMs || 0),
    budgetRemainingMs: Number(decision?.telemetry?.budgetRemainingMs || 0),
    lineHistory: Array.isArray(decision?.telemetry?.lineHistory) ? decision.telemetry.lineHistory : [],
    promptChain: Array.isArray(decision?.telemetry?.promptChain) ? decision.telemetry.promptChain : [],
    search: decision?.telemetry?.search || null
  };
}

function evaluateDecisionExpectation(decision, expectation = {}) {
  const errors = [];
  if (Array.isArray(expectation.allowedKinds) && expectation.allowedKinds.length > 0 && !expectation.allowedKinds.includes(decision.kind)) {
    errors.push(`kind:${decision.kind}`);
  }
  if (Array.isArray(expectation.allowedReasons) && expectation.allowedReasons.length > 0 && !expectation.allowedReasons.includes(decision.reason)) {
    errors.push(`reason:${decision.reason}`);
  }
  if (typeof expectation.reasonIncludes === 'string' && !String(decision.reason || '').includes(expectation.reasonIncludes)) {
    errors.push(`reasonIncludes:${expectation.reasonIncludes}`);
  }
  if (expectation.payloadSubset && !isSubsetMatch(decision.payload || {}, expectation.payloadSubset)) {
    errors.push('payloadSubset');
  }
  if (Array.isArray(expectation.payloadAssertions)) {
    const payloadResults = evaluateStateAssertions(decision.payload || {}, expectation.payloadAssertions);
    for (const result of payloadResults) {
      if (!result.passed) {
        errors.push(`payload:${result.path}`);
      }
    }
  }
  return {
    passed: errors.length === 0,
    errors
  };
}

function summarizeSampleForFailure(sample) {
  if (!sample) {
    return null;
  }
  return {
    aiPlayerId: sample.aiPlayerId || null,
    step: typeof sample.step === 'number' ? sample.step : null,
    latencyMs: typeof sample.latencyMs === 'number' ? sample.latencyMs : null,
    kind: sample.kind || sample.decision?.kind || null,
    reason: sample.reason || sample.decision?.reason || null,
    fallbackReason: sample.fallbackReason || null,
    malformedProblems: Array.isArray(sample.malformedProblems) ? sample.malformedProblems : [],
    debugPayload: sample.debugPayload || null
  };
}

async function runScenarioDecisionSequence(scenarioId) {
  const definition = loadAiScenarioDefinition(scenarioId);
  const { logic, cleanup } = createTempGameLogic();
  const gameId = `${definition.id}_${Date.now()}`;

  try {
    const gameEnv = buildGameEnvFromScenarioDefinition(definition);
    await injectGameEnv(logic, gameId, gameEnv);
    await applySetupActions(logic, gameId, definition.setupActions);

    const stepResults = [];
    for (const step of definition.decisionSequence || []) {
      const stepResult = await requestAiDecision(
        logic,
        gameId,
        step.actingAiPlayerId || definition.actingAiPlayerId,
        step.viewerPlayerId || definition.viewerPlayerId || definition.actingAiPlayerId
      );
      const expectation = evaluateDecisionExpectation(stepResult.decision, step);
      let execution = null;
      let stateAssertions = [];

      if (step.executeDecision !== false) {
        execution = await executeDecisionLike(logic, gameId, step.actingAiPlayerId || definition.actingAiPlayerId, stepResult.decision);
        if (!execution?.success) {
          throw new Error(execution?.error || `Failed to execute AI decision for ${scenarioId}`);
        }
        const liveState = await getLiveState(logic, gameId, step.viewerPlayerId || definition.viewerPlayerId || definition.actingAiPlayerId);
        stateAssertions = evaluateStateAssertions(liveState, step.stateAssertionsAfterExecute);
      }

      stepResults.push({
        ...stepResult,
        expectation,
        execution,
        stateAssertions
      });
    }

    const finalState = await getLiveState(logic, gameId, definition.viewerPlayerId || definition.actingAiPlayerId);
    return {
      definition,
      gameId,
      stepResults,
      finalState,
      unresolvedAiPromptCount: countUnresolvedAiPrompts(finalState, definition.aiPlayerIds)
    };
  } finally {
    cleanup();
  }
}

async function runScenarioValidation(scenarioId) {
  const decisionResult = await runScenarioDecisionSequence(scenarioId);
  const definition = decisionResult.definition;

  if (!definition.autoplayValidation) {
    return {
      ...decisionResult,
      autoplayResult: null
    };
  }

  const { logic, cleanup } = createTempGameLogic();
  const gameId = `${definition.id}_autoplay_${Date.now()}`;

  try {
    const gameEnv = buildGameEnvFromScenarioDefinition(definition);
    await injectGameEnv(logic, gameId, gameEnv);
    await applySetupActions(logic, gameId, definition.setupActions);

    for (const step of definition.decisionSequence || []) {
      if (step.executeDecision === false) {
        continue;
      }
      const stepResult = await requestAiDecision(
        logic,
        gameId,
        step.actingAiPlayerId || definition.actingAiPlayerId,
        step.viewerPlayerId || definition.viewerPlayerId || definition.actingAiPlayerId
      );
      const execution = await executeDecisionLike(
        logic,
        gameId,
        step.actingAiPlayerId || definition.actingAiPlayerId,
        stepResult.decision
      );
      if (!execution?.success) {
        throw new Error(execution?.error || `Failed to execute AI decision for autoplay validation: ${scenarioId}`);
      }
    }

    const autoplayResult = await runInstrumentedAutoplay({
      logic,
      gameId,
      viewerPlayerId: definition.autoplayValidation.viewerPlayerId || definition.viewerPlayerId || definition.actingAiPlayerId,
      aiPlayerIds: definition.aiPlayerIds,
      maxSteps: definition.autoplayValidation.maxSteps || DEFAULT_AUTOPLAY_STEPS
    });

    autoplayResult.stateAssertions = evaluateStateAssertions(
      autoplayResult.finalState,
      definition.autoplayValidation.stateAssertions
    );

    return {
      ...decisionResult,
      autoplayResult
    };
  } finally {
    cleanup();
  }
}

function createEnergyCard(playerId, setId, index) {
  return {
    carduid: `energy_basic_${setId}_${playerId}_${String(index).padStart(4, '0')}`,
    cardId: 'energy_basic',
    placedAt: 0,
    placedBy: playerId,
    isRested: false,
    isExtraEnergy: false
  };
}

function createUnitCard(playerId, cardId, uidSuffix) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  if (!cardData || cardData.cardType !== 'unit') {
    throw new Error(`Unable to create unit card for ${cardId}`);
  }
  return {
    carduid: `${cardId}_${uidSuffix}`,
    cardId,
    cardData,
    placedAt: 0,
    placedBy: playerId,
    isRested: false,
    damageReceived: 0,
    modifyAP: 0,
    modifyHP: 0,
    continueModifyAP: 0,
    continueModifyHP: 0,
    originalAP: Number(cardData.ap || 0),
    originalHP: Number(cardData.hp || 0),
    playedThisTurn: false,
    canAttackOnPlayTurn: true,
    canAttackThisTurn: true,
    isFirstPlay: false
  };
}

function createZoneCard(playerId, cardId, uidSuffix) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  return {
    carduid: `${cardId}_${uidSuffix}`,
    cardId,
    cardData
  };
}

function loadSetCards(setId) {
  const filePath = path.join(process.cwd(), 'src', 'data', `${setId.toLowerCase()}Card.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cards = Array.isArray(raw.cards) ? raw.cards : Array.isArray(raw) ? raw : Object.values(raw.cards || raw);
  return cards.filter((card) => {
    const cardId = String(card.cardId || card.id || '').toUpperCase();
    return cardId.startsWith(`${setId}-`) && !/^T-\d+$/i.test(cardId);
  });
}

function tryLoadStarterDeckCardIds(setId) {
  const sourceFile = STARTER_DECK_SOURCE_FILES[setId];
  if (!sourceFile) {
    return null;
  }

  const filePath = path.join(process.cwd(), 'src', 'data', sourceFile);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const cards = parsed?.decks?.deck001?.cards;
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  const cardIds = cards
    .map((entry) => String(entry).split('/').pop()?.toUpperCase() || '')
    .filter(Boolean);

  if (cardIds.length === 0 || !cardIds.every((cardId) => cardId.startsWith(`${setId}-`))) {
    return null;
  }

  return cardIds;
}

function buildStarterDeckCardIds(setId, deckSize = 50) {
  const starterDeckCardIds = tryLoadStarterDeckCardIds(setId);
  if (starterDeckCardIds && starterDeckCardIds.length > 0) {
    return starterDeckCardIds.slice(0, deckSize);
  }

  const cards = loadSetCards(setId)
    .map((card) => ({
      cardId: String(card.cardId || card.id).toUpperCase(),
      cardType: String(card.cardType || '')
    }))
    .filter((card) => card.cardId && card.cardType !== 'token');

  if (cards.length === 0) {
    throw new Error(`No starter or set cards found for ${setId}`);
  }

  const orderedCardIds = cards.map((card) => card.cardId);
  const deck = [];
  for (let index = 0; index < deckSize; index += 1) {
    deck.push(orderedCardIds[index % orderedCardIds.length]);
  }
  return deck;
}

function buildStarterMirrorMatchGameEnv(setId, options = {}) {
  return buildStarterMatchGameEnv(setId, setId, options);
}

function buildStarterMatchGameEnv(playerOneSetId, playerTwoSetId, options = {}) {
  const {
    aiPlayerIds = ['playerId_1', 'playerId_2'],
    currentPlayer = 'playerId_1',
    currentTurn = 4,
    startingEnergy = 4,
    startingHand = 6,
    startingShield = 4,
    boardUnitCount = 2
  } = options;

  const gameEnv = new GameEnvironment();
  const playerConfigs = [
    { playerId: 'playerId_1', setId: playerOneSetId },
    { playerId: 'playerId_2', setId: playerTwoSetId }
  ];
  for (const { playerId, setId } of playerConfigs) {
    const player = gameEnv.addPlayer(playerId, playerId);
    const deckCardIds = buildStarterDeckCardIds(setId, 50);
    const deckCopy = [...deckCardIds];
    const unitCardIds = loadSetCards(setId)
      .filter((card) => String(card.cardType || '') === 'unit')
      .map((card) => String(card.cardId || card.id).toUpperCase());

    const boardUnits = unitCardIds.slice(0, boardUnitCount);
    boardUnits.forEach((cardId, index) => {
      player.zones[`slot${index + 1}`].unit = createUnitCard(playerId, cardId, `${setId}_${playerId}_board_${index}`);
    });

    player.zones.energyArea = Array.from({ length: startingEnergy }, (_unused, index) => createEnergyCard(playerId, setId, index + 1));
    player.playerPoint = startingEnergy;
    player.isReady = true;
    player.confirmIsRedraw = false;
    player.isRedraw = false;

    const shieldCards = deckCopy.splice(0, startingShield);
    player.zones.shieldArea = shieldCards.map((cardId, index) => createZoneCard(playerId, cardId, `${setId}_${playerId}_shield_${index}`));

    const handCards = deckCopy.splice(0, startingHand);
    player.deck._handUids = handCards.map((cardId, index) => `${cardId}_${setId}_${playerId}_hand_${index}`);
    player.deck.mainDeck = deckCopy.map((cardId, index) => `${cardId}_${setId}_${playerId}_deck_${index}`);
  }

  gameEnv.phase = 'MAIN_PHASE';
  gameEnv.gameStarted = true;
  gameEnv.hasChosenFirstPlayer = true;
  gameEnv.firstPlayer = 0;
  gameEnv.firstPlayerDecision = 'playerId_1';
  gameEnv.firstPlayerChooser = 'playerId_1';
  gameEnv.currentPlayer = currentPlayer;
  gameEnv.currentTurn = currentTurn;
  gameEnv.playersReady = { playerId_1: true, playerId_2: true };
  gameEnv.aiPlayerIds = [...aiPlayerIds];
  gameEnv.processingQueue = [];
  gameEnv.notificationQueue = [];
  gameEnv.pendingPhaseTransition = null;
  gameEnv.gameEnded = false;
  gameEnv.winnerId = null;

  return gameEnv;
}

async function runInstrumentedAutoplay(options) {
  const {
    logic,
    gameId,
    viewerPlayerId,
    aiPlayerIds,
    maxSteps = DEFAULT_AUTOPLAY_STEPS
  } = options;

  const decisionExecutor = new AiDecisionExecutor(logic);
  const originalThrottle = AiAutoplayCoordinator.pacingStore.getThrottleWaitMs;
  AiAutoplayCoordinator.pacingStore.getThrottleWaitMs = () => 0;

  const decisionSamples = [];
  let finalState = null;
  let stepsExecuted = 0;

  try {
    for (let step = 0; step < maxSteps; step += 1) {
      stepsExecuted = step + 1;
      const gameEnv = await getLiveState(logic, gameId, viewerPlayerId);
      finalState = gameEnv;
      if (gameEnv.gameEnded) {
        break;
      }

      const promptCount = countUnresolvedAiPrompts(gameEnv, aiPlayerIds);
      let progressed = false;
      const priorityAiPlayerIds = getPendingAiChoiceOwners(gameEnv, aiPlayerIds);
      const actingAiPlayerIds = priorityAiPlayerIds.length > 0 ? priorityAiPlayerIds : aiPlayerIds;

      for (const aiPlayerId of actingAiPlayerIds) {
        const aiView = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
        const startedAt = Date.now();
        const decision = await GameAiService.decide(aiView, aiPlayerId, { rawGameEnv: gameEnv });
        const latencyMs = Date.now() - startedAt;
        const malformedProblems = validateDecisionShape(decision);
        decisionSamples.push({
          aiPlayerId,
          step,
          latencyMs,
          kind: decision.kind,
          reason: decision.reason,
          fallbackReason: decision?.telemetry?.fallbackReason || null,
          simulatedNodeCount: Number(decision?.telemetry?.simulatedNodeCount || 0),
          budgetUsedMs: Number(decision?.telemetry?.budgetUsedMs || 0),
          budgetRemainingMs: Number(decision?.telemetry?.budgetRemainingMs || 0),
          lineHistory: Array.isArray(decision?.telemetry?.lineHistory) ? decision.telemetry.lineHistory : [],
          promptChain: Array.isArray(decision?.telemetry?.promptChain) ? decision.telemetry.promptChain : [],
          debugPayload: buildAiDebugPayload(decision),
          malformedProblems
        });

        if (decision.kind === 'wait') {
          continue;
        }

        const execution = await decisionExecutor.execute(gameId, aiPlayerId, decision);
        if (!execution?.success) {
          return {
            success: false,
            error: execution?.error || 'AI decision execution failed',
            finalState: await getLiveState(logic, gameId, viewerPlayerId),
            decisionSamples,
            unresolvedAiPromptCount: promptCount,
            stepsExecuted,
            stalled: false,
            boundedOut: false,
            lastAiDebugPayload: summarizeSampleForFailure(decisionSamples[decisionSamples.length - 1])
          };
        }

        progressed = true;
        break;
      }

      if (!progressed) {
        finalState = await getLiveState(logic, gameId, viewerPlayerId);
        return {
          success: true,
          halted: true,
          stalled: true,
          boundedOut: false,
          finalState,
          decisionSamples,
          unresolvedAiPromptCount: countUnresolvedAiPrompts(finalState, aiPlayerIds),
          stepsExecuted,
          lastAiDebugPayload: summarizeSampleForFailure(decisionSamples[decisionSamples.length - 1])
        };
      }
    }

    finalState = finalState || await getLiveState(logic, gameId, viewerPlayerId);
    return {
      success: true,
      halted: !finalState.gameEnded,
      stalled: false,
      boundedOut: !finalState.gameEnded,
      finalState,
      decisionSamples,
      unresolvedAiPromptCount: countUnresolvedAiPrompts(finalState, aiPlayerIds),
      stepsExecuted,
      lastAiDebugPayload: summarizeSampleForFailure(decisionSamples[decisionSamples.length - 1])
    };
  } finally {
    AiAutoplayCoordinator.pacingStore.getThrottleWaitMs = originalThrottle;
  }
}

async function runCoordinatorAutoplay(options) {
  const {
    logic,
    gameId,
    viewerPlayerId,
    maxSteps = DEFAULT_AUTOPLAY_STEPS
  } = options;

  const coordinator = new AiAutoplayCoordinator(logic);
  const originalThrottle = AiAutoplayCoordinator.pacingStore.getThrottleWaitMs;
  AiAutoplayCoordinator.pacingStore.getThrottleWaitMs = () => 0;

  try {
    const result = await coordinator.runAiAutoplay(gameId, viewerPlayerId, maxSteps);
    const finalState = result.gameEnv || await getLiveState(logic, gameId, viewerPlayerId);
    return {
      ...result,
      finalState,
      unresolvedAiPromptCount: countUnresolvedAiPrompts(finalState, coordinator.getAiPlayerIds(finalState))
    };
  } finally {
    AiAutoplayCoordinator.pacingStore.getThrottleWaitMs = originalThrottle;
  }
}

async function runStarterMirrorMatch(setId, options = {}) {
  return runStarterMatchup(setId, setId, options);
}

async function runStarterMatchup(playerOneSetId, playerTwoSetId, options = {}) {
  const { logic, cleanup } = createTempGameLogic();
  const gameId = `starter_${playerOneSetId.toLowerCase()}_${playerTwoSetId.toLowerCase()}_${Date.now()}`;
  try {
    const gameEnv = buildStarterMatchGameEnv(playerOneSetId, playerTwoSetId, options);
    await injectGameEnv(logic, gameId, gameEnv);
    const result = await runInstrumentedAutoplay({
      logic,
      gameId,
      viewerPlayerId: options.viewerPlayerId || 'playerId_1',
      aiPlayerIds: gameEnv.aiPlayerIds,
      maxSteps: options.maxSteps || DEFAULT_AUTOPLAY_STEPS
    });
    return {
      setId: playerOneSetId === playerTwoSetId ? playerOneSetId : `${playerOneSetId}_vs_${playerTwoSetId}`,
      playerOneSetId,
      playerTwoSetId,
      gameId,
      ...result
    };
  } finally {
    cleanup();
  }
}

async function runStarterMirrorMatchCoordinator(setId, options = {}) {
  const { logic, cleanup } = createTempGameLogic();
  const gameId = `starter_coord_${setId.toLowerCase()}_${Date.now()}`;
  try {
    const gameEnv = buildStarterMirrorMatchGameEnv(setId, options);
    await injectGameEnv(logic, gameId, gameEnv);
    const result = await runCoordinatorAutoplay({
      logic,
      gameId,
      viewerPlayerId: options.viewerPlayerId || 'playerId_1',
      maxSteps: options.maxSteps || DEFAULT_AUTOPLAY_STEPS
    });
    return {
      setId,
      gameId,
      ...result
    };
  } finally {
    cleanup();
  }
}

async function runStarterCrossMatchSample(options = {}) {
  const pairs = Array.isArray(options.crossMatchPairs) && options.crossMatchPairs.length > 0
    ? options.crossMatchPairs
    : STARTER_CROSS_MATCH_SAMPLE_PAIRS;

  const results = [];
  for (const pair of pairs) {
    const [playerOneSetId, playerTwoSetId] = pair;
    results.push(await runStarterMatchup(playerOneSetId, playerTwoSetId, options));
  }
  return results;
}

function buildRunSummary(result) {
  return {
    success: Boolean(result.success),
    halted: Boolean(result.halted),
    stalled: Boolean(result.stalled),
    boundedOut: Boolean(result.boundedOut),
    unresolvedAiPromptCount: Number(result.unresolvedAiPromptCount || 0),
    malformedDecisionCount: Array.isArray(result.decisionSamples)
      ? result.decisionSamples.reduce((sum, sample) => sum + (sample.malformedProblems?.length || 0), 0)
      : 0,
    executionFailure: result.success === false ? (result.error || 'unknown_error') : null,
    lastAiDebugPayload: result.lastAiDebugPayload || summarizeSampleForFailure(
      Array.isArray(result.decisionSamples) ? result.decisionSamples[result.decisionSamples.length - 1] : null
    )
  };
}

async function runAiValidationBenchmark(options = {}) {
  const scenarioIds = Array.isArray(options.scenarioIds) && options.scenarioIds.length > 0
    ? options.scenarioIds
    : AI_SCENARIO_IDS;
  const tuningScenarioIds = Array.isArray(options.tuningScenarioIds) && options.tuningScenarioIds.length > 0
    ? options.tuningScenarioIds
    : AI_TUNING_SCENARIO_IDS;
  const starterSetIds = Array.isArray(options.starterSetIds) && options.starterSetIds.length > 0
    ? options.starterSetIds
    : ['ST01', 'ST04', 'ST08'];
  const crossMatchPairs = Array.isArray(options.crossMatchPairs) && options.crossMatchPairs.length > 0
    ? options.crossMatchPairs
    : STARTER_CROSS_MATCH_SAMPLE_PAIRS;

  const scenarioResults = [];
  const tuningScenarioResults = [];
  const starterResults = [];
  const crossMatchResults = [];
  const allSamples = [];

  for (const scenarioId of scenarioIds) {
    const scenarioResult = await runScenarioValidation(scenarioId);
    scenarioResults.push({
      scenarioId,
      unresolvedAiPromptCount: scenarioResult.unresolvedAiPromptCount,
      stepCount: scenarioResult.stepResults.length,
      autoplay: scenarioResult.autoplayResult
        ? {
            unresolvedAiPromptCount: scenarioResult.autoplayResult.unresolvedAiPromptCount,
            halted: Boolean(scenarioResult.autoplayResult.halted),
            stalled: Boolean(scenarioResult.autoplayResult.stalled),
            boundedOut: Boolean(scenarioResult.autoplayResult.boundedOut)
          }
        : null
    });
    allSamples.push(...scenarioResult.stepResults.map((step) => ({
      latencyMs: step.latencyMs,
      fallbackReason: step.fallbackReason,
      simulatedNodeCount: step.simulatedNodeCount,
      malformedProblems: step.malformedProblems
    })));
    if (scenarioResult.autoplayResult?.decisionSamples) {
      allSamples.push(...scenarioResult.autoplayResult.decisionSamples);
    }
  }

  for (const scenarioId of tuningScenarioIds) {
    const scenarioResult = await runScenarioValidation(scenarioId);
    tuningScenarioResults.push({
      scenarioId,
      unresolvedAiPromptCount: scenarioResult.unresolvedAiPromptCount,
      stepCount: scenarioResult.stepResults.length,
      autoplay: scenarioResult.autoplayResult
        ? {
            unresolvedAiPromptCount: scenarioResult.autoplayResult.unresolvedAiPromptCount,
            halted: Boolean(scenarioResult.autoplayResult.halted),
            stalled: Boolean(scenarioResult.autoplayResult.stalled),
            boundedOut: Boolean(scenarioResult.autoplayResult.boundedOut),
            lastAiDebugPayload: scenarioResult.autoplayResult.lastAiDebugPayload || null
          }
        : null
    });
    allSamples.push(...scenarioResult.stepResults.map((step) => ({
      latencyMs: step.latencyMs,
      fallbackReason: step.fallbackReason,
      simulatedNodeCount: step.simulatedNodeCount,
      malformedProblems: step.malformedProblems
    })));
    if (scenarioResult.autoplayResult?.decisionSamples) {
      allSamples.push(...scenarioResult.autoplayResult.decisionSamples);
    }
  }

  for (const setId of starterSetIds) {
    const result = await runStarterMirrorMatch(setId, {
      aiPlayerIds: ['playerId_1', 'playerId_2'],
      maxSteps: DEFAULT_MATRIX_TURNS
    });
    starterResults.push({
      setId,
      ...buildRunSummary(result)
    });
    allSamples.push(...result.decisionSamples);
  }

  for (const [playerOneSetId, playerTwoSetId] of crossMatchPairs) {
    const result = await runStarterMatchup(playerOneSetId, playerTwoSetId, {
      aiPlayerIds: ['playerId_1', 'playerId_2'],
      maxSteps: DEFAULT_MATRIX_TURNS
    });
    crossMatchResults.push({
      setId: `${playerOneSetId}_vs_${playerTwoSetId}`,
      playerOneSetId,
      playerTwoSetId,
      ...buildRunSummary(result)
    });
    allSamples.push(...result.decisionSamples);
  }

  return {
    timestamp: new Date().toISOString(),
    scenarioIds,
    tuningScenarioIds,
    starterSetIds,
    crossMatchPairs,
    scenarioResults,
    tuningScenarioResults,
    starterResults,
    crossMatchResults,
    summary: summarizeDecisionSamples(allSamples)
  };
}

function computeLatencyMetrics(samples) {
  const latencies = samples.map((sample) => sample.latencyMs).sort((left, right) => left - right);
  const averageLatencyMs = latencies.length > 0
    ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
    : 0;
  const p95LatencyMs = latencies.length > 0
    ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]
    : 0;

  return {
    averageLatencyMs,
    p95LatencyMs,
    decisionCount: latencies.length
  };
}

function summarizeDecisionSamples(samples) {
  const malformedDecisions = samples.filter((sample) => sample.malformedProblems.length > 0);
  const emergencyFallbacks = samples.filter((sample) => sample.fallbackReason).length;
  const simulatedNodeCounts = samples.map((sample) => sample.simulatedNodeCount);
  const latency = computeLatencyMetrics(samples);

  return {
    ...latency,
    malformedDecisionCount: malformedDecisions.length,
    emergencyFallbackRate: samples.length > 0 ? emergencyFallbacks / samples.length : 0,
    averageSimulatedNodeCount: simulatedNodeCounts.length > 0
      ? simulatedNodeCounts.reduce((sum, value) => sum + value, 0) / simulatedNodeCounts.length
      : 0
  };
}

module.exports = {
  AI_SCENARIO_IDS,
  AI_TUNING_SCENARIO_IDS,
  STARTER_SET_IDS,
  STARTER_CROSS_MATCH_SAMPLE_PAIRS,
  DEFAULT_AUTOPLAY_STEPS,
  DEFAULT_MATRIX_TURNS,
  loadAiScenarioDefinition,
  buildGameEnvFromScenarioDefinition,
  createTempGameLogic,
  injectGameEnv,
  applySetupActions,
  requestAiDecision,
  runScenarioDecisionSequence,
  runScenarioValidation,
  buildStarterMirrorMatchGameEnv,
  runStarterMirrorMatch,
  runStarterMatchup,
  runStarterMirrorMatchCoordinator,
  runStarterCrossMatchSample,
  runInstrumentedAutoplay,
  runCoordinatorAutoplay,
  runAiValidationBenchmark,
  countUnresolvedAiPrompts,
  validateDecisionShape,
  evaluateStateAssertions,
  evaluateDecisionExpectation,
  summarizeDecisionSamples,
  computeLatencyMetrics
};
