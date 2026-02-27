import type { GameEnvironment } from '../../models/GameEnvironment';
import type { Player } from '../../models/Player';
import { HandContinuousModifier } from '../effects/HandContinuousModifier';

type FacedownShieldStub = {
    facedown: true;
    index: number;
    carduid: string;
};

export class GameEnvViewBuilder {
    static toPlayerView(gameEnv: GameEnvironment, viewerPlayerId: string): Record<string, unknown> {
        const aiPlayerSet = new Set(Array.isArray(gameEnv.aiPlayerIds) ? gameEnv.aiPlayerIds : []);
        const players: Record<string, unknown> = {};
        for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
            players[playerId] = this.buildPlayerView(
                gameEnv,
                player as Player,
                viewerPlayerId,
                aiPlayerSet.has(playerId)
            );
        }

        return {
            phase: gameEnv.phase,
            playerId_1: gameEnv.playerId_1,
            playerId_2: gameEnv.playerId_2,
            gameStarted: gameEnv.gameStarted,
            firstPlayer: gameEnv.firstPlayer,
            firstPlayerChooser: gameEnv.firstPlayerChooser,
            firstPlayerDecision: gameEnv.firstPlayerDecision,
            hasChosenFirstPlayer: gameEnv.hasChosenFirstPlayer,
            currentPlayer: gameEnv.currentPlayer,
            currentTurn: gameEnv.currentTurn,
            playersReady: gameEnv.playersReady,
            currentBattle: gameEnv.currentBattle,
            version: gameEnv.version,
            // Frontend choice flow must use notificationQueue only.
            // Keep processingQueue as non-authoritative debug data.
            processingQueue: [],
            processingEnabled: gameEnv.processingEnabled,
            maxEventsPerCycle: gameEnv.maxEventsPerCycle,
            notificationQueue: gameEnv.notificationQueue,
            lastEventId: gameEnv.lastEventId,
            gameEnded: gameEnv.gameEnded,
            winnerId: gameEnv.winnerId,
            endReason: gameEnv.endReason,
            endedAt: gameEnv.endedAt,
            pendingPhaseTransition: gameEnv.pendingPhaseTransition,
            aiPlayerIds: Array.from(aiPlayerSet),
            players
        };
    }

    private static buildPlayerView(
        gameEnv: GameEnvironment,
        player: Player,
        viewerPlayerId: string,
        isAiPlayer: boolean
    ): Record<string, unknown> {
        const isViewer = player.id === viewerPlayerId;

        const handUids = Array.isArray(player.deck?._handUids) ? player.deck._handUids : [];
        const mainDeck = Array.isArray(player.deck?.mainDeck) ? player.deck.mainDeck : [];

        const shieldArea = Array.isArray(player.zones?.shieldArea) ? player.zones.shieldArea : [];
        const facedownShieldArea: FacedownShieldStub[] = shieldArea.map((_card, index) => ({
            facedown: true,
            index,
            carduid: `FACEDOWN_SHIELD_${index}`
        }));

        const zones = player.zones || ({} as any);
        const viewerHand = isViewer ? this.buildViewerHand(gameEnv, player.id, player.deck?.hand) : [];

        return {
            id: player.id,
            name: player.name,
            isAi: isAiPlayer,
            confirmIsRedraw: player.confirmIsRedraw,
            isRedraw: player.isRedraw,
            playerPoint: player.playerPoint,
            isReady: player.isReady,
            deck: {
                hand: viewerHand,
                handUids: isViewer ? handUids : [],
                handCount: handUids.length,
                deckCount: mainDeck.length
            },
            zones: {
                slot1: zones.slot1,
                slot2: zones.slot2,
                slot3: zones.slot3,
                slot4: zones.slot4,
                slot5: zones.slot5,
                slot6: zones.slot6,
                base: zones.base,
                energyArea: zones.energyArea,
                trashArea: zones.trashArea,
                shieldArea: facedownShieldArea,
                shieldCount: shieldArea.length
            },
            effectRegistry: player.effectRegistry,
            delayedTriggers: player.delayedTriggers
        };
    }

    private static buildViewerHand(gameEnv: GameEnvironment, playerId: string, hand: any[]): any[] {
        if (!Array.isArray(hand)) {
            return [];
        }

        return hand.map((handCard: any) => {
            const baseCardData = handCard?.cardData;
            if (!baseCardData) {
                return handCard;
            }

            const baseCostRaw = Number(baseCardData.cost);
            const baseLevelRaw = Number(baseCardData.level);
            const baseCost = Number.isFinite(baseCostRaw) ? baseCostRaw : 0;
            const baseLevel = Number.isFinite(baseLevelRaw) ? baseLevelRaw : 0;

            const modifiedCardData = HandContinuousModifier.applyModifiersForHandCardPlay(
                gameEnv,
                playerId,
                {
                    ...baseCardData,
                    cost: baseCost,
                    level: baseLevel
                }
            );

            const effectiveCostRaw = Number(modifiedCardData?.cost);
            const effectiveLevelRaw = Number(modifiedCardData?.level);
            const effectiveCost = Number.isFinite(effectiveCostRaw) ? effectiveCostRaw : baseCost;
            const effectiveLevel = Number.isFinite(effectiveLevelRaw) ? effectiveLevelRaw : baseLevel;

            return {
                ...handCard,
                cardData: {
                    ...baseCardData,
                    baseCost,
                    baseLevel,
                    effectiveCost,
                    effectiveLevel
                }
            };
        });
    }
}
