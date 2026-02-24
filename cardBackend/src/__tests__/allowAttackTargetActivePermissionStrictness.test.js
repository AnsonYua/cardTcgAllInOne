const { GameEnvironment } = require('../models/GameEnvironment');
const { AttackPreparationManager } = require('../services/AttackPreparationManager');

function createUnit(carduid, cardId, rules = []) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            level: 4,
            ap: 3,
            hp: 3,
            effects: { rules }
        },
        originalAP: 3,
        originalHP: 3,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

function createPilot(carduid) {
    return {
        carduid,
        cardId: 'PILOT-001',
        cardData: {
            id: 'PILOT-001',
            name: 'Pilot',
            cardType: 'pilot',
            ap: 1,
            hp: 1,
            effects: { rules: [] }
        },
        originalAP: 1,
        originalHP: 1,
        continueModifyAP: 0,
        continueModifyHP: 0,
        effectUsage: {},
        isRested: false
    };
}

describe('allow_attack_target active target strictness', () => {
    test('allowAttackOnDeployTurn-only rule does not grant active enemy targeting', () => {
        const gameEnv = new GameEnvironment();
        const attackerPlayer = gameEnv.addPlayer('playerId_1', 'P1');
        const defenderPlayer = gameEnv.addPlayer('playerId_2', 'P2');

        attackerPlayer.zones.slot1.unit = createUnit('GD01-066_attacker_0001', 'GD01-066', [
            {
                action: 'allow_attack_target',
                sourceConditions: [{ type: 'paired' }],
                parameters: {
                    allowAttackOnDeployTurn: true
                }
            }
        ]);
        attackerPlayer.zones.slot1.pilot = createPilot('pilot_for_pair_0001');
        defenderPlayer.zones.slot1.unit = createUnit('enemy_active_0001', 'ST03-006', []);
        defenderPlayer.zones.slot1.unit.isRested = false;

        const result = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'GD01-066_attacker_0001',
            'playerId_2',
            'enemy_active_0001'
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Target unit must be rested');
    });

    test('rested enemy target remains valid without active-target permission', () => {
        const gameEnv = new GameEnvironment();
        const attackerPlayer = gameEnv.addPlayer('playerId_1', 'P1');
        const defenderPlayer = gameEnv.addPlayer('playerId_2', 'P2');

        attackerPlayer.zones.slot1.unit = createUnit('GD01-066_attacker_0002', 'GD01-066', [
            {
                action: 'allow_attack_target',
                sourceConditions: [{ type: 'paired' }],
                parameters: {
                    allowAttackOnDeployTurn: true
                }
            }
        ]);
        attackerPlayer.zones.slot1.pilot = createPilot('pilot_for_pair_0002');
        defenderPlayer.zones.slot1.unit = createUnit('enemy_rested_0001', 'ST03-006', []);
        defenderPlayer.zones.slot1.unit.isRested = true;

        const result = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'GD01-066_attacker_0002',
            'playerId_2',
            'enemy_rested_0001'
        );

        expect(result.success).toBe(true);
    });

    test('explicit active-target rule still allows active enemy targeting', () => {
        const gameEnv = new GameEnvironment();
        const attackerPlayer = gameEnv.addPlayer('playerId_1', 'P1');
        const defenderPlayer = gameEnv.addPlayer('playerId_2', 'P2');

        attackerPlayer.zones.slot1.unit = createUnit('explicit_active_attacker_0001', 'CUSTOM-001', [
            {
                action: 'allow_attack_target',
                parameters: {
                    status: 'active',
                    level: '<=5'
                }
            }
        ]);
        defenderPlayer.zones.slot1.unit = createUnit('enemy_active_0002', 'ST03-006', []);
        defenderPlayer.zones.slot1.unit.cardData.level = 3;
        defenderPlayer.zones.slot1.unit.isRested = false;

        const result = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'explicit_active_attacker_0001',
            'playerId_2',
            'enemy_active_0002'
        );

        expect(result.success).toBe(true);
    });

    test('dynamic level filter <=SOURCE_LEVEL is evaluated for active-target permission', () => {
        const gameEnv = new GameEnvironment();
        const attackerPlayer = gameEnv.addPlayer('playerId_1', 'P1');
        const defenderPlayer = gameEnv.addPlayer('playerId_2', 'P2');

        attackerPlayer.zones.slot1.unit = createUnit('dynamic_level_attacker_0001', 'CUSTOM-LEVEL-001', [
            {
                action: 'allow_attack_target',
                parameters: {
                    status: 'active',
                    level: '<=SOURCE_LEVEL'
                }
            }
        ]);
        attackerPlayer.zones.slot1.unit.cardData.level = 4;

        defenderPlayer.zones.slot1.unit = createUnit('enemy_active_lv3_0001', 'ST03-006', []);
        defenderPlayer.zones.slot1.unit.cardData.level = 3;
        defenderPlayer.zones.slot1.unit.isRested = false;

        const allowResult = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'dynamic_level_attacker_0001',
            'playerId_2',
            'enemy_active_lv3_0001'
        );
        expect(allowResult.success).toBe(true);

        defenderPlayer.zones.slot2.unit = createUnit('enemy_active_lv6_0001', 'ST03-006', []);
        defenderPlayer.zones.slot2.unit.cardData.level = 6;
        defenderPlayer.zones.slot2.unit.isRested = false;

        const denyResult = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'dynamic_level_attacker_0001',
            'playerId_2',
            'enemy_active_lv6_0001'
        );
        expect(denyResult.success).toBe(false);
        expect(denyResult.error).toContain('Target unit must be rested');
    });

    test('pairedPilot none allows active unpaired targets and rejects active paired targets', () => {
        const gameEnv = new GameEnvironment();
        const attackerPlayer = gameEnv.addPlayer('playerId_1', 'P1');
        const defenderPlayer = gameEnv.addPlayer('playerId_2', 'P2');

        attackerPlayer.zones.slot1.unit = createUnit('gd03105_attacker_0001', 'GD03-031', [
            {
                action: 'allow_attack_target',
                parameters: {
                    status: 'active',
                    pairedPilot: 'none'
                }
            }
        ]);

        defenderPlayer.zones.slot1.unit = createUnit('enemy_active_unpaired_0001', 'ST03-006', []);
        defenderPlayer.zones.slot1.unit.isRested = false;
        defenderPlayer.zones.slot2.unit = createUnit('enemy_active_paired_0001', 'ST03-007', []);
        defenderPlayer.zones.slot2.unit.isRested = false;
        defenderPlayer.zones.slot2.pilot = createPilot('enemy_pilot_0001');

        const allowUnpaired = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'gd03105_attacker_0001',
            'playerId_2',
            'enemy_active_unpaired_0001'
        );
        expect(allowUnpaired.success).toBe(true);

        const rejectPaired = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'gd03105_attacker_0001',
            'playerId_2',
            'enemy_active_paired_0001'
        );
        expect(rejectPaired.success).toBe(false);
        expect(rejectPaired.error).toContain('Target unit must be rested');
    });

    test('temporary allow_attack_target permission enforces pairedPilot none', () => {
        const gameEnv = new GameEnvironment();
        const attackerPlayer = gameEnv.addPlayer('playerId_1', 'P1');
        const defenderPlayer = gameEnv.addPlayer('playerId_2', 'P2');

        attackerPlayer.zones.slot1.unit = createUnit('gd03105_temp_attacker_0001', 'GD03-031', []);
        attackerPlayer.zones.slot1.unit.temporaryEffects = [
            {
                sourceCarduid: 'GD03-105_hand_0001',
                duration: 'UNTIL_END_OF_TURN',
                appliedTurn: 1,
                appliedBy: 'playerId_1',
                allowAttackTarget: {
                    status: 'active',
                    pairedPilot: 'none'
                }
            }
        ];

        defenderPlayer.zones.slot1.unit = createUnit('enemy_active_unpaired_0002', 'ST03-006', []);
        defenderPlayer.zones.slot1.unit.isRested = false;
        defenderPlayer.zones.slot2.unit = createUnit('enemy_active_paired_0002', 'ST03-007', []);
        defenderPlayer.zones.slot2.unit.isRested = false;
        defenderPlayer.zones.slot2.pilot = createPilot('enemy_pilot_0002');

        const allowUnpaired = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'gd03105_temp_attacker_0001',
            'playerId_2',
            'enemy_active_unpaired_0002'
        );
        expect(allowUnpaired.success).toBe(true);

        const rejectPaired = AttackPreparationManager.prepareUnitAttack(
            gameEnv,
            'playerId_1',
            'gd03105_temp_attacker_0001',
            'playerId_2',
            'enemy_active_paired_0002'
        );
        expect(rejectPaired.success).toBe(false);
        expect(rejectPaired.error).toContain('Target unit must be rested');
    });
});
