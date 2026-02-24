const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');

function createUnit(carduid, cardId, hp = 2, isRested = false) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            level: 2,
            ap: 2,
            hp,
            effects: { rules: [] }
        },
        originalAP: 2,
        originalHP: hp,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

describe('rest target selection', () => {
    test('rest effect excludes already-rested units from valid targets', () => {
        const gameEnv = new GameEnvironment();
        const player1 = gameEnv.addPlayer('playerId_1', 'P1');
        const player2 = gameEnv.addPlayer('playerId_2', 'P2');

        player1.zones.slot1.unit = createUnit('source_unit_0001', 'GD03-103');
        player2.zones.slot1.unit = createUnit('enemy_rested_hp2_0001', 'ST03-008', 2, true);
        player2.zones.slot2.unit = createUnit('enemy_rested_hp2_0002', 'ST03-008', 2, true);

        const effect = {
            effectId: 'burst_effect',
            type: 'triggered',
            trigger: 'BURST_CONDITION',
            action: 'rest',
            target: {
                type: 'unit',
                scope: 'opponent',
                count: 1,
                selection: { type: 'player_choice' },
                filters: { hp: '<=2' }
            }
        };

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'source_unit_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.autoApplied).toBe(true);
        expect(result.requiresSelection).toBeUndefined();
    });
});

