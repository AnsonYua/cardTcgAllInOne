const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager, createZoneCard } = require('../models/CardSystem');
const { PairingEffectManager } = require('../services/PairingEffectManager');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createClanUnit(carduid, playerId, name = 'Clan Unit') {
    return createZoneCard(
        carduid,
        'TEST-CLAN-UNIT',
        {
            id: 'TEST-CLAN-UNIT',
            name,
            cardType: 'unit',
            traits: ['Clan'],
            link: ['Clan'],
            ap: 3,
            hp: 3,
            effects: { description: [], rules: [] }
        },
        playerId,
        'unit'
    );
}

function createClanPilot(carduid, playerId, name = 'Clan Pilot') {
    return createZoneCard(
        carduid,
        'TEST-CLAN-PILOT',
        {
            id: 'TEST-CLAN-PILOT',
            name,
            cardType: 'pilot',
            traits: ['Clan'],
            link: [],
            ap: 1,
            hp: 1,
            effects: { description: [], rules: [] }
        },
        playerId,
        'pilot'
    );
}

function getBreachValues(card) {
    const temporaryEffects = Array.isArray(card?.temporaryEffects) ? card.temporaryEffects : [];
    return temporaryEffects
        .map((effect) => (typeof effect?.breachValue === 'number' ? effect.breachValue : 0))
        .filter((value) => value > 0);
}

function runPairingForPilot(gameEnv, pilotCarduid, targetUnitCarduid) {
    const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(
        {
            playerId: 'playerId_1',
            carduid: pilotCarduid,
            playAs: 'pilot',
            targetUnit: targetUnitCarduid
        },
        gameEnv,
        'playerId_1'
    );

    expect(pairingEvent).toBeTruthy();
    gameEnv.enqueueForProcessing(pairingEvent);
    const result = gameEnv.processEvents();
    expect(result.success).toBe(true);
}

describe('ST06-015 pairing breach grant', () => {
    test('grants Breach 3 to JUST_LINKED unit and enforces once per turn', () => {
        const gameEnv = new GameEnvironment();
        const player1 = gameEnv.addPlayer('playerId_1', 'Player 1');
        gameEnv.addPlayer('playerId_2', 'Player 2');

        gameEnv.phase = 'MAIN_PHASE';
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.currentTurn = 1;
        gameEnv.gameStarted = true;

        const baseCardData = clone(CardDatabaseManager.getCardDetails('ST06-015'));
        expect(baseCardData).toBeTruthy();
        player1.zones.base = [
            createZoneCard('ST06-015_base_test_0001', 'ST06-015', baseCardData, 'playerId_1', 'base')
        ];

        // Existing linked Clan pair should NOT receive the grant when another unit just linked.
        player1.zones.slot2.unit = createClanUnit('existing_linked_unit_0001', 'playerId_1', 'Existing Clan Unit');
        player1.zones.slot2.pilot = createClanPilot('existing_linked_pilot_0001', 'playerId_1', 'Existing Clan Pilot');

        player1.zones.slot1.unit = createClanUnit('new_link_unit_0001', 'playerId_1', 'New Link Unit');
        player1.zones.slot3.unit = createClanUnit('second_link_unit_0001', 'playerId_1', 'Second Link Unit');

        player1.zones.slot1.pilot = createClanPilot('new_link_pilot_0001', 'playerId_1', 'New Link Pilot');
        runPairingForPilot(gameEnv, 'new_link_pilot_0001', 'new_link_unit_0001');

        expect(getBreachValues(player1.zones.slot1.unit)).toEqual([3]);
        expect(getBreachValues(player1.zones.slot2.unit)).toEqual([]);

        const baseCard = player1.zones.base[0];
        const usage = baseCard.effectUsage?.once_per_turn_grant_breach_3_to_just_linked_clan_unit;
        expect(usage?.lastUsedTurn).toBe(1);

        player1.zones.slot3.pilot = createClanPilot('second_link_pilot_0001', 'playerId_1', 'Second Link Pilot');
        runPairingForPilot(gameEnv, 'second_link_pilot_0001', 'second_link_unit_0001');

        expect(getBreachValues(player1.zones.slot3.unit)).toEqual([]);
        expect(baseCard.effectUsage?.once_per_turn_grant_breach_3_to_just_linked_clan_unit?.lastUsedTurn).toBe(1);
    });
});
