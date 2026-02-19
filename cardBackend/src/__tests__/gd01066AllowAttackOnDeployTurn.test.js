const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { applyAllowAttackTargetEffect } = require('../services/effects/actions/EffectAllowAttackTargetActions');
const { canUnitAttackThisTurn } = require('../utils/UnitAttackUtils');

function findUnitAndSlot(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();

    for (let i = 1; i <= 6; i++) {
        const slotName = `slot${i}`;
        const slot = player.zones?.[slotName];
        if (slot?.unit?.carduid === carduid) {
            return { unit: slot.unit, slotName };
        }
    }

    return null;
}

describe('GD01-066 deploy-turn token attack permission', () => {
    test('allowAttackOnDeployTurn grants canAttackOnPlayTurn to chosen token', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const tokenUid = 'T-011_token_test_0001';
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: tokenUid,
                playAs: 'unit'
            }).success
        ).toBe(true);

        const found = findUnitAndSlot(gameEnv, 'playerId_1', tokenUid);
        expect(found).toBeTruthy();
        expect(found.unit.playedThisTurn).toBe(true);
        expect(found.unit.canAttackOnPlayTurn).toBe(false);
        expect(canUnitAttackThisTurn(found.unit)).toBe(false);

        const effect = {
            action: 'allow_attack_target',
            parameters: {
                allowAttackOnDeployTurn: true
            },
            timing: {
                duration: 'UNTIL_END_OF_TURN'
            }
        };

        const result = applyAllowAttackTargetEffect(
            gameEnv,
            'playerId_1',
            'GD01-066_source_test_0001',
            effect,
            [
                {
                    carduid: tokenUid,
                    zone: found.slotName,
                    playerId: 'playerId_1'
                }
            ]
        );

        expect(result.success).toBe(true);
        expect(found.unit.canAttackOnPlayTurn).toBe(true);
        expect(canUnitAttackThisTurn(found.unit)).toBe(true);
        expect(
            found.unit.temporaryEffects?.some(
                (temp) => temp?.allowAttackTarget?.allowAttackOnDeployTurn === true
            )
        ).toBe(true);
    });
});
