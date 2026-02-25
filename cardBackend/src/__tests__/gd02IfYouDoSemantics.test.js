const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const gd02 = require('../data/gd02Card.json');
const { createUnitZoneCard, createPilotZoneCard } = require('./helpers/zoneCardFactory');
const { makeBase, makeZoneLikeCard } = require('./helpers/p2AuditFixtures');

describe('GD02 If-you-do semantics audit', () => {
    test('GD02-069 activated effect rests base, then sets self active and applies cannot_attack_player restriction', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD02-069_unit_0001',
            cardId: 'GD02-069',
            name: 'Zeta Gundam',
            ap: 5,
            hp: 4,
            effectsRules: gd02.cards['GD02-069'].effects.rules,
            cardDataExtras: {
                color: 'White',
                level: 6,
                traits: ['AEUG'],
                link: ['Kamille Bidan']
            },
            zoneExtras: {
                isRested: true,
                placedAt: 0,
                placedBy: 'playerId_1',
                playedThisTurn: false,
                canAttackThisTurn: true,
                canAttackOnPlayTurn: false,
                isFirstPlay: false
            }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'kamille_pilot_0001',
            cardId: 'GD02-097',
            name: 'Kamille Bidan',
            traits: ['AEUG', 'Newtype']
        });
        p1.zones.base = [makeBase('friendly_base_0001', 'ST01-012', { isRested: false })];

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'activate_gd02_069',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD02-069_unit_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(p1.zones.base[0].isRested).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(false);
        expect(Array.isArray(p1.zones.slot1.unit.activeRestrictions)).toBe(true);
        expect(p1.zones.slot1.unit.activeRestrictions.some((r) => r.restriction === 'cannot_attack_player')).toBe(true);
    });

    test('GD02-069 activated effect fails cleanly when no active friendly base exists', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.phase = 'MAIN_PHASE';

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD02-069_unit_0002',
            cardId: 'GD02-069',
            effectsRules: gd02.cards['GD02-069'].effects.rules,
            cardDataExtras: { color: 'White', level: 6, traits: ['AEUG'], link: ['Kamille Bidan'] },
            zoneExtras: {
                isRested: true,
                placedAt: 0,
                placedBy: 'playerId_1',
                playedThisTurn: false,
                canAttackThisTurn: true,
                canAttackOnPlayTurn: false,
                isFirstPlay: false
            }
        });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'kamille_pilot_0002',
            cardId: 'GD02-097',
            name: 'Kamille Bidan',
            traits: ['AEUG', 'Newtype']
        });
        p1.zones.base = [makeBase('rested_base_0001', 'ST01-012', { isRested: true })];

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'activate_gd02_069_fail',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD02-069_unit_0002',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No eligible targets/i);
        expect(p1.zones.slot1.unit.isRested).toBe(true);
        expect(p1.zones.slot1.unit.activeRestrictions).toBeUndefined();
    });

    test('GD02-070 draw_then_discard does not discard when no cards are drawn (empty deck)', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;

        p1.deck._handUids = ['ST01-001_hand_0001', 'ST01-002_hand_0002'];
        p1.deck.mainDeck = [];
        p1.zones.trashArea = [
            makeZoneLikeCard('GJ_1', 'GD02-118', { id: 'GD02-118', cardType: 'command', traits: ['Gjallarhorn'], ap: 0, hp: 0 }),
            makeZoneLikeCard('GJ_2', 'GD02-119', { id: 'GD02-119', cardType: 'command', traits: ['Gjallarhorn'], ap: 0, hp: 0 }),
            makeZoneLikeCard('GJ_3', 'GD02-120', { id: 'GD02-120', cardType: 'command', traits: ['Gjallarhorn'], ap: 0, hp: 0 }),
            makeZoneLikeCard('GJ_4', 'GD02-121', { id: 'GD02-121', cardType: 'command', traits: ['Gjallarhorn'], ap: 0, hp: 0 })
        ];

        const deployEffect = gd02.cards['GD02-070'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployEffect).toBeTruthy();

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, p1.id, 'GD02-070_source_0001', deployEffect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const discardChoice = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(discardChoice).toBeFalsy();
        expect(p1.deck.handUids).toEqual(['ST01-001_hand_0001', 'ST01-002_hand_0002']);
        expect(p1.zones.trashArea.map((c) => c.carduid)).toEqual(['GJ_1', 'GJ_2', 'GJ_3', 'GJ_4']);
    });
});
