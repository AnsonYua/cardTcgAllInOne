const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { EventType } = require('../models/GameEnums');
const gd03 = require('../data/gd03Card.json');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('GD03-131 deploy sequence targeting', () => {
    test('auto-resolves self_shield addToHand, then auto-applies returnToHand when only one eligible opponent target exists', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = p1.id;

        // Condition for step 2: 2+ friendly Triple Ship Alliance units in play.
        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-072_friendly_tsa_0001',
            cardId: 'GD03-072',
            traits: ['Triple Ship Alliance'],
            cardDataExtras: { level: 4 }
        });
        p1.zones.slot2.unit = createUnitZoneCard({
            carduid: 'GD03-070_friendly_tsa_0002',
            cardId: 'GD03-070',
            traits: ['Triple Ship Alliance'],
            cardDataExtras: { level: 6 }
        });

        // Opponent targets: one valid (Lv4), one invalid (Lv5).
        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-047_enemy_valid_0001',
            cardId: 'GD03-047',
            cardDataExtras: { level: 4 }
        });
        p2.zones.slot2.unit = createUnitZoneCard({
            carduid: 'GD03-040_enemy_invalid_0002',
            cardId: 'GD03-040',
            cardDataExtras: { level: 5 }
        });

        const shieldUid1 = 'GD03-044_shield_p1_0001';
        const shieldUid2 = 'GD03-045_shield_p1_0002';
        p1.zones.shieldArea = [
            createUnitZoneCard({ carduid: shieldUid1, cardId: 'GD03-044' }),
            createUnitZoneCard({ carduid: shieldUid2, cardId: 'GD03-045' })
        ];

        const deployEffect = gd03.cards['GD03-131'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_effect'
        );
        expect(deployEffect).toBeTruthy();

        const handBefore = p1.deck.handUids.length;
        const shieldsBefore = p1.zones.shieldArea.length;
        const result = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            p1.id,
            'GD03-131_source_0001',
            deployEffect
        );

        // Both steps auto-resolve in this setup:
        // - step1: addToHand(self_shield) now auto-resolves by policy.
        // - step2: returnToHand(opponent, level<=4) has exactly one valid target.
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        // Step 1 auto-resolved: one shield moved to hand.
        expect(p1.deck.handUids.length).toBe(handBefore + 1);
        expect(p1.zones.shieldArea.length).toBe(shieldsBefore - 1);

        // No target choice should be created for either step in this scenario.
        const choiceEvent = gameEnv.processingQueue.find((evt) => evt.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        // Valid Lv4 opponent should be returned automatically; invalid Lv5 remains.
        expect(p2.deck.handUids).toContain('GD03-047_enemy_valid_0001');
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect(p2.zones.slot2.unit?.carduid).toBe('GD03-040_enemy_invalid_0002');
    });
});
