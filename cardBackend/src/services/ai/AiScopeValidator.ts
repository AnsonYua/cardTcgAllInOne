export function validateScopeMatrix(gameEnvView: any, aiPlayerId: string): string | null {
    const players = gameEnvView?.players || {};
    for (const [playerId, playerData] of Object.entries(players)) {
        const player = playerData as any;
        const deck = player?.deck || {};
        const zones = player?.zones || {};

        if (playerId !== aiPlayerId) {
            if (Array.isArray(deck.hand) && deck.hand.length > 0) {
                return 'opponent_hand_exposed';
            }
            if (Array.isArray(deck.handUids) && deck.handUids.length > 0) {
                return 'opponent_handuids_exposed';
            }
        }

        if (Array.isArray(deck.mainDeck) && deck.mainDeck.length > 0) {
            return 'maindeck_identities_exposed';
        }

        const shieldArea = Array.isArray(zones.shieldArea) ? zones.shieldArea : [];
        for (const shield of shieldArea) {
            if ((shield as any)?.cardId || (shield as any)?.cardData) {
                return 'shield_identity_exposed';
            }
        }
    }
    return null;
}
