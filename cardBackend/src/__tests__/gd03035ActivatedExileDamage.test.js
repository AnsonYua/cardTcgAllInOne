const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
const { EnergyManager } = require('../services/EnergyManager');
const gd03 = require('../data/gd03Card.json');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('GD03-035 activated effect', () => {
    test('when multiple pilot cards exist in trash, player must choose which pilot to exile', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        EnergyManager.addBasicEnergy(gameEnv, 'playerId_1');

        const activateEffect = gd03.cards['GD03-035'].effects.rules.find((r) => r.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-035_unit_0001',
            cardId: 'GD03-035',
            name: 'GFreD',
            ap: 4,
            hp: 5,
            effectsRules: [activateEffect],
            zoneExtras: {
                placedAt: 0,
                placedBy: 'playerId_1',
                playedThisTurn: false,
                canAttackOnPlayTurn: false,
                canAttackThisTurn: true,
                isFirstPlay: false
            }
        });

        p1.zones.trashArea = [
            {
                carduid: 'pilot_cost_0001',
                cardId: 'ST01-001',
                cardData: { id: 'ST01-001', name: 'Pilot A', cardType: 'pilot' }
            },
            {
                carduid: 'pilot_cost_0002',
                cardId: 'ST01-002',
                cardData: { id: 'ST01-002', name: 'Pilot B', cardType: 'pilot' }
            }
        ];

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_2',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-035_unit_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const targetChoiceEvent = gameEnv.processingQueue.find((evt) => evt.type === 'TARGET_CHOICE');
        expect(targetChoiceEvent).toBeTruthy();
        expect(targetChoiceEvent.data.effect.action).toBe('exileFromTrash');

        const available = Array.isArray(targetChoiceEvent.data.availableTargets)
            ? targetChoiceEvent.data.availableTargets
            : [];
        expect(available.length).toBe(2);
        available.forEach((target) => {
            expect(target.zone).toBe('trash');
            expect(target.cardData.cardType).toBe('pilot');
        });
    });

    test('pays 1 energy, exiles 1 pilot from trash, and deals 1 to all enemy units', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        EnergyManager.addBasicEnergy(gameEnv, 'playerId_1');

        const activateEffect = gd03.cards['GD03-035'].effects.rules.find((r) => r.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-035_unit_0001',
            cardId: 'GD03-035',
            name: 'GFreD',
            ap: 4,
            hp: 5,
            effectsRules: [activateEffect],
            zoneExtras: {
                placedAt: 0,
                placedBy: 'playerId_1',
                playedThisTurn: false,
                canAttackOnPlayTurn: false,
                canAttackThisTurn: true,
                isFirstPlay: false
            }
        });

        p1.zones.trashArea = [
            {
                carduid: 'pilot_cost_0001',
                cardId: 'ST01-001',
                cardData: { id: 'ST01-001', name: 'Pilot', cardType: 'pilot' }
            }
        ];

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_unit_0001',
            cardId: 'ENEMY-1',
            ap: 2,
            hp: 3,
            zoneExtras: {
                placedAt: 0,
                placedBy: 'playerId_1',
                playedThisTurn: false,
                canAttackOnPlayTurn: false,
                canAttackThisTurn: true,
                isFirstPlay: false
            }
        });
        p2.zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_unit_0002',
            cardId: 'ENEMY-2',
            ap: 2,
            hp: 3,
            zoneExtras: {
                placedAt: 0,
                placedBy: 'playerId_1',
                playedThisTurn: false,
                canAttackOnPlayTurn: false,
                canAttackThisTurn: true,
                isFirstPlay: false
            }
        });

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-035_unit_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const untappedEnergy = p1.zones.energyArea.filter((card) => !card.isRested).length;
        expect(untappedEnergy).toBe(0);

        expect(p1.zones.trashArea.map((card) => card.carduid)).not.toContain('pilot_cost_0001');

        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
        expect(p2.zones.slot2.unit.damageReceived).toBe(1);
    });
});
