import { CardDatabaseManager, EnergyZoneCard } from '../../../models/CardSystem';
import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { UnitDeployService } from '../../deploy/UnitDeployService';
import { EnergyManager } from '../../EnergyManager';

function rollbackEnergy(
    gameEnv: GameEnvironment,
    playerId: string,
    tapped: EnergyZoneCard[],
    consumedExtras: EnergyZoneCard[] = []
): void {
    const player = gameEnv.players[playerId];
    const energyArea = player?.zones?.energyArea;
    if (!energyArea) {
        return;
    }

    const consumedIds = new Set(consumedExtras.map(card => card.carduid));

    consumedExtras.forEach(card => {
        if (!energyArea.some(existing => existing.carduid === card.carduid)) {
            card.isRested = false;
            energyArea.push(card);
        }
    });

    tapped.forEach(card => {
        if (!consumedIds.has(card.carduid)) {
            card.isRested = false;
        }
    });
}

function removeCardFromSourceZone(
    gameEnv: GameEnvironment,
    playerId: string,
    zone: string,
    carduid: string
): { success: boolean; removedCard?: any; error?: string } {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.zones) {
        return { success: false, error: `Player ${playerId} zones not found` };
    }

    const normalizedZone = String(zone || '').toLowerCase();
    if (normalizedZone === 'trash') {
        const idx = player.zones.trashArea.findIndex((card: any) => card?.carduid === carduid);
        if (idx < 0) {
            return { success: false, error: `Card ${carduid} not found in ${playerId} trash` };
        }
        const [removed] = player.zones.trashArea.splice(idx, 1);
        return { success: true, removedCard: removed };
    }

    if (normalizedZone === 'hand') {
        const handCards = player.deck?.hand || [];
        const found = handCards.find((card: any) => card?.carduid === carduid);
        const removed = player.deck?.playCardFromHand(carduid);
        if (!removed) {
            return { success: false, error: `Card ${carduid} not found in ${playerId} hand` };
        }
        return { success: true, removedCard: found || null };
    }

    return { success: false, error: `deploy currently supports hand/trash targets only (got ${zone})` };
}

function restoreCardToSourceZone(
    gameEnv: GameEnvironment,
    playerId: string,
    zone: string,
    carduid: string,
    cardId: string,
    cardData: any
): void {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.zones) {
        return;
    }

    const normalizedZone = String(zone || '').toLowerCase();
    if (normalizedZone === 'trash') {
        player.zones.trashArea.push({
            carduid,
            cardId,
            cardData
        });
        return;
    }

    if (normalizedZone === 'hand') {
        if (!player.deck?._handUids?.includes(carduid)) {
            player.deck._handUids.push(carduid);
        }
    }
}

export function applyDeployEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.zones) {
        return { success: false, error: 'Player zones unavailable for deploy effect' };
    }

    const emptySlots = SlotZoneUtils.getEmptySlotNames(player.zones);
    if (emptySlots.length < selectedTargets.length) {
        return { success: false, error: 'Not enough empty unit slots available for deploy effect' };
    }

    const payCost = effect.parameters?.payCost === true;

    for (let index = 0; index < selectedTargets.length; index++) {
        const target = selectedTargets[index];
        if (target.playerId !== sourcePlayerId) {
            return { success: false, error: 'deploy can only deploy cards from your own zones' };
        }

        const carduid = target.carduid;
        const cardId = carduid.split('_')[0];
        const cardData = target.cardData || CardDatabaseManager.getCardDetails(cardId);
        if (!cardData || cardData.cardType !== 'unit') {
            return { success: false, error: `Card ${cardId} is not a unit and cannot be deployed` };
        }

        let tappedEnergy: EnergyZoneCard[] = [];
        let consumedExtras: EnergyZoneCard[] = [];
        if (payCost) {
            const energyResult = EnergyManager.validateAndPayEnergyForCard(
                gameEnv,
                sourcePlayerId,
                cardData,
                { fromBurst: false }
            );
            if (!energyResult.success) {
                return { success: false, error: energyResult.error || `Failed to pay deploy cost for ${cardId}` };
            }
            tappedEnergy = energyResult.tapped || [];
            consumedExtras = energyResult.consumedExtras || [];
        }

        const fromZone = String(target.zone || '').toLowerCase();
        const removeResult = removeCardFromSourceZone(gameEnv, sourcePlayerId, fromZone, carduid);
        if (!removeResult.success) {
            rollbackEnergy(gameEnv, sourcePlayerId, tappedEnergy, consumedExtras);
            return { success: false, error: removeResult.error || `Failed to remove ${carduid} from ${fromZone}` };
        }

        const destinationSlot = emptySlots[index];
        const deployResult = UnitDeployService.deployUnitCardToSlot(gameEnv, {
            playerId: sourcePlayerId,
            destinationSlot,
            carduid,
            cardId,
            cardData,
            sourceCarduid,
            fromZone,
            notificationType: 'CARD_DEPLOYED_BY_EFFECT',
            notificationExtra: {
                effectId: effect.effectId
            }
        });
        if (!deployResult.success) {
            restoreCardToSourceZone(gameEnv, sourcePlayerId, fromZone, carduid, cardId, cardData);
            rollbackEnergy(gameEnv, sourcePlayerId, tappedEnergy, consumedExtras);
            return { success: false, error: deployResult.error || `Failed to deploy ${cardId}` };
        }
    }

    return { success: true };
}

