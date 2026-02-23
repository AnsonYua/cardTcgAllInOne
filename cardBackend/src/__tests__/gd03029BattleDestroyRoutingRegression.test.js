const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType, PlayerActionType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { processAction } = require('../services/actions/ActionProcessor');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.zones) {
        return null;
    }
    for (let i = 1; i <= 6; i++) {
        const unit = player.zones[`slot${i}`]?.unit;
        if (unit?.carduid === carduid) {
            return unit;
        }
    }
    return null;
}

describe('GD03-029 battle destroy routing regression', () => {
    test('source-only BATTLE_DESTROY does not mis-route through global listener path', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const attackerUid = 'GD03-029_attacker_0001';
        const defenderUid = 'GD03-083_enemy_defender_0001';
        const blockerSurvivorUid = 'GD03-003_enemy_blocker_survivor_0001';
        const blockerDestroyedUid = 'GD03-083_enemy_blocker_destroyed_0001';
        const nonBlockerUid = 'GD03-031_enemy_non_blocker_0001';
        const baseUid = 'GD03-125_base_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: baseUid, playAs: 'base' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: defenderUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: blockerSurvivorUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: blockerDestroyedUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: nonBlockerUid, playAs: 'unit' }).success).toBe(true);

        const attacker = findUnit(gameEnv, 'playerId_1', attackerUid);
        const defender = findUnit(gameEnv, 'playerId_2', defenderUid);
        const blockerSurvivor = findUnit(gameEnv, 'playerId_2', blockerSurvivorUid);
        const blockerDestroyed = findUnit(gameEnv, 'playerId_2', blockerDestroyedUid);
        const nonBlocker = findUnit(gameEnv, 'playerId_2', nonBlockerUid);

        expect(attacker).toBeTruthy();
        expect(defender).toBeTruthy();
        expect(blockerSurvivor).toBeTruthy();
        expect(blockerDestroyed).toBeTruthy();
        expect(nonBlocker).toBeTruthy();

        attacker.damageReceived = 2;
        attacker.playedThisTurn = false;
        attacker.canAttackThisTurn = true;

        defender.isRested = true;
        blockerSurvivor.isRested = true;
        blockerDestroyed.isRested = true;
        nonBlocker.isRested = true;

        const result = await processAction(gameEnv, {
            type: PlayerActionType.PLAYER_ACTION,
            playerId: 'playerId_1',
            gameId: 'gd03_029_global_routing_regression',
            actionType: 'attackUnit',
            attackerCarduid: attackerUid,
            targetType: 'unit',
            targetUnitUid: defenderUid,
            targetPlayerId: 'playerId_2'
        });

        expect(result.success).toBe(true);
        expect(String(result.error || '')).not.toContain('Target card');
        expect(findUnit(gameEnv, 'playerId_1', attackerUid)).toBeTruthy();
        expect(findUnit(gameEnv, 'playerId_2', defenderUid)).toBeFalsy();

        const survivorAfter = findUnit(gameEnv, 'playerId_2', blockerSurvivorUid);
        const destroyedAfter = findUnit(gameEnv, 'playerId_2', blockerDestroyedUid);
        const nonBlockerAfter = findUnit(gameEnv, 'playerId_2', nonBlockerUid);

        expect(survivorAfter).toBeTruthy();
        expect(survivorAfter.damageReceived).toBe(2);
        expect(destroyedAfter).toBeFalsy();
        expect(nonBlockerAfter).toBeTruthy();
        expect(nonBlockerAfter.damageReceived || 0).toBe(0);

        const attackerAfter = findUnit(gameEnv, 'playerId_1', attackerUid);
        const gd03125Choice = gameEnv.processingQueue.find((event) =>
            event.type === EventType.TARGET_CHOICE && event?.data?.effect?.effectId === 'effect'
        );
        if (gd03125Choice) {
            const targetUids = (gd03125Choice.data.availableTargets || []).map((target) => target.carduid);
            expect(targetUids).toContain(attackerUid);
        } else {
            // Some flows auto-apply event-attacker target for optional effects.
            expect(attackerAfter.damageReceived).toBe(1);
        }
    });
});
