const gd03Cards = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { BurstEffectManager } = require('../services/BurstEffectManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { getShieldCardsToAttack } = require('../services/battle/BattleShieldUtils');
const { DefenseAreaBattleDamageTriggeredEffectManager } = require('../services/effects/DefenseAreaBattleDamageTriggeredEffectManager');

function createUnit({
    carduid,
    cardId,
    name,
    ap,
    hp,
    traits = [],
    effects = { description: [], rules: [] },
    owner
}) {
    return {
        carduid,
        cardId,
        cardData: { id: cardId, name, cardType: 'unit', ap, hp, traits, effects },
        originalAP: ap,
        originalHP: hp,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        temporaryEffects: [],
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        isRested: true,
        placedAt: 0,
        placedBy: owner
    };
}

function createShield({ carduid, cardId, name = 'Shield', effects = { description: [], rules: [] } }) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name,
            cardType: 'shield',
            effects
        }
    };
}

function createBase({ carduid, cardId, name = 'Base', hp = 5 }) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name,
            cardType: 'base',
            hp,
            effects: { description: [], rules: [] }
        },
        originalHP: hp,
        damageReceived: 0,
        placedAt: 0,
        placedBy: 'playerId_2',
        isRested: false
    };
}

function addCbTrash(player, count) {
    player.zones.trashArea = Array.from({ length: count }).map((_, index) => ({
        carduid: `CB_${index}_0001`,
        cardId: 'CB',
        cardData: { id: 'CB', name: 'CB Filler', cardType: 'unit', traits: ['CB'] },
        originalAP: 0,
        originalHP: 0
    }));
}

describe('GD03-049 schema and suppression batch semantics', () => {
    test('GD03-049 effect rules remain schema-aligned', () => {
        const card = gd03Cards.cards['GD03-049'];
        expect(card).toBeTruthy();

        const suppression = card.effects.rules.find((r) => r.effectId === 'suppression_2');
        expect(suppression).toBeTruthy();
        expect(suppression.action).toBe('grant_keyword');
        expect(suppression.parameters.keyword).toBe('Suppression');
        expect(suppression.parameters.value).toBe(2);

        const triggerRule = card.effects.rules.find(
            (r) => r.effectId === 'shield_destroyed_destroy_lowest_hp_if_cb_trash_ge_10'
        );
        expect(triggerRule).toBeTruthy();
        expect(triggerRule.trigger).toBe('DEFENSE_AREA_BATTLE_DAMAGE');
        expect(triggerRule.timing.actionTurn).toBe('YOUR_TURN');
        expect(triggerRule.conditions[0].type).toBe('cardsInTrashWithTraitsAny');
        expect(triggerRule.conditions[0].traits).toContain('CB');
        expect(triggerRule.conditions[0].value).toBe('>=10');
        expect(triggerRule.target.selection.type).toBe('LOWEST_HP');
        expect(triggerRule.target.selection.tieBreaker).toBe('CONTROLLER_CHOICE');
        expect(triggerRule.parameters.defenseAreas).toEqual(['shield', 'base']);
    });

    test('suppression hits the first 2 shield cards in order', () => {
        const defender = {
            getShieldCards: () => ([
                createShield({ carduid: 's1', cardId: 'GD00-001' }),
                createShield({ carduid: 's2', cardId: 'GD00-002' }),
                createShield({ carduid: 's3', cardId: 'GD00-003' })
            ])
        };

        const targets = getShieldCardsToAttack(defender, 2);
        expect(targets.map((card) => card.carduid)).toEqual(['s1', 's2']);
    });

    test('defers shield battle-damage trigger resolution until suppression batch completes across burst choice', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        addCbTrash(p1, 10);

        p1.zones.slot1.unit = createUnit({
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            name: 'Gundam Exia (Trans-Am)',
            ap: 6,
            hp: 4,
            traits: ['CB'],
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'shield_destroyed_destroy_lowest_hp_if_cb_trash_ge_10',
                        type: 'triggered',
                        trigger: 'DEFENSE_AREA_BATTLE_DAMAGE',
                        action: 'destroy',
                        timing: { actionTurn: 'YOUR_TURN' },
                        conditions: [{ type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['CB'], value: '>=10' }],
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1,
                            selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                        },
                        parameters: { source: 'battle_damage', defenseAreas: ['shield', 'base'] }
                    }
                ]
            },
            owner: 'playerId_1'
        });

        p2.zones.slot1.unit = createUnit({
            carduid: 'enemy_low_0001',
            cardId: 'ST03-001',
            name: 'Enemy A',
            ap: 3,
            hp: 1,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.slot2.unit = createUnit({
            carduid: 'enemy_mid_0001',
            cardId: 'ST03-002',
            name: 'Enemy B',
            ap: 3,
            hp: 2,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });

        const burstShield = createShield({
            carduid: 'burst_shield_0001',
            cardId: 'GD00-010',
            name: 'Burst Shield',
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'burst_add_to_hand',
                        type: 'triggered',
                        trigger: 'BURST_CONDITION',
                        action: 'addToHand'
                    }
                ]
            }
        });
        const vanillaShield = createShield({ carduid: 'vanilla_shield_0002', cardId: 'GD00-001', name: 'Vanilla Shield' });
        p2.zones.shieldArea.push(burstShield, vanillaShield);

        const attackEvent = EventFactory.createShieldCardAttackedEvent(
            p2.id,
            p1.id,
            'slot1',
            [burstShield, vanillaShield],
            6
        );
        const result = BurstEffectManager.processShieldCardAttack(attackEvent, gameEnv);
        expect(result.success).toBe(true);

        const preResolveTypes = (gameEnv.notificationQueue || []).map((n) => n.type);
        expect(preResolveTypes).not.toContain('UNIT_DESTROYED_BY_EFFECT');
        expect(preResolveTypes).not.toContain('SHIELD_AREA_CARD_DAMAGED');

        const burstChoiceEvent = (gameEnv.processingQueue || []).find((evt) => evt.type === 'BURST_EFFECT_CHOICE');
        expect(burstChoiceEvent).toBeTruthy();
        expect(burstChoiceEvent.data.shieldAttackSourceEventId).toBe(attackEvent.id);

        burstChoiceEvent.status = EventStatus.RESOLVING;
        burstChoiceEvent.data.userDecisionMade = true;
        burstChoiceEvent.data.userDecision = 'ACTIVATE';

        const choiceResult = BurstEffectManager.processBurstEffectChoice(burstChoiceEvent, gameEnv);
        expect(choiceResult.success).toBe(true);

        const finalTypes = (gameEnv.notificationQueue || []).map((n) => n.type);
        const shieldDamageIndexes = finalTypes
            .map((type, index) => (type === 'SHIELD_AREA_CARD_DAMAGED' ? index : -1))
            .filter((index) => index >= 0);
        const destroyedIndex = finalTypes.indexOf('UNIT_DESTROYED_BY_EFFECT');

        expect(shieldDamageIndexes).toHaveLength(2);
        expect(destroyedIndex).toBeGreaterThanOrEqual(0);
        expect(shieldDamageIndexes[0]).toBeLessThan(destroyedIndex);
        expect(shieldDamageIndexes[1]).toBeLessThan(destroyedIndex);
    });

    test('triggers on base battle damage when CB >= 10 and destroys lowest HP enemy unit', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        addCbTrash(p1, 10);

        p1.zones.slot1.unit = createUnit({
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            name: 'Gundam Exia (Trans-Am)',
            ap: 6,
            hp: 4,
            traits: ['CB'],
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'shield_destroyed_destroy_lowest_hp_if_cb_trash_ge_10',
                        type: 'triggered',
                        trigger: 'DEFENSE_AREA_BATTLE_DAMAGE',
                        action: 'destroy',
                        timing: { actionTurn: 'YOUR_TURN' },
                        conditions: [{ type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['CB'], value: '>=10' }],
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1,
                            selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                        },
                        parameters: { source: 'battle_damage', defenseAreas: ['shield', 'base'] }
                    }
                ]
            },
            owner: 'playerId_1'
        });
        p2.zones.slot1.unit = createUnit({
            carduid: 'enemy_low_hp_0001',
            cardId: 'ST03-001',
            name: 'Enemy Low',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.slot1.unit.damageReceived = 2; // current HP = 1
        p2.zones.slot2.unit = createUnit({
            carduid: 'enemy_high_hp_0001',
            cardId: 'ST03-002',
            name: 'Enemy High',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.base.push(createBase({ carduid: 'base_0001', cardId: 'GD01-125' }));

        const result = DefenseAreaBattleDamageTriggeredEffectManager.handleBaseDamaged(gameEnv, {
            attackingPlayerId: p1.id,
            attackerSlot: 'slot1'
        });
        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect(p2.zones.slot2.unit).toBeTruthy();
    });

    test('does not trigger on base battle damage when CB < 10', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        addCbTrash(p1, 9);

        p1.zones.slot1.unit = createUnit({
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            name: 'Gundam Exia (Trans-Am)',
            ap: 6,
            hp: 4,
            traits: ['CB'],
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'shield_destroyed_destroy_lowest_hp_if_cb_trash_ge_10',
                        type: 'triggered',
                        trigger: 'DEFENSE_AREA_BATTLE_DAMAGE',
                        action: 'destroy',
                        timing: { actionTurn: 'YOUR_TURN' },
                        conditions: [{ type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['CB'], value: '>=10' }],
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1,
                            selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                        },
                        parameters: { source: 'battle_damage', defenseAreas: ['shield', 'base'] }
                    }
                ]
            },
            owner: 'playerId_1'
        });
        p2.zones.slot1.unit = createUnit({
            carduid: 'enemy_low_hp_0001',
            cardId: 'ST03-001',
            name: 'Enemy Low',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.slot1.unit.damageReceived = 2;
        p2.zones.slot2.unit = createUnit({
            carduid: 'enemy_high_hp_0001',
            cardId: 'ST03-002',
            name: 'Enemy High',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.base.push(createBase({ carduid: 'base_0001', cardId: 'GD01-125' }));

        const result = DefenseAreaBattleDamageTriggeredEffectManager.handleBaseDamaged(gameEnv, {
            attackingPlayerId: p1.id,
            attackerSlot: 'slot1'
        });
        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeTruthy();
        expect(p2.zones.slot2.unit).toBeTruthy();
    });

    test('does not trigger on base battle damage on opponent turn', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_2';

        addCbTrash(p1, 10);

        p1.zones.slot1.unit = createUnit({
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            name: 'Gundam Exia (Trans-Am)',
            ap: 6,
            hp: 4,
            traits: ['CB'],
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'shield_destroyed_destroy_lowest_hp_if_cb_trash_ge_10',
                        type: 'triggered',
                        trigger: 'DEFENSE_AREA_BATTLE_DAMAGE',
                        action: 'destroy',
                        timing: { actionTurn: 'YOUR_TURN' },
                        conditions: [{ type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['CB'], value: '>=10' }],
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1,
                            selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                        },
                        parameters: { source: 'battle_damage', defenseAreas: ['shield', 'base'] }
                    }
                ]
            },
            owner: 'playerId_1'
        });
        p2.zones.slot1.unit = createUnit({
            carduid: 'enemy_low_hp_0001',
            cardId: 'ST03-001',
            name: 'Enemy Low',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.slot1.unit.damageReceived = 2;
        p2.zones.base.push(createBase({ carduid: 'base_0001', cardId: 'GD01-125' }));

        const result = DefenseAreaBattleDamageTriggeredEffectManager.handleBaseDamaged(gameEnv, {
            attackingPlayerId: p1.id,
            attackerSlot: 'slot1'
        });
        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeTruthy();
    });

    test('base battle damage tie on lowest HP requires target choice', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        addCbTrash(p1, 10);

        p1.zones.slot1.unit = createUnit({
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            name: 'Gundam Exia (Trans-Am)',
            ap: 6,
            hp: 4,
            traits: ['CB'],
            effects: {
                description: [],
                rules: [
                    {
                        effectId: 'shield_destroyed_destroy_lowest_hp_if_cb_trash_ge_10',
                        type: 'triggered',
                        trigger: 'DEFENSE_AREA_BATTLE_DAMAGE',
                        action: 'destroy',
                        timing: { actionTurn: 'YOUR_TURN' },
                        conditions: [{ type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['CB'], value: '>=10' }],
                        target: {
                            type: 'unit',
                            scope: 'opponent',
                            count: 1,
                            selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                        },
                        parameters: { source: 'battle_damage', defenseAreas: ['shield', 'base'] }
                    }
                ]
            },
            owner: 'playerId_1'
        });
        p2.zones.slot1.unit = createUnit({
            carduid: 'enemy_low_hp_a',
            cardId: 'ST03-001',
            name: 'Enemy A',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.slot2.unit = createUnit({
            carduid: 'enemy_low_hp_b',
            cardId: 'ST03-002',
            name: 'Enemy B',
            ap: 2,
            hp: 3,
            owner: 'playerId_2',
            effects: { description: [], rules: [] }
        });
        p2.zones.slot1.unit.damageReceived = 2;
        p2.zones.slot2.unit.damageReceived = 2;
        p2.zones.base.push(createBase({ carduid: 'base_0001', cardId: 'GD01-125' }));

        const result = DefenseAreaBattleDamageTriggeredEffectManager.handleBaseDamaged(gameEnv, {
            attackingPlayerId: p1.id,
            attackerSlot: 'slot1'
        });
        expect(result.success).toBe(true);

        const hasTargetChoice = (gameEnv.processingQueue || []).some((evt) => evt.type === 'TARGET_CHOICE');
        expect(hasTargetChoice).toBe(true);
        expect(p2.zones.slot1.unit).toBeTruthy();
        expect(p2.zones.slot2.unit).toBeTruthy();
    });
});
