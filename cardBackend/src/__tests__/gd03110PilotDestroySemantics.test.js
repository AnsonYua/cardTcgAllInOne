const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { PlayCardPreparationManager } = require('../services/PlayCardPreparationManager');
const { applyDestroyEffect } = require('../services/effects/actions/EffectDestroyActions');

const allCards = CardDatabaseManager.getAllCards ? CardDatabaseManager.getAllCards() : {};

function findCardId(label, predicate) {
    const entries = Object.entries(allCards);
    for (const [cardId, card] of entries) {
        if (predicate(card || {})) return cardId;
    }
    throw new Error(`Missing fixture card for ${label}`);
}

const FIXTURE_IDS = {
    anyUnit: findCardId('anyUnit', (c) => c.cardType === 'unit'),
    pilot: findCardId('pilot', (c) => c.cardType === 'pilot'),
};

function createBaseEnv() {
    const env = new GameEnvironment();
    const p1 = env.addPlayer('playerId_1', 'P1');
    const p2 = env.addPlayer('playerId_2', 'P2');
    env.gameStarted = true;
    env.currentPlayer = 'playerId_1';
    env.currentTurn = 1;
    env.phase = 'MAIN_PHASE';

    for (let i = 0; i < 10; i += 1) {
        p1.zones.energyArea.push({
            carduid: `energy_basic_p1_${i}`,
            cardId: 'energy_basic',
            placedAt: 0,
            placedBy: p1.id,
            isRested: false,
            isExtraEnergy: false,
        });
    }

    return { env, p1, p2 };
}

function addHandCommand(player, cardId) {
    const uid = `${cardId}_hand_test_0001`;
    player.deck._handUids = [uid];
    return uid;
}

function addUnit(player, slotName, cardId, tag) {
    const cardData = CardDatabaseManager.getCardDetails(cardId);
    const uid = `${cardId}_${player.id}_${slotName}_${tag || 'u'}`;
    player.zones[slotName].unit = {
        carduid: uid,
        cardId,
        cardData,
        placedAt: 0,
        placedBy: player.id,
        isRested: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: Number(cardData.ap || 0),
        originalHP: Number(cardData.hp || 0),
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        isFirstPlay: false,
        effectUsage: {},
    };
    return uid;
}

function addPilot(player, slotName, cardId, tag, levelOverride) {
    const cardData = CardDatabaseManager.getCardDetails(cardId);
    const resolvedCardData = (typeof levelOverride === 'number')
        ? { ...cardData, level: levelOverride }
        : cardData;
    const uid = `${cardId}_${player.id}_${slotName}_${tag || 'p'}`;
    player.zones[slotName].pilot = {
        carduid: uid,
        cardId,
        cardData: resolvedCardData,
        placedAt: 0,
        placedBy: player.id,
        isRested: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: Number(resolvedCardData.ap || 0),
        originalHP: Number(resolvedCardData.hp || 0),
        effectUsage: {},
    };
    return uid;
}

function prepareCommand(env, carduid) {
    return PlayCardPreparationManager.prepare(
        env,
        'playerId_1',
        {
            carduid,
            playAs: 'command',
            gameId: 'test_game',
        },
        false
    );
}

function getGd03110DestroyStep() {
    const card = CardDatabaseManager.getCardDetails('GD03-110');
    const playRule = (card?.effects?.rules || []).find((rule) => rule?.effectId === 'play_effect');
    const step = playRule?.parameters?.steps?.[0];
    if (!step || step.action !== 'destroy') {
        throw new Error('GD03-110 destroy step not found');
    }
    return step;
}

function latestDestroyedByEffect(gameEnv) {
    const queue = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
    const list = queue.filter((event) => event && event.type === 'UNIT_DESTROYED_BY_EFFECT');
    return list[list.length - 1] || null;
}

describe('GD03-110 pilot destroy semantics', () => {
    test('is playable when opponent has pilot level 5 or lower paired to an enemy unit', () => {
        const { env, p1, p2 } = createBaseEnv();
        const commandUid = addHandCommand(p1, 'GD03-110');
        addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, 'u');
        addPilot(p2, 'slot1', FIXTURE_IDS.pilot, 'p');

        const result = prepareCommand(env, commandUid);
        expect(result.success).toBe(true);
    });

    test('is not playable when paired pilot level is above 5', () => {
        const { env, p1, p2 } = createBaseEnv();
        const commandUid = addHandCommand(p1, 'GD03-110');
        addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, 'u');
        addPilot(p2, 'slot1', FIXTURE_IDS.pilot, 'p', 6);

        const result = prepareCommand(env, commandUid);
        expect(result.success).toBe(false);
        expect(String(result.error || '')).toContain('No eligible targets for mandatory effect step');
    });

    test('is not playable when opponent pilot is not paired to any unit', () => {
        const { env, p1, p2 } = createBaseEnv();
        const commandUid = addHandCommand(p1, 'GD03-110');
        addPilot(p2, 'slot1', FIXTURE_IDS.pilot, 'p');

        const result = prepareCommand(env, commandUid);
        expect(result.success).toBe(false);
        expect(String(result.error || '')).toContain('No eligible targets for mandatory effect step');
    });

    test('destroy step removes only pilot and keeps paired unit in play', () => {
        const { env, p2 } = createBaseEnv();
        const unitUid = addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, 'u');
        const pilotUid = addPilot(p2, 'slot1', FIXTURE_IDS.pilot, 'p');
        const destroyStep = getGd03110DestroyStep();

        const result = applyDestroyEffect(
            env,
            'playerId_1',
            'GD03-110_hand_0001',
            destroyStep,
            [{ playerId: 'playerId_2', zone: 'slot1', carduid: pilotUid }]
        );
        expect(result.success).toBe(true);

        expect(p2.zones.slot1.unit?.carduid).toBe(unitUid);
        expect(p2.zones.slot1.pilot).toBeFalsy();

        const trash = Array.isArray(p2.zones.trashArea) ? p2.zones.trashArea : [];
        expect(trash.some((c) => c.carduid === pilotUid)).toBe(true);
        expect(trash.some((c) => c.carduid === unitUid)).toBe(false);

        const destroyedEvent = latestDestroyedByEffect(env);
        expect(destroyedEvent).toBeTruthy();
        expect(destroyedEvent.payload.carduid).toBe(pilotUid);
        expect(destroyedEvent.payload.destroyedCardType).toBe('pilot');
    });
});
