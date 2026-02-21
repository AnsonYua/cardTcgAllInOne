const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { AttackPreparationManager } = require('../services/AttackPreparationManager');
const st04 = require('../data/st04Card.json');

function findUnit(player, carduid) {
    for (let i = 1; i <= 6; i += 1) {
        const slot = player.zones[`slot${i}`];
        if (slot?.unit?.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('ST04-015 activate set-active restriction', () => {
    test('targets only blocker unit and applies cannot_attack this turn', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const baseUid = 'ST04-015_base_0001';
        const blockerUid = 'ST04-001_blocker_0001';
        const nonBlockerUid = 'ST01-001_unit_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: baseUid,
            playAs: 'base'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: blockerUid,
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: nonBlockerUid,
            playAs: 'unit'
        }).success).toBe(true);

        const player = gameEnv.getPlayer('playerId_1');
        const blockerUnit = findUnit(player, blockerUid);
        const nonBlockerUnit = findUnit(player, nonBlockerUid);
        expect(blockerUnit).toBeTruthy();
        expect(nonBlockerUnit).toBeTruthy();

        blockerUnit.isRested = true;
        nonBlockerUnit.isRested = true;

        const activateRule = st04.cards['ST04-015'].effects.rules.find((rule) => rule.effectId === 'activate_set_active');
        expect(activateRule).toBeTruthy();

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            baseUid,
            activateRule
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(blockerUnit.isRested).toBe(false);
        expect(nonBlockerUnit.isRested).toBe(true);

        const attackValidation = AttackPreparationManager.validateShieldAttackAttacker(
            gameEnv,
            'playerId_1',
            blockerUid
        );
        expect(attackValidation.success).toBe(false);
        expect(attackValidation.error).toContain('cannot attack during this turn');
    });
});
