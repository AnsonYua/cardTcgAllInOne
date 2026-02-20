const { GameEnvironment } = require('../models/GameEnvironment');
const { TokenChoiceManager } = require('../services/effects/TokenChoiceManager');
const { ConditionalTokenDeployManager } = require('../services/effects/ConditionalTokenDeployManager');
const { ChoiceEventScheduler } = require('../services/choices/ChoiceEventScheduler');

describe('Token choice display contract', () => {
    test('emits display.card metadata for token choices', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('p1', 'P1');

        const effect = {
            effectId: 'choose_token',
            action: 'chooseToken',
            parameters: {
                choices: [
                    { token: { cardId: 'T-006' }, count: 1 },
                    { token: { cardId: 'T-011' }, count: 1 }
                ]
            }
        };

        const conditionsSpy = jest.spyOn(ConditionalTokenDeployManager, 'conditionsSatisfied').mockReturnValue(true);
        const emptySlotsSpy = jest.spyOn(ConditionalTokenDeployManager, 'getEmptyUnitSlots').mockReturnValue(['slot1', 'slot2']);
        const resolveSpy = jest.spyOn(ConditionalTokenDeployManager, 'resolveTokenData').mockImplementation((token) => ({
            success: true,
            tokenData: {
                id: token.cardId,
                name: `Token ${token.cardId}`,
                ap: 2,
                hp: 2,
                traits: []
            }
        }));

        let captured;
        const enqueueSpy = jest.spyOn(ChoiceEventScheduler, 'enqueueTokenChoice').mockImplementation((_env, params) => {
            captured = params;
            return { id: 'token_choice_1', data: { availableChoices: params.availableChoices } };
        });

        const result = TokenChoiceManager.processTokenChoiceEffect(gameEnv, 'p1', 'ST04-001_abc', effect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        expect(captured).toBeTruthy();
        expect(captured.availableChoices[0].display).toEqual({
            mode: 'card',
            cardId: 'T-006',
            label: 'Token T-006'
        });
        expect(captured.availableChoices[1].display).toEqual({
            mode: 'card',
            cardId: 'T-011',
            label: 'Token T-011'
        });

        enqueueSpy.mockRestore();
        resolveSpy.mockRestore();
        emptySlotsSpy.mockRestore();
        conditionsSpy.mockRestore();
    });
});
