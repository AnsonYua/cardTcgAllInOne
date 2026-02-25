const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const { EnergyManager } = require('../services/EnergyManager');
const gd03 = require('../data/gd03Card.json');
const { makeZoneLikeCard } = require('./helpers/p2AuditFixtures');

function getLinkedDeploySequenceEffect() {
    return gd03.cards['GD03-051'].effects.rules.find((rule) => rule.effectId === 'linked_effect');
}

function buildBaseEnv() {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.currentTurn = 1;

    p1.zones.slot1.unit = makeZoneLikeCard('GD03-051_unit_0001', 'GD03-051', gd03.cards['GD03-051']);

    EnergyManager.addBasicEnergy(gameEnv, 'playerId_1');
    EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true });
    EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true });
    EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true });

    return { gameEnv, p1 };
}

function startLinkedDeployChoice(gameEnv) {
    const effect = getLinkedDeploySequenceEffect();
    expect(effect).toBeTruthy();
    return SequenceEffectManager.processSequenceEffect(gameEnv, 'playerId_1', 'GD03-051_unit_0001', effect);
}

describe('deploy payCost target affordability filtering', () => {
    test('deploy + payCost hides unaffordable trash targets in TARGET_CHOICE', () => {
        const { gameEnv, p1 } = buildBaseEnv();
        p1.zones.trashArea = [
            makeZoneLikeCard('GD03-058_trash_0001', 'GD03-058', gd03.cards['GD03-058']),
            makeZoneLikeCard('GD03-031_trash_0001', 'GD03-031', gd03.cards['GD03-031'])
        ];

        const result = startLinkedDeployChoice(gameEnv);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();
        const targetUids = (choiceEvent.data.availableTargets || []).map((target) => target.carduid);

        expect(targetUids).toContain('GD03-058_trash_0001');
        expect(targetUids).not.toContain('GD03-031_trash_0001');
    });

    test('deploy payment uses effective trash cost modifier during resolution', () => {
        const { gameEnv, p1 } = buildBaseEnv();
        p1.zones.trashArea = [
            makeZoneLikeCard('GD03-058_trash_0001', 'GD03-058', gd03.cards['GD03-058']),
            makeZoneLikeCard('GD03-031_trash_0001', 'GD03-031', gd03.cards['GD03-031'])
        ];

        const start = startLinkedDeployChoice(gameEnv);
        expect(start.success).toBe(true);
        expect(start.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.availableTargets).toHaveLength(1);

        const activeBefore = p1.zones.energyArea.filter((c) => !c.isRested).length;
        const selectedTarget = choiceEvent.data.availableTargets[0];

        const handled = SequenceTargetChoiceHandler.tryHandle(gameEnv, choiceEvent, [selectedTarget]);
        expect(handled.handled).toBe(true);
        expect(handled.success).toBe(true);

        const continueEvent = gameEnv.processingQueue.find(
            (event) => event.type === 'PLAYER_ACTION' && event.data.actionType === 'continueSequence'
        );
        expect(continueEvent).toBeTruthy();

        const continued = SequenceContinuationManager.continueSequence(gameEnv, continueEvent);
        expect(continued.success).toBe(true);

        const activeAfter = p1.zones.energyArea.filter((c) => !c.isRested).length;
        expect(activeBefore - activeAfter).toBe(1);

        const deployedUids = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .map((slot) => p1.zones[slot]?.unit?.carduid)
            .filter(Boolean);
        expect(deployedUids).toContain('GD03-058_trash_0001');
        expect(p1.zones.trashArea.some((c) => c.carduid === 'GD03-058_trash_0001')).toBe(false);
    });

    test('optional deploy with no affordable candidates does not create misleading TARGET_CHOICE', () => {
        const { gameEnv, p1 } = buildBaseEnv();
        p1.zones.trashArea = [
            makeZoneLikeCard('GD03-031_trash_0001', 'GD03-031', gd03.cards['GD03-031'])
        ];

        const result = startLinkedDeployChoice(gameEnv);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeFalsy();
        expect(p1.zones.slot2.unit).toBeFalsy();
        expect(p1.zones.trashArea.some((c) => c.carduid === 'GD03-031_trash_0001')).toBe(true);
    });

    test('non-payCost deploy keeps filter-valid targets visible', () => {
        const { gameEnv, p1 } = buildBaseEnv();
        p1.zones.trashArea = [
            makeZoneLikeCard('GD03-058_trash_0001', 'GD03-058', gd03.cards['GD03-058']),
            makeZoneLikeCard('GD03-031_trash_0001', 'GD03-031', gd03.cards['GD03-031'])
        ];

        const baseEffect = getLinkedDeploySequenceEffect();
        const noPayCostEffect = JSON.parse(JSON.stringify(baseEffect));
        noPayCostEffect.parameters.steps[0].parameters.payCost = false;

        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD03-051_unit_0001',
            noPayCostEffect
        );
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();
        const targetUids = (choiceEvent.data.availableTargets || []).map((target) => target.carduid);
        expect(targetUids).toContain('GD03-058_trash_0001');
        expect(targetUids).toContain('GD03-031_trash_0001');
    });
});

