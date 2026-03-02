const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { createUnitZoneCard, createPilotZoneCard } = require('./helpers/zoneCardFactory');
const gd02 = require('../data/gd02Card.json');

function unitWithCardData(carduid, cardData, zoneExtras = {}) {
    return createUnitZoneCard({
        carduid,
        cardId: cardData.id,
        name: cardData.name,
        ap: cardData.ap || 0,
        hp: cardData.hp || 1,
        traits: Array.isArray(cardData.traits) ? cardData.traits : [],
        link: Array.isArray(cardData.link) ? cardData.link : [],
        effectsRules: Array.isArray(cardData.effects?.rules) ? cardData.effects.rules : [],
        cardDataExtras: {
            color: cardData.color,
            level: cardData.level,
            cost: cardData.cost,
            zone: Array.isArray(cardData.zone) ? cardData.zone : []
        },
        zoneExtras: {
            placedAt: 0,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            ...zoneExtras
        }
    });
}

describe('GD02-119 action effect targeting rules', () => {
    test('requires friendly Gjallarhorn Link Unit; when satisfied, any enemy unit can be selected', () => {
        const effect = gd02.cards['GD02-119'].effects.rules.find((rule) => rule.effectId === 'modify_ap');
        expect(effect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP';

        // Friendly linked Gjallarhorn unit in play (GD02-073 + Carta Issue).
        p1.zones.slot1.unit = unitWithCardData('p1_link_unit_uid', gd02.cards['GD02-073'], { placedBy: 'playerId_1' });
        p1.zones.slot1.pilot = createPilotZoneCard({
            carduid: 'p1_link_pilot_uid',
            cardId: 'GD02-119',
            name: 'Carta Issue',
            ap: 1,
            hp: 0,
            traits: ['Gjallarhorn'],
            zoneExtras: { placedAt: 0, placedBy: 'playerId_1' }
        });

        // Enemy has both Gjallarhorn and non-Gjallarhorn units.
        p2.zones.slot1.unit = unitWithCardData('enemy_gj_uid', gd02.cards['GD02-082'], { placedBy: 'playerId_2' });
        p2.zones.slot2.unit = unitWithCardData('enemy_non_gj_uid', gd02.cards['GD02-031'], { placedBy: 'playerId_2' });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-119_source_uid',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();

        const targetUids = (choiceEvent.data.availableTargets || []).map((target) => target.carduid);
        expect(targetUids).toEqual(expect.arrayContaining(['enemy_gj_uid', 'enemy_non_gj_uid']));

        // Pick the non-Gjallarhorn target to prove trait is not restricted.
        const selectedTarget = choiceEvent.data.availableTargets.find((target) => target.carduid === 'enemy_non_gj_uid');
        expect(selectedTarget).toBeTruthy();

        choiceEvent.status = EventStatus.RESOLVING;
        choiceEvent.data.selectedTargets = [selectedTarget];

        const executeResult = DeployTargetManager.executeTargetChoice(choiceEvent, gameEnv);
        expect(executeResult.success).toBe(true);

        expect(p2.zones.slot2.unit.modifyAP).toBe(-3);
        expect(Array.isArray(p2.zones.slot2.unit.temporaryEffects)).toBe(true);
        expect(p2.zones.slot2.unit.temporaryEffects.some((tempEffect) => tempEffect.duration === 'UNTIL_END_OF_BATTLE')).toBe(true);
    });

    test('does nothing when no friendly Gjallarhorn Link Unit is in play', () => {
        const effect = gd02.cards['GD02-119'].effects.rules.find((rule) => rule.effectId === 'modify_ap');
        expect(effect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'ACTION_STEP';

        // Friendly Gjallarhorn unit exists, but is not linked.
        p1.zones.slot1.unit = unitWithCardData('p1_unlinked_gj_uid', gd02.cards['GD02-073'], { placedBy: 'playerId_1' });
        p2.zones.slot1.unit = unitWithCardData('enemy_any_uid', gd02.cards['GD02-031'], { placedBy: 'playerId_2' });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-119_source_uid',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBeUndefined();
        expect(gameEnv.processingQueue.some((event) => event.type === 'TARGET_CHOICE')).toBe(false);
        expect(p2.zones.slot1.unit.modifyAP || 0).toBe(0);
    });
});
