const { GameEnvironment } = require('../models/GameEnvironment');
const { createPilotZoneCard, createUnitZoneCard } = require('./helpers/zoneCardFactory');

function createActionStepLinkedHealEffect() {
    return {
        effectId: 'activate_heal',
        type: 'activated',
        timing: {
            windows: ['ACTION_STEP']
        },
        cost: {
            oncePerTurn: true
        },
        target: {
            type: 'unit',
            scope: 'any',
            count: 1
        },
        action: 'heal',
        parameters: {
            value: 1
        },
        sourceConditions: [{ type: 'linked' }]
    };
}

function setupBattleWithActionUnit({ linked }) {
    const gameEnv = new GameEnvironment();
    const attackerId = 'playerId_1';
    const defenderId = 'playerId_2';
    const attacker = gameEnv.addPlayer(attackerId, 'P1');
    const defender = gameEnv.addPlayer(defenderId, 'P2');
    attacker.isReady = true;
    defender.isReady = true;
    gameEnv.gameStarted = true;
    gameEnv.currentPlayer = attackerId;
    gameEnv.currentTurn = 1;

    attacker.zones.slot1.unit = createUnitZoneCard({
        carduid: 'atk_unit_0001',
        cardId: 'ATK-001',
        name: 'Battle Attacker',
        ap: 3,
        hp: 3
    });

    attacker.zones.slot3.unit = createUnitZoneCard({
        carduid: 'heal_unit_0001',
        cardId: 'HEAL-001',
        name: 'Action Healer',
        ap: 1,
        hp: 3,
        link: ['White Base Team'],
        effectsRules: [createActionStepLinkedHealEffect()]
    });

    if (linked) {
        attacker.zones.slot3.pilot = createPilotZoneCard({
            carduid: 'heal_pilot_0001',
            cardId: 'PILOT-001',
            name: 'Linked Pilot',
            traits: ['White Base Team']
        });
    }

    gameEnv.setCurrentBattle({
        actionType: 'attackShieldArea',
        attackingPlayerId: attackerId,
        defendingPlayerId: defenderId,
        attackerCarduid: 'atk_unit_0001',
        targetPlayerId: defenderId,
        status: 'ACTION_STEP',
        openedAt: Date.now()
    });

    return { gameEnv, attackerId, defenderId };
}

describe('ACTION_STEP action target source conditions', () => {
    test('excludes unlinked source for linked-only activated ACTION_STEP effect', () => {
        const { gameEnv, attackerId, defenderId } = setupBattleWithActionUnit({ linked: false });
        const battle = gameEnv.currentBattle;

        expect(battle).toBeTruthy();
        expect(battle.actionTargets[attackerId]).toEqual([]);
        expect(battle.confirmations[attackerId]).toBe(true);
        expect(battle.confirmations[defenderId]).toBe(true);
    });

    test('includes linked source for linked-only activated ACTION_STEP effect', () => {
        const { gameEnv, attackerId, defenderId } = setupBattleWithActionUnit({ linked: true });
        const battle = gameEnv.currentBattle;
        const attackerTargets = battle.actionTargets[attackerId];

        expect(battle).toBeTruthy();
        expect(attackerTargets).toHaveLength(1);
        expect(attackerTargets[0].carduid).toBe('heal_unit_0001');
        expect(attackerTargets[0].effectIds).toEqual(['activate_heal']);
        expect(battle.confirmations[attackerId]).toBe(false);
        expect(battle.confirmations[defenderId]).toBe(true);
    });
});
