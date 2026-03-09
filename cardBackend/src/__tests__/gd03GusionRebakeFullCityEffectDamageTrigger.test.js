const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const { createUnitZoneCard, createPilotZoneCard } = require('./helpers/zoneCardFactory');

function findTargetChoice(gameEnv, sourceCarduid) {
    return (gameEnv.processingQueue || []).find((event) =>
        event?.type === 'TARGET_CHOICE'
        && (!sourceCarduid || event?.data?.sourceCarduid === sourceCarduid)
    );
}

function triggerReactiveEffectDamage(gameEnv, playerId, eventId) {
    gameEnv.processingQueue = [{
        id: eventId,
        type: 'TRIGGER_EFFECT_DAMAGE_RECEIVED',
        status: 'RESOLVING',
        priority: 1,
        timestamp: Date.now(),
        playerId,
        data: { effect: { effectId: 'test_effect_damage_received_event' } }
    }];
    const result = ContinuousEffectManager.processReactiveContinuousEffects(gameEnv);
    expect(result.success).toBe(true);
}

function resolveChoiceByCarduid(gameEnv, targetCarduid) {
    const choiceEvent = findTargetChoice(gameEnv);
    expect(choiceEvent).toBeTruthy();
    const selected = choiceEvent.data.availableTargets.find((target) => target.carduid === targetCarduid);
    expect(selected).toBeTruthy();
    choiceEvent.data.selectedTargets = [selected];
    choiceEvent.data.userDecisionMade = true;
    gameEnv.processingQueue = [choiceEvent];
    const processResult = gameEnv.processEvents();
    expect(processResult.success).toBe(true);
}

function setupPairedGusionBoard() {
    const gameEnv = new GameEnvironment();
    const owner = gameEnv.addPlayer('playerId_1', 'P1');
    const opponent = gameEnv.addPlayer('playerId_2', 'P2');

    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = owner.id;
    gameEnv.phase = 'MAIN_PHASE';

    expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
        carduid: 'GD03-053_unit_0001',
        playAs: 'unit'
    }).success).toBe(true);

    owner.zones.slot1.pilot = createPilotZoneCard({
        carduid: 'pilot_any_0001',
        cardId: 'PILOT-ANY-0001',
        name: 'Any Pilot'
    });

    owner.zones.slot2.unit = createUnitZoneCard({
        carduid: 'friendly_tekkadan_unit_0001',
        cardId: 'ALLY-TEKKADAN-0001',
        ap: 3,
        hp: 4,
        traits: ['Tekkadan'],
        cardDataExtras: { level: 3, color: 'Purple' }
    });

    owner.zones.slot3.unit = createUnitZoneCard({
        carduid: 'friendly_non_trait_unit_0001',
        cardId: 'ALLY-NON-TRAIT-0001',
        ap: 3,
        hp: 4,
        traits: ['Earth Federation'],
        cardDataExtras: { level: 3, color: 'Blue' }
    });

    opponent.zones.slot1.unit = createUnitZoneCard({
        carduid: 'enemy_lv4_unit_0001',
        cardId: 'ENEMY-LV4-0001',
        ap: 2,
        hp: 3,
        cardDataExtras: { level: 4, color: 'Green' }
    });
    opponent.zones.slot2.unit = createUnitZoneCard({
        carduid: 'enemy_lv5_unit_0001',
        cardId: 'ENEMY-LV5-0001',
        ap: 4,
        hp: 4,
        cardDataExtras: { level: 5, color: 'Green' }
    });
    opponent.zones.slot3.unit = createUnitZoneCard({
        carduid: 'enemy_lv3_unit_0001',
        cardId: 'ENEMY-LV3-0001',
        ap: 2,
        hp: 3,
        cardDataExtras: { level: 3, color: 'Green' }
    });

    ContinuousEffectManager.processAllContinuousEffects(gameEnv);

    return { gameEnv, owner, opponent };
}

describe('GD03-053 (Gundam Gusion Rebake Full City) effect-damage trigger', () => {
    test('triggers on friendly Tekkadan/Teiwaz effect damage and rests enemy Lv4 or lower', () => {
        const { gameEnv, owner, opponent } = setupPairedGusionBoard();

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_1', action: 'damage', parameters: { value: 1 } },
            [{ carduid: 'friendly_tekkadan_unit_0001', zone: 'slot2', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0001'
        );
        expect(damageResult.success).toBe(true);

        triggerReactiveEffectDamage(gameEnv, owner.id, 'reactive_effect_damage_1');

        const choiceEvent = findTargetChoice(gameEnv, 'GD03-053_unit_0001');
        expect(choiceEvent).toBeTruthy();
        const available = choiceEvent.data.availableTargets.map((t) => t.carduid);
        expect(available).toContain('enemy_lv4_unit_0001');
        expect(available).toContain('enemy_lv3_unit_0001');
        expect(available).not.toContain('enemy_lv5_unit_0001');

        resolveChoiceByCarduid(gameEnv, 'enemy_lv4_unit_0001');
        expect(opponent.zones.slot1.unit.isRested).toBe(true);
    });

    test('does not trigger twice in the same turn (once per turn preserved on reactive continuous)', () => {
        const { gameEnv, owner } = setupPairedGusionBoard();

        const firstDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_2a', action: 'damage', parameters: { value: 1 } },
            [{ carduid: 'friendly_tekkadan_unit_0001', zone: 'slot2', playerId: owner.id }],
            'playerId_2',
            'enemy_effect_source_0002a'
        );
        expect(firstDamage.success).toBe(true);
        triggerReactiveEffectDamage(gameEnv, owner.id, 'reactive_effect_damage_2a');
        resolveChoiceByCarduid(gameEnv, 'enemy_lv3_unit_0001');

        const secondDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_2b', action: 'damage', parameters: { value: 1 } },
            [{ carduid: 'friendly_tekkadan_unit_0001', zone: 'slot2', playerId: owner.id }],
            'playerId_2',
            'enemy_effect_source_0002b'
        );
        expect(secondDamage.success).toBe(true);
        triggerReactiveEffectDamage(gameEnv, owner.id, 'reactive_effect_damage_2b');

        const secondChoice = findTargetChoice(gameEnv, 'GD03-053_unit_0001');
        expect(secondChoice).toBeFalsy();
    });

    test('does not trigger on opponent turn', () => {
        const { gameEnv, owner } = setupPairedGusionBoard();
        gameEnv.currentPlayer = 'playerId_2';

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_3', action: 'damage', parameters: { value: 1 } },
            [{ carduid: 'friendly_tekkadan_unit_0001', zone: 'slot2', playerId: owner.id }],
            'playerId_2',
            'enemy_effect_source_0003'
        );
        expect(damageResult.success).toBe(true);

        triggerReactiveEffectDamage(gameEnv, owner.id, 'reactive_effect_damage_3');
        expect(findTargetChoice(gameEnv, 'GD03-053_unit_0001')).toBeFalsy();
    });

    test('does not trigger for non-(Tekkadan)/(Teiwaz) friendly unit effect damage', () => {
        const { gameEnv, owner } = setupPairedGusionBoard();

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_4', action: 'damage', parameters: { value: 1 } },
            [{ carduid: 'friendly_non_trait_unit_0001', zone: 'slot3', playerId: owner.id }],
            'playerId_2',
            'enemy_effect_source_0004'
        );
        expect(damageResult.success).toBe(true);

        triggerReactiveEffectDamage(gameEnv, owner.id, 'reactive_effect_damage_4');
        expect(findTargetChoice(gameEnv, 'GD03-053_unit_0001')).toBeFalsy();
    });

    test('triggers from GD03-067 deploy self-damage path (integration)', () => {
        const { gameEnv, owner } = setupPairedGusionBoard();

        owner.zones.slot4.unit = createUnitZoneCard({
            carduid: 'GD03-067_source_0001',
            cardId: 'GD03-067',
            name: gd03.cards['GD03-067'].name,
            ap: gd03.cards['GD03-067'].ap,
            hp: gd03.cards['GD03-067'].hp,
            traits: gd03.cards['GD03-067'].traits,
            link: gd03.cards['GD03-067'].link,
            cardDataExtras: { effects: gd03.cards['GD03-067'].effects, color: gd03.cards['GD03-067'].color }
        });

        const deployEffect = gd03.cards['GD03-067'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_effect' && rule.timing?.eventTrigger === 'ENTERS_PLAY'
        );
        expect(deployEffect).toBeTruthy();

        const sequenceResult = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD03-067_source_0001', deployEffect);
        expect(sequenceResult.success).toBe(true);
        expect(sequenceResult.requiresSelection).toBe(true);

        const selfDamageChoice = findTargetChoice(gameEnv);
        expect(selfDamageChoice).toBeTruthy();
        const selectGusion = selfDamageChoice.data.availableTargets.find((target) => target.carduid === 'GD03-053_unit_0001');
        expect(selectGusion).toBeTruthy();

        const chooseResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, selfDamageChoice, [selectGusion]);
        expect(chooseResult.handled).toBe(true);
        expect(chooseResult.success).toBe(true);

        const continuation = (gameEnv.processingQueue || []).find(
            (event) => event?.type === 'PLAYER_ACTION' && event?.data?.actionType === 'continueSequence'
        );
        expect(continuation).toBeTruthy();
        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continuation);
        expect(continueResult.success).toBe(true);

        expect(owner.zones.slot1.unit.damageReceived || 0).toBe(1);
        expect(owner.zones.slot1.unit.modifyAP || 0).toBe(1);

        triggerReactiveEffectDamage(gameEnv, owner.id, 'reactive_effect_damage_5');
        expect(findTargetChoice(gameEnv, 'GD03-053_unit_0001')).toBeTruthy();
    });
});
