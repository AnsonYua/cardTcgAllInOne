const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const gd02 = require('../data/gd02Card.json');
const { createPilotZoneCard, createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('GD02-107 main effect', () => {
    test('deals 1 to all enemy non-link units without target choice', () => {
        const effect = gd02.cards['GD02-107'].effects.rules.find((r) => r.effectId === 'play_effect');
        expect(effect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        // Opponent slot1/slot2 are non-link units (no pilot paired)
        const zoneExtras = {
            placedAt: 0,
            placedBy: 'playerId_2',
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false
        };
        p2.zones.slot1.unit = createUnitZoneCard({ carduid: 'enemy_nonlink_1', cardId: 'ENEMY-1', ap: 2, hp: 3, zoneExtras });
        p2.zones.slot2.unit = createUnitZoneCard({ carduid: 'enemy_nonlink_2', cardId: 'ENEMY-2', ap: 2, hp: 3, zoneExtras });

        // Opponent slot3 is a link unit (has paired pilot) and should be excluded by filter.
        p2.zones.slot3.unit = createUnitZoneCard({ carduid: 'enemy_link_1', cardId: 'ENEMY-3', ap: 2, hp: 3, zoneExtras });
        p2.zones.slot3.pilot = createPilotZoneCard({
            carduid: 'enemy_pilot_1',
            cardId: 'PILOT-1',
            name: 'Pilot',
            ap: 1,
            hp: 1,
            zoneExtras: { placedAt: 0, placedBy: 'playerId_2', isFirstPlay: false }
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-107_cmd_test_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
        expect(p2.zones.slot2.unit.damageReceived).toBe(1);
        expect(p2.zones.slot3.unit.damageReceived || 0).toBe(0);
    });
});
