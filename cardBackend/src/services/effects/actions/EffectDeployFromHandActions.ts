// src/services/effects/actions/EffectDeployFromHandActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { CardDatabaseManager, createZoneCard, UnitZoneCard } from '../../../models/CardSystem';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';

export function applyDeployFromHandEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    _effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.zones || !player.deck) {
        return { success: false, error: 'Player not found for deploy_from_hand' };
    }

    const emptySlots = SlotZoneUtils.getEmptySlotNames(player.zones);

    if (emptySlots.length === 0) {
        return { success: false, error: 'No empty unit slots available for deploy_from_hand' };
    }

    if (selectedTargets.length > emptySlots.length) {
        return { success: false, error: 'Not enough empty unit slots available for deploy_from_hand' };
    }

    for (let i = 0; i < selectedTargets.length; i++) {
        const target = selectedTargets[i];
        const targetCarduid = target.carduid;

        if (target.playerId !== sourcePlayerId) {
            return { success: false, error: 'deploy_from_hand can only deploy cards from your own hand' };
        }

        const cardId = targetCarduid.split('_')[0];
        const cardData = target.cardData || CardDatabaseManager.getCardDetails(cardId);
        if (!cardData || cardData.cardType !== 'unit') {
            return { success: false, error: `Card ${cardId} is not a unit and cannot be deployed` };
        }

        const removed = player.deck.playCardFromHand(targetCarduid);
        if (!removed) {
            return { success: false, error: `Card ${targetCarduid} not found in hand` };
        }

        const destinationSlot = emptySlots[i];
        const slotResult = SlotZoneUtils.getSlotZone(player.zones, destinationSlot);
        if (!slotResult.isValid || !slotResult.slot) {
            return { success: false, error: `Invalid destination slot ${destinationSlot}` };
        }

        const unitCard = createZoneCard(targetCarduid, cardId, cardData, sourcePlayerId, 'unit') as UnitZoneCard;
        slotResult.slot.unit = unitCard;

        console.log(`🚀 Deployed ${cardId} from hand to ${destinationSlot} (source ${sourceCarduid || 'unknown'})`);
    }

    return { success: true };
}
