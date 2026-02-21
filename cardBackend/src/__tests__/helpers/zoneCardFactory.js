function createZoneCard({
    carduid,
    cardId,
    playedAs,
    name = cardId,
    cardType,
    traits = [],
    link = [],
    ap,
    hp,
    effectsRules = [],
    cardDataExtras = {},
    zoneExtras = {}
}) {
    return {
        carduid,
        cardId,
        ...(playedAs ? { playedAs } : {}),
        isRested: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: ap,
        originalHP: hp,
        temporaryEffects: [],
        effectUsage: {},
        ...zoneExtras,
        cardData: {
            id: cardId,
            name,
            cardType,
            traits,
            link,
            ap,
            hp,
            effects: { description: [], rules: effectsRules },
            ...cardDataExtras
        }
    };
}

function createUnitZoneCard({
    carduid,
    cardId,
    name = cardId,
    ap = 3,
    hp = 3,
    traits = [],
    link = [],
    effectsRules = [],
    cardDataExtras = {},
    zoneExtras = {}
}) {
    return createZoneCard({
        carduid,
        cardId,
        name,
        cardType: 'unit',
        traits,
        link,
        ap,
        hp,
        effectsRules,
        cardDataExtras,
        zoneExtras
    });
}

function createPilotZoneCard({
    carduid,
    cardId,
    name = cardId,
    traits = [],
    ap = 1,
    hp = 1,
    playedAs = 'pilot',
    cardDataExtras = {},
    zoneExtras = {}
}) {
    return createZoneCard({
        carduid,
        cardId,
        playedAs,
        name,
        cardType: 'pilot',
        traits,
        ap,
        hp,
        cardDataExtras,
        zoneExtras
    });
}

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    for (let i = 1; i <= 6; i++) {
        const slot = player?.zones?.[`slot${i}`];
        if (slot?.unit?.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

function findSlotByUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    for (let i = 1; i <= 6; i++) {
        const slot = player?.zones?.[`slot${i}`];
        if (slot?.unit?.carduid === carduid) {
            return slot;
        }
    }
    return null;
}

module.exports = {
    createUnitZoneCard,
    createPilotZoneCard,
    findUnit,
    findSlotByUnit
};
