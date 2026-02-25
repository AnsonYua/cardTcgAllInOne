const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const { EnergyManager } = require('../services/EnergyManager');
const gd03 = require('../data/gd03Card.json');
const { makeZoneLikeCard } = require('./helpers/p2AuditFixtures');

describe('GD03-130 optional deploy payCost semantics audit', () => {
    test('optional deploy from trash can be declined without paying cost', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;

        const deployEffect = gd03.cards['GD03-130'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployEffect).toBeTruthy();

        p1.zones.shieldArea = [
            makeZoneLikeCard('shield_card_0001', 'GD03-044', { id: 'GD03-044', cardType: 'unit', traits: [], ap: 3, hp: 3 })
        ];
        p1.zones.trashArea = [makeZoneLikeCard('GD03-059_trash_0001', 'GD03-059', gd03.cards['GD03-059'])];
        EnergyManager.addBasicEnergy(gameEnv, 'playerId_1');
        const untappedBefore = p1.zones.energyArea.filter((c) => !c.isRested).length;

        const start = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD03-130_base_0001', deployEffect);
        expect(start.success).toBe(true);
        expect(start.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.effect.action).toBe('deploy');
        expect(choiceEvent.data.effect.optional).toBe(true);

        const decline = SequenceTargetChoiceHandler.tryHandle(gameEnv, choiceEvent, []);
        expect(decline.handled).toBe(true);
        expect(decline.success).toBe(true);

        const continueEvent = gameEnv.processingQueue.find(
            (event) => event.type === 'PLAYER_ACTION' && event.data.actionType === 'continueSequence'
        );
        expect(continueEvent).toBeTruthy();

        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continueEvent);
        expect(continueResult.success).toBe(true);

        expect(p1.deck.handUids).toContain('shield_card_0001');
        expect(p1.zones.trashArea.some((c) => c.carduid === 'GD03-059_trash_0001')).toBe(true);
        expect(p1.zones.slot1.unit).toBeFalsy();

        const untappedAfter = p1.zones.energyArea.filter((c) => !c.isRested).length;
        expect(untappedAfter).toBe(untappedBefore);
    });
});
