const { GameEnvironment } = require('../models/GameEnvironment');
const { BurstEffectManager } = require('../services/BurstEffectManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');

describe('Notification ordering', () => {
    test('SHIELD_AREA_CARD_DAMAGED is enqueued before UNIT_DESTROYED_BY_EFFECT', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        // Satisfy ">=10 (CB) cards in your trash" condition.
        p1.zones.trashArea = Array.from({ length: 10 }).map((_, index) => ({
            carduid: `CB_${index}_0001`,
            cardId: 'CB',
            cardData: {
                id: 'CB',
                name: 'CB Filler',
                cardType: 'unit',
                traits: ['CB']
            },
            originalAP: 0,
            originalHP: 0
        }));

        // Attacker with triggered destroy effect on shield battle damage.
        p1.zones.slot1.unit = {
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            cardData: {
                id: 'GD03-049',
                name: 'Gundam Exia (Trans-Am)',
                cardType: 'unit',
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
                            conditions: [
                                {
                                    type: 'cardsInTrashWithTraitsAny',
                                    scope: 'self',
                                    traits: ['CB'],
                                    value: '>=10'
                                }
                            ],
                            target: {
                                type: 'unit',
                                scope: 'opponent',
                                count: 1,
                                selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                            },
                            parameters: {
                                source: 'battle_damage',
                                defenseAreas: ['shield']
                            }
                        }
                    ]
                }
            },
            originalAP: 6,
            originalHP: 4,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [],
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isRested: true,
            placedAt: 0,
            placedBy: 'playerId_1'
        };

        // Single opponent unit so LOWEST_HP selection auto-applies without a choice event.
        p2.zones.slot1.unit = {
            carduid: 'defender_low_hp_0001',
            cardId: 'ST03-001',
            cardData: {
                id: 'ST03-001',
                name: 'Sinanju',
                cardType: 'unit',
                ap: 5,
                hp: 1,
                traits: ['Neo Zeon'],
                effects: { description: [], rules: [] }
            },
            originalAP: 5,
            originalHP: 1,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [],
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isRested: false,
            placedAt: 0,
            placedBy: 'playerId_2'
        };

        // Shield card with no burst effects.
        const shieldCarduid = 'GD00-001_0001_shield';
        const shieldCard = {
            carduid: shieldCarduid,
            cardId: 'GD00-001',
            cardData: {
                id: 'GD00-001',
                name: 'Vanilla Shield',
                cardType: 'shield',
                effects: { description: [], rules: [] }
            }
        };
        p2.zones.shieldArea.push(shieldCard);

        const event = EventFactory.createShieldCardAttackedEvent(p2.id, p1.id, 'slot1', [shieldCard], 6);
        const result = BurstEffectManager.processShieldCardAttack(event, gameEnv);
        expect(result.success).toBe(true);

        const types = (gameEnv.notificationQueue || []).map((notification) => notification.type);
        const shieldIndex = types.indexOf('SHIELD_AREA_CARD_DAMAGED');
        const destroyedIndex = types.indexOf('UNIT_DESTROYED_BY_EFFECT');

        expect(shieldIndex).toBeGreaterThanOrEqual(0);
        expect(destroyedIndex).toBeGreaterThanOrEqual(0);
        expect(shieldIndex).toBeLessThan(destroyedIndex);
    });

    test('suppression multi-shield attack batches shield notifications before destroy notifications', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        p1.zones.trashArea = Array.from({ length: 10 }).map((_, index) => ({
            carduid: `CB_${index}_0001`,
            cardId: 'CB',
            cardData: {
                id: 'CB',
                name: 'CB Filler',
                cardType: 'unit',
                traits: ['CB']
            },
            originalAP: 0,
            originalHP: 0
        }));

        p1.zones.slot1.unit = {
            carduid: 'GD03-049_unit_0001',
            cardId: 'GD03-049',
            cardData: {
                id: 'GD03-049',
                name: 'Gundam Exia (Trans-Am)',
                cardType: 'unit',
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
                            conditions: [
                                {
                                    type: 'cardsInTrashWithTraitsAny',
                                    scope: 'self',
                                    traits: ['CB'],
                                    value: '>=10'
                                }
                            ],
                            target: {
                                type: 'unit',
                                scope: 'opponent',
                                count: 1,
                                selection: { type: 'LOWEST_HP', tieBreaker: 'CONTROLLER_CHOICE' }
                            },
                            parameters: {
                                source: 'battle_damage',
                                defenseAreas: ['shield']
                            }
                        }
                    ]
                }
            },
            originalAP: 6,
            originalHP: 4,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [{ keyword: 'Suppression', value: 2 }],
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isRested: true,
            placedAt: 0,
            placedBy: 'playerId_1'
        };

        p2.zones.slot1.unit = {
            carduid: 'defender_low_hp_0001',
            cardId: 'ST03-001',
            cardData: {
                id: 'ST03-001',
                name: 'Sinanju',
                cardType: 'unit',
                ap: 5,
                hp: 1,
                traits: ['Neo Zeon'],
                effects: { description: [], rules: [] }
            },
            originalAP: 5,
            originalHP: 1,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [],
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isRested: false,
            placedAt: 0,
            placedBy: 'playerId_2'
        };
        p2.zones.slot2.unit = {
            carduid: 'defender_mid_hp_0001',
            cardId: 'ST03-002',
            cardData: {
                id: 'ST03-002',
                name: 'Zaku',
                cardType: 'unit',
                ap: 5,
                hp: 2,
                traits: ['Neo Zeon'],
                effects: { description: [], rules: [] }
            },
            originalAP: 5,
            originalHP: 2,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            temporaryEffects: [],
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isRested: false,
            placedAt: 0,
            placedBy: 'playerId_2'
        };

        const shieldCard1 = {
            carduid: 'GD00-001_0001_shield',
            cardId: 'GD00-001',
            cardData: {
                id: 'GD00-001',
                name: 'Vanilla Shield 1',
                cardType: 'shield',
                effects: { description: [], rules: [] }
            }
        };
        const shieldCard2 = {
            carduid: 'GD00-002_0002_shield',
            cardId: 'GD00-002',
            cardData: {
                id: 'GD00-002',
                name: 'Vanilla Shield 2',
                cardType: 'shield',
                effects: { description: [], rules: [] }
            }
        };
        p2.zones.shieldArea.push(shieldCard1, shieldCard2);

        const event = EventFactory.createShieldCardAttackedEvent(p2.id, p1.id, 'slot1', [shieldCard1, shieldCard2], 6);
        const result = BurstEffectManager.processShieldCardAttack(event, gameEnv);
        expect(result.success).toBe(true);

        const types = (gameEnv.notificationQueue || []).map((notification) => notification.type);
        const shieldIndexes = types
            .map((type, index) => (type === 'SHIELD_AREA_CARD_DAMAGED' ? index : -1))
            .filter((index) => index >= 0);
        const destroyedIndexes = types
            .map((type, index) => (type === 'UNIT_DESTROYED_BY_EFFECT' ? index : -1))
            .filter((index) => index >= 0);

        expect(shieldIndexes).toHaveLength(2);
        expect(destroyedIndexes.length).toBeGreaterThanOrEqual(1);
        expect(shieldIndexes[0]).toBeLessThan(destroyedIndexes[0]);
        expect(shieldIndexes[1]).toBeLessThan(destroyedIndexes[0]);
        expect(destroyedIndexes[0]).toBeGreaterThan(shieldIndexes[0] + 1);
    });
});
