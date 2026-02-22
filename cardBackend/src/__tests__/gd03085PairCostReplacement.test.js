const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { CardPlayExecutor } = require('../services/CardPlayExecutor');
const { EnergyManager } = require('../services/EnergyManager');

function setupTurn(gameEnv) {
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.phase = 'MAIN_PHASE';
}

function playPilot(gameEnv, pilotUid, targetUnitUid) {
    return CardPlayExecutor.execute(
        {
            id: `play_evt_${pilotUid}`,
            type: 'PLAY_CARD',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                carduid: pilotUid,
                playAs: 'pilot',
                targetUnit: targetUnitUid,
                playerId: 'playerId_1'
            }
        },
        gameEnv
    );
}

describe('GD03-085 pair-target cost replacement', () => {
    test('card data includes pair_target_unit replace_cost rule', () => {
        const card = gd03.cards['GD03-085'];
        expect(card.effects.description).toHaveLength(2);
        expect(card.effects.rules).toHaveLength(2);

        const replacementRule = card.effects.rules.find((rule) => rule.effectId === 'play_pair_nt1_as_zero_cost');
        expect(replacementRule).toBeTruthy();
        expect(replacementRule.action).toBe('replace_cost');
        expect(replacementRule.parameters.replace.from.type).toBe('pair_target_unit');
        expect(replacementRule.parameters.replace.from.filters.nameIncludes).toBe('Gundam NT-1');
        expect(replacementRule.parameters.replace.to.cost).toBe(0);
    });

    test('plays at 0 cost when paired target unit name includes Gundam NT-1', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const nt1UnitUid = 'GD03-001_nt1_unit_0001';
        const pilotUid = 'GD03-085_pilot_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: nt1UnitUid, playAs: 'unit' }).success).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);

        p1.deck._handUids = [pilotUid];
        p1.deck.handUids = [pilotUid];

        const result = playPilot(gameEnv, pilotUid, nt1UnitUid);
        expect(result.success).toBe(true);
        expect(p1.deck.handUids).not.toContain(pilotUid);
    });

    test('fails with insufficient energy when paired target is not Gundam NT-1', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const nonNt1UnitUid = 'GD03-014_non_nt1_unit_0001';
        const pilotUid = 'GD03-085_pilot_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: nonNt1UnitUid, playAs: 'unit' }).success).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);

        p1.deck._handUids = [pilotUid];
        p1.deck.handUids = [pilotUid];

        const result = playPilot(gameEnv, pilotUid, nonNt1UnitUid);
        expect(result.success).toBe(false);
        expect(String(result.error || '')).toContain('Not enough active energy');
        expect(p1.deck.handUids).toContain(pilotUid);
    });

    test('uses normal cost payment when paired target is not Gundam NT-1 and energy is available', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const nonNt1UnitUid = 'GD03-014_non_nt1_unit_0002';
        const pilotUid = 'GD03-085_pilot_0003';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: nonNt1UnitUid, playAs: 'unit' }).success).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1', { rested: true })).toBe(true);
        expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);

        p1.deck._handUids = [pilotUid];
        p1.deck.handUids = [pilotUid];

        const result = playPilot(gameEnv, pilotUid, nonNt1UnitUid);
        expect(result.success).toBe(true);
        expect(p1.deck.handUids).not.toContain(pilotUid);

        const restedEnergyCount = (p1.zones.energyArea || []).filter((card) => card.isRested).length;
        expect(restedEnergyCount).toBe(3);
    });
});
