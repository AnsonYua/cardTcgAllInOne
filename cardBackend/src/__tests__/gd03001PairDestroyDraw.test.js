const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { EventType } = require('../models/GameEnums');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

function getPairRule() {
    const rule = gd03.cards['GD03-001'].effects.rules.find((entry) => entry.effectId === 'pair_effect');
    expect(rule).toBeTruthy();
    return {
        ...rule,
        sourceCarduid: 'GD03-001_unit_0001',
        pairedSlot: 'slot1'
    };
}

function setupEnv() {
    const gameEnv = new GameEnvironment();
    const owner = gameEnv.addPlayer('playerId_1', 'P1');
    const opponent = gameEnv.addPlayer('playerId_2', 'P2');

    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = owner.id;
    gameEnv.phase = 'MAIN_PHASE';

    owner.zones.slot1 = {
        unit: createUnitZoneCard({
            carduid: 'GD03-001_unit_0001',
            cardId: 'GD03-001',
            name: gd03.cards['GD03-001'].name,
            ap: gd03.cards['GD03-001'].ap,
            hp: gd03.cards['GD03-001'].hp,
            traits: gd03.cards['GD03-001'].traits,
            link: gd03.cards['GD03-001'].link,
            cardDataExtras: {
                color: gd03.cards['GD03-001'].color,
                level: gd03.cards['GD03-001'].level,
                zone: gd03.cards['GD03-001'].zone,
                effects: gd03.cards['GD03-001'].effects
            }
        })
    };

    owner.deck.mainDeck = ['GD01-001_draw_0001', 'GD01-002_draw_0002'];
    owner.deck.hand = [];
    owner.deck.handUids = [];
    owner.deck._handUids = [];

    return { gameEnv, owner, opponent };
}

function findTargetChoice(gameEnv) {
    return gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
}

function resolveTargetChoice(gameEnv, selectedCarduid) {
    const choiceEvent = findTargetChoice(gameEnv);
    expect(choiceEvent).toBeTruthy();
    const selected = choiceEvent.data.availableTargets.find((target) => target.carduid === selectedCarduid);
    expect(selected).toBeTruthy();
    choiceEvent.data.selectedTargets = [selected];
    choiceEvent.data.userDecisionMade = true;
    const processResult = gameEnv.processEvents();
    expect(processResult.success).toBe(true);
}

describe('GD03-001 pair effect destroy->draw rider', () => {
    test('prompts only rested enemy units when multiple valid targets exist', () => {
        const { gameEnv, owner, opponent } = setupEnv();
        opponent.zones.slot1 = {
            unit: createUnitZoneCard({
                carduid: 'enemy_rested_lethal_0001',
                cardId: 'ENEMY-RESTED-0001',
                ap: 2,
                hp: 3,
                zoneExtras: { isRested: true, damageReceived: 0 }
            })
        };
        opponent.zones.slot3 = {
            unit: createUnitZoneCard({
                carduid: 'enemy_rested_valid_0002',
                cardId: 'ENEMY-RESTED-0002',
                ap: 2,
                hp: 4,
                zoneExtras: { isRested: true, damageReceived: 0 }
            })
        };
        opponent.zones.slot2 = {
            unit: createUnitZoneCard({
                carduid: 'enemy_active_invalid_0001',
                cardId: 'ENEMY-ACTIVE-0001',
                ap: 2,
                hp: 3,
                zoneExtras: { isRested: false, damageReceived: 0 }
            })
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, owner.id, {
            carduid: 'GD03-001_unit_0001',
            effects: [getPairRule()]
        });
        expect(result.success).toBe(true);

        const choiceEvent = findTargetChoice(gameEnv);
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.effect.action).toBe('damage');
        const availableTargets = choiceEvent.data.availableTargets.map((target) => target.carduid);
        expect(availableTargets).toContain('enemy_rested_lethal_0001');
        expect(availableTargets).toContain('enemy_rested_valid_0002');
        expect(availableTargets).not.toContain('enemy_active_invalid_0001');
    });

    test('draws 1 when lethal damage destroys target', () => {
        const { gameEnv, owner, opponent } = setupEnv();
        opponent.zones.slot1 = {
            unit: createUnitZoneCard({
                carduid: 'enemy_rested_lethal_0003',
                cardId: 'ENEMY-RESTED-LETHAL-0003',
                ap: 2,
                hp: 3,
                zoneExtras: { isRested: true, damageReceived: 2 }
            })
        };

        const handBefore = owner.deck.handUids.length;
        const result = PairingEffectManager.processPairingEffect(gameEnv, owner.id, {
            carduid: 'GD03-001_unit_0001',
            effects: [getPairRule()]
        });
        expect(result.success).toBe(true);
        expect(findTargetChoice(gameEnv)).toBeFalsy();

        expect(opponent.zones.slot1.unit).toBeFalsy();
        expect((opponent.zones.trashArea || []).some((card) => card.carduid === 'enemy_rested_lethal_0003')).toBe(true);
        expect(owner.deck.handUids.length).toBe(handBefore + 1);
        expect(gameEnv.notificationQueue.some((n) => n.type === 'CARD_DRAWN' && n.payload?.playerId === owner.id)).toBe(true);
    });

    test('does not draw when damaged rested target survives', () => {
        const { gameEnv, owner, opponent } = setupEnv();
        opponent.zones.slot1 = {
            unit: createUnitZoneCard({
                carduid: 'enemy_rested_survive_0001',
                cardId: 'ENEMY-RESTED-0002',
                ap: 2,
                hp: 3,
                zoneExtras: { isRested: true, damageReceived: 1 }
            })
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, owner.id, {
            carduid: 'GD03-001_unit_0001',
            effects: [getPairRule()]
        });
        expect(result.success).toBe(true);
        expect(findTargetChoice(gameEnv)).toBeFalsy();

        const handBefore = owner.deck.handUids.length;

        expect(opponent.zones.slot1.unit).toBeTruthy();
        expect(opponent.zones.slot1.unit.damageReceived).toBe(2);
        expect(owner.deck.handUids.length).toBe(handBefore);
        expect(gameEnv.notificationQueue.some((n) => n.type === 'CARD_DRAWN' && n.payload?.playerId === owner.id)).toBe(false);
    });
});
