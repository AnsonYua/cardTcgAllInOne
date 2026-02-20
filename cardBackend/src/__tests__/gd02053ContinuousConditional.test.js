const { GameEnvironment } = require('../models/GameEnvironment');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');

describe('GD02-053 continuous conditional link buff', () => {
    function makeUnit(carduid, traits, rules, link = []) {
        return {
            carduid,
            cardId: carduid.split('_')[0],
            cardData: {
                cardType: 'unit',
                name: carduid,
                traits,
                link,
                effects: { rules },
                ap: 3,
                hp: 3
            },
            isRested: false,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: []
        };
    }

    test('applies AP+2 to other friendly Vulture units but not self', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');
        gameEnv.currentPlayer = 'player1';

        const rule = {
            effectId: 'link_effect',
            type: 'continuous',
            trigger: 'continuous',
            sourceConditions: [{ type: 'linked' }],
            action: 'conditional',
            parameters: {
                if: [
                    { type: 'turnPlayer', scope: 'self', value: 'YOUR_TURN' },
                    { type: 'cardsInTrash', scope: 'self', value: '>=7' }
                ],
                then: [
                    {
                        action: 'modifyAP',
                        target: {
                            type: 'unit',
                            scope: 'self_all_unit',
                            filters: {
                                traitsAny: ['Vulture'],
                                excludeSelf: true
                            },
                            count: 6
                        },
                        parameters: { value: 2 }
                    }
                ]
            }
        };

        const sourceUnit = makeUnit('SRC_1', ['Vulture'], [rule], ['Pilot A']);
        const otherVulture = makeUnit('ALLY_1', ['Vulture'], [], []);

        p1.zones.slot1.unit = sourceUnit;
        p1.zones.slot1.pilot = {
            carduid: 'PILOT_A',
            cardId: 'P-A',
            cardData: { cardType: 'pilot', name: 'Pilot A', traits: [] },
            isRested: false,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: []
        };
        p1.zones.slot2.unit = otherVulture;

        for (let i = 0; i < 7; i++) {
            p1.zones.trashArea.push({
                carduid: `TR_${i}`,
                cardId: `TR-${i}`,
                cardData: { cardType: 'unit', name: `Trash ${i}` }
            });
        }

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);

        expect(sourceUnit.continueModifyAP).toBe(0);
        expect(otherVulture.continueModifyAP).toBe(2);
    });
});
