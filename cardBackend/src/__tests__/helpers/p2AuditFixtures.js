function makeBase(carduid, cardId, { isRested = false } = {}) {
    return {
        carduid,
        cardId,
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested,
        effectUsage: {},
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'base',
            color: 'White',
            level: 3,
            cost: 1,
            zone: ['Space'],
            traits: [],
            link: [],
            ap: 0,
            hp: 5,
            effects: { description: [], rules: [] }
        }
    };
}

function makeZoneLikeCard(carduid, cardId, cardData) {
    return {
        carduid,
        cardId,
        cardData,
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested: false,
        effectUsage: {},
        originalAP: cardData.ap || 0,
        originalHP: cardData.hp || 0,
        damageReceived: 0,
        playedThisTurn: false,
        canAttackOnPlayTurn: false
    };
}

module.exports = {
    makeBase,
    makeZoneLikeCard
};
