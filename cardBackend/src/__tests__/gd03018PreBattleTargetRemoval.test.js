const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType, PlayerActionType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { processAction } = require('../services/actions/ActionProcessor');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.zones) return null;
    for (let i = 1; i <= 6; i++) {
        const unit = player.zones[`slot${i}`]?.unit;
        if (unit?.carduid === carduid) return unit;
    }
    return null;
}

function latestBattleResolved(gameEnv) {
    const events = (gameEnv.notificationQueue || []).filter((entry) => (entry?.type || '').toUpperCase() === 'BATTLE_RESOLVED');
    return events.length > 0 ? events[events.length - 1] : null;
}

describe('GD03-018 pre-battle target removal handling', () => {
    test('attackUnit succeeds and emits aborted battle resolution when ATTACK_PHASE effect kills target', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const attackerUid = 'GD03-018_attacker_0001';
        const targetUid = 'GD03-083_enemy_defender_0001';
        const baseUid = 'GD03-125_base_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: baseUid, playAs: 'base' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: targetUid, playAs: 'unit' }).success).toBe(true);

        const attackerBefore = findUnit(gameEnv, 'playerId_1', attackerUid);
        const targetBefore = findUnit(gameEnv, 'playerId_2', targetUid);
        expect(attackerBefore).toBeTruthy();
        expect(targetBefore).toBeTruthy();
        const attackerDamageBeforeAttack = attackerBefore.damageReceived || 0;
        attackerBefore.isRested = false;
        attackerBefore.playedThisTurn = false;
        attackerBefore.canAttackThisTurn = true;
        targetBefore.isRested = true;

        const result = await processAction(gameEnv, {
            type: PlayerActionType.PLAYER_ACTION,
            playerId: 'playerId_1',
            gameId: 'gd03_018_pre_battle_target_removed',
            actionType: 'attackUnit',
            attackerCarduid: attackerUid,
            targetType: 'unit',
            targetUnitUid: targetUid,
            targetPlayerId: 'playerId_2'
        });

        expect(result.success).toBe(true);
        expect(String(result.error || '')).not.toContain('not found in any slot');
        expect(findUnit(gameEnv, 'playerId_2', targetUid)).toBeFalsy();
        expect(findUnit(gameEnv, 'playerId_1', attackerUid)).toBeTruthy();
        expect(findUnit(gameEnv, 'playerId_1', attackerUid).isRested).toBe(true);
        expect(findUnit(gameEnv, 'playerId_1', attackerUid).damageReceived || 0).toBe(attackerDamageBeforeAttack);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload?.result?.aborted).toBe(true);
        expect(resolution.payload?.result?.battleEndedEarly).toBe(true);
        expect(resolution.payload?.result?.abortReason).toBe('TARGET_NOT_ON_BOARD');
        expect(resolution.payload?.result?.targetMissing).toBe(true);
        expect(resolution.payload?.result?.attackerDamageTaken).toBe(0);
        expect(resolution.payload?.result?.defenderDamageTaken).toBe(0);
        expect(resolution.payload?.result?.battleDamageApplied).toBe(false);
        expect(resolution.payload?.result?.damageStepExecuted).toBe(false);

        const attackDeclared = (gameEnv.notificationQueue || []).find(
            (entry) => (entry?.type || '').toUpperCase() === 'UNIT_ATTACK_DECLARED'
        );
        expect(attackDeclared).toBeTruthy();
        expect(attackDeclared.payload?.battleEnd).toBe(true);

        const shieldEvents = (gameEnv.notificationQueue || []).filter((entry) => (entry?.type || '').toUpperCase().includes('SHIELD'));
        expect(shieldEvents.length).toBe(0);

        const gd03125Choice = gameEnv.processingQueue.find((entry) =>
            entry?.type === EventType.TARGET_CHOICE && entry?.data?.effect?.effectId === 'effect'
        );
        expect(gd03125Choice).toBeFalsy();
    });
});
