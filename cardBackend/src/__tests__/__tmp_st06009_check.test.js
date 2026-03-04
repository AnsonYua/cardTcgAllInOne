const { GameEnvironment } = require('../models/GameEnvironment');
const { createZoneCard } = require('../models/CardSystem');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { PromptChoiceManager } = require('../services/effects/PromptChoiceManager');
const { OptionChoiceManager } = require('../services/effects/OptionChoiceManager');
const { EventType } = require('../models/GameEnums');

function buildLinkUnit(carduid, linkTraits) {
  return createZoneCard(
    carduid,
    'TEST-LINK-UNIT',
    {
      id: 'TEST-LINK-UNIT',
      name: 'Test Link Unit',
      cardType: 'unit',
      color: 'Green',
      level: 3,
      traits: ['Clan'],
      link: linkTraits,
      ap: 3,
      hp: 3,
      effects: { description: [], rules: [] }
    },
    'playerId_1',
    'unit'
  );
}

function pairSt06009OntoSlot1(gameEnv) {
  const placeResult = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
    carduid: 'ST06-009_pilot_test_0001',
    playAs: 'pilot',
    targetUnit: 'TEST-LINK-UNIT_0001'
  });
  expect(placeResult.success).toBe(true);

  const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
    {
      playerId: 'playerId_1',
      carduid: 'ST06-009_pilot_test_0001',
      playAs: 'pilot',
      targetUnit: 'TEST-LINK-UNIT_0001'
    },
    gameEnv,
    'playerId_1'
  );

  return pairingEvent;
}

describe('tmp ST06-009 check', () => {
  test('linked: top Clan card can be taken to hand; non-Clan auto-bottoms', () => {
    const gameEnv = new GameEnvironment();
    const player = gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.phase = 'MAIN_PHASE';
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.currentTurn = 1;

    player.zones.slot1.unit = buildLinkUnit('TEST-LINK-UNIT_0001', ['Clan']);

    // Case 1: top card is Clan -> prompt + TAKE/BOTTOM options
    player.deck.mainDeck = ['ST06-002_top_0001', 'ST03-006_top_0002'];
    let pairingEvent = pairSt06009OntoSlot1(gameEnv);
    expect(pairingEvent).toBeTruthy();

    const processResult = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', pairingEvent.data);
    expect(processResult.success).toBe(true);

    const promptChoice = gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE);
    expect(promptChoice).toBeTruthy();
    promptChoice.status = 'RESOLVING';
    promptChoice.data.userDecisionMade = true;
    promptChoice.data.selectedOptionIndex = 0;
    expect(PromptChoiceManager.executePromptChoice(promptChoice, gameEnv).success).toBe(true);

    const optionChoice = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
    expect(optionChoice).toBeTruthy();
    expect(optionChoice.data.availableOptions.some((opt) => opt.payload?.action === 'TAKE')).toBe(true);
    expect(optionChoice.data.availableOptions.some((opt) => opt.payload?.action === 'BOTTOM')).toBe(true);

    const takeIndex = optionChoice.data.availableOptions.find((opt) => opt.payload?.action === 'TAKE').index;
    optionChoice.status = 'RESOLVING';
    optionChoice.data.userDecisionMade = true;
    optionChoice.data.selectedOptionIndex = takeIndex;
    expect(OptionChoiceManager.executeOptionChoice(optionChoice, gameEnv).success).toBe(true);

    expect(player.deck.handUids).toContain('ST06-002_top_0001');
    expect(player.deck.mainDeck).toEqual(['ST03-006_top_0002']);

    // Case 2: top card is non-Clan -> no choice, auto move top to bottom
    player.zones.slot1.pilot = undefined;
    player.deck.mainDeck = ['ST03-006_top_1001', 'ST06-002_top_1002'];
    pairingEvent = pairSt06009OntoSlot1(gameEnv);
    expect(pairingEvent).toBeTruthy();

    const beforeQueueLen = gameEnv.processingQueue.length;
    const processResult2 = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', pairingEvent.data);
    expect(processResult2.success).toBe(true);
    const afterQueueLen = gameEnv.processingQueue.length;

    // no new prompt/option choice events should be enqueued for no-match branch
    const newEvents = gameEnv.processingQueue.slice(beforeQueueLen, afterQueueLen);
    expect(newEvents.some((event) => event.type === EventType.PROMPT_CHOICE || event.type === EventType.OPTION_CHOICE)).toBe(false);
    expect(player.deck.mainDeck).toEqual(['ST06-002_top_1002', 'ST03-006_top_1001']);
  });

  test('unlinked: ST06-009 pairing effect does not trigger', () => {
    const gameEnv = new GameEnvironment();
    const player = gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.phase = 'MAIN_PHASE';
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.currentTurn = 1;

    // Unit link does not match ST06-009 pilot identity/traits (Clan/Newtype)
    player.zones.slot1.unit = buildLinkUnit('TEST-LINK-UNIT_0001', ['Zeon']);

    const pairingEvent = pairSt06009OntoSlot1(gameEnv);
    expect(pairingEvent).toBeNull();
  });
});
