const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { EventType } = require('../models/GameEnums');
const gd01 = require('../data/gd01Card.json');

function getEligibleZeonUnitCardId() {
    const cards = Object.values(CardDatabaseManager.getAllCards());
    const match = cards.find((card) =>
        card &&
        card.cardType === 'unit' &&
        Array.isArray(card.traits) &&
        card.traits.includes('Zeon') &&
        typeof card.level === 'number' &&
        card.level <= 4
    );

    if (!match) {
        throw new Error('No eligible Zeon unit card found for GD01-125 test');
    }

    return match.id;
}

function countUnitsInSlots(player) {
    return ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
        .filter((slot) => player.zones[slot] && player.zones[slot].unit)
        .length;
}

describe('GD01-125 (Zanzibar) deploy effect turn gating', () => {
    test('on opponent turn, shield add executes but deploy_from_hand step is skipped', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';

        const zeonId = getEligibleZeonUnitCardId();
        const zeonUid = `${zeonId}_hand_0001`;
        owner.deck._handUids = [zeonUid];

        const shieldUid = 'GD01-001_shield_0001';
        owner.zones.shieldArea = [
            {
                carduid: shieldUid,
                cardId: 'GD01-001',
                cardData: CardDatabaseManager.getCardDetails('GD01-001')
            }
        ];

        const deployEffect = gd01.cards['GD01-125'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_shield_to_hand_then_optional_deploy_zeon_unit_le_4_if_your_turn'
        );

        const beforeUnits = countUnitsInSlots(owner);
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD01-125_SRC', deployEffect);

        expect(result.success).toBe(true);
        expect(owner.deck.handUids).toContain(shieldUid);
        expect(owner.deck.handUids).toContain(zeonUid);
        expect(countUnitsInSlots(owner)).toBe(beforeUnits);
    });

    test('on opponent turn with multiple shields, self_shield addToHand auto-resolves and still skips deploy_from_hand', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';

        const zeonId = getEligibleZeonUnitCardId();
        const zeonUid = `${zeonId}_hand_0002`;
        owner.deck._handUids = [zeonUid];

        const shieldUid1 = 'GD01-001_shield_0002';
        const shieldUid2 = 'GD01-002_shield_0003';
        owner.zones.shieldArea = [
            {
                carduid: shieldUid1,
                cardId: 'GD01-001',
                cardData: CardDatabaseManager.getCardDetails('GD01-001')
            },
            {
                carduid: shieldUid2,
                cardId: 'GD01-002',
                cardData: CardDatabaseManager.getCardDetails('GD01-002')
            }
        ];

        const baseDeployEffect = gd01.cards['GD01-125'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_shield_to_hand_then_optional_deploy_zeon_unit_le_4_if_your_turn'
        );
        const deployEffect = JSON.parse(JSON.stringify(baseDeployEffect));
        deployEffect.parameters.steps[0].target.selection = { type: 'player_choice' };

        const beforeUnits = countUnitsInSlots(owner);
        const startHandSize = owner.deck.handUids.length;
        const startShieldSize = owner.zones.shieldArea.length;
        const startQueueSize = gameEnv.processingQueue.length;

        const sequenceResult = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD01-125_SRC', deployEffect);
        expect(sequenceResult.success).toBe(true);
        expect(sequenceResult.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((evt) => evt.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();
        expect(gameEnv.processingQueue.length).toBe(startQueueSize);

        expect(owner.deck.handUids.length).toBe(startHandSize + 1);
        expect(owner.zones.shieldArea.length).toBe(startShieldSize - 1);
        expect(owner.deck.handUids).toContain(zeonUid);
        expect(countUnitsInSlots(owner)).toBe(beforeUnits);
    });

    test('on your turn, shield add executes and optional deploy_from_hand can resolve', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = owner.id;

        const zeonId = getEligibleZeonUnitCardId();
        const zeonUid = `${zeonId}_hand_0004`;
        owner.deck._handUids = [zeonUid];

        const shieldUid = 'GD01-003_shield_0004';
        owner.zones.shieldArea = [
            {
                carduid: shieldUid,
                cardId: 'GD01-003',
                cardData: CardDatabaseManager.getCardDetails('GD01-003')
            }
        ];

        const deployEffect = gd01.cards['GD01-125'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_shield_to_hand_then_optional_deploy_zeon_unit_le_4_if_your_turn'
        );

        const beforeUnits = countUnitsInSlots(owner);
        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD01-125_SRC', deployEffect);

        expect(result.success).toBe(true);
        const deployChoice = gameEnv.processingQueue.find((evt) => evt.type === EventType.TARGET_CHOICE);
        expect(deployChoice).toBeTruthy();
        deployChoice.data.selectedTargets = [deployChoice.data.availableTargets[0]];
        deployChoice.data.userDecisionMade = true;
        const processingResult = gameEnv.processEvents();
        expect(processingResult.success).toBe(true);
        expect(owner.deck.handUids).toContain(shieldUid);
        expect(owner.deck.handUids).not.toContain(zeonUid);
        expect(countUnitsInSlots(owner)).toBe(beforeUnits + 1);
    });
});
