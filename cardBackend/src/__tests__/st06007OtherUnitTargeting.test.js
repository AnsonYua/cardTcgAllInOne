const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { SlotZoneUtils } = require('../utils/SlotZoneUtils');

describe('ST06-007 target constraint', () => {
    test('deploy effect excludes source card for "other (Clan) Unit" selection', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const sourceUid = 'ST06-007_unit_test_0001';
        const otherClanUid = 'ST06-001_unit_test_0001';

        const placeSource = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: sourceUid,
            playAs: 'unit'
        });
        expect(placeSource.success).toBe(true);

        const placeOther = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: otherClanUid,
            playAs: 'unit'
        });
        expect(placeOther.success).toBe(true);

        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceUid);
        expect(sourceCard).toBeTruthy();

        const effect = sourceCard.cardData.effects.rules.find(
            (rule) => rule.effectId === 'deploy_allow_attack_target_active_enemy_ap_le_3'
        );
        expect(effect).toBeTruthy();

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            sourceUid,
            effect
        );

        expect(result.success).toBe(true);
        expect(result.autoApplied).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const sourceCardAfter = SlotZoneUtils.getCardByUid(gameEnv, sourceUid);
        const otherCardAfter = SlotZoneUtils.getCardByUid(gameEnv, otherClanUid);
        const sourceHasPermission = Array.isArray(sourceCardAfter?.temporaryEffects)
            && sourceCardAfter.temporaryEffects.some((entry) => entry?.allowAttackTarget);
        const otherHasPermission = Array.isArray(otherCardAfter?.temporaryEffects)
            && otherCardAfter.temporaryEffects.some((entry) => entry?.allowAttackTarget);

        expect(sourceHasPermission).toBe(false);
        expect(otherHasPermission).toBe(true);
    });
});
