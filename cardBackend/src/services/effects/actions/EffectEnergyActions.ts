import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { EnergyManager } from '../../EnergyManager';
import { extractNumericValue } from './EffectActionUtils';
import { GameNotificationManager } from '../../GameNotificationManager';
import { ExResourcePlacedTriggerDispatcher } from '../ExResourcePlacedTriggerDispatcher';

export function applyAddExtraEnergyEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    const parameters = effect.parameters;
    const count = extractNumericValue(parameters) ?? 1;
    if (count <= 0) {
        return { success: false, error: 'addExtraEnergy requires a positive value' };
    }

    const player = gameEnv.getPlayer(sourcePlayerId) || gameEnv.players[sourcePlayerId];
    if (!player?.zones || !Array.isArray(player.zones.energyArea)) {
        return { success: false, error: 'Player zones not found for addExtraEnergy' };
    }

    const rested = parameters?.rested === true;
    const addedCarduids: string[] = [];

    for (let i = 0; i < count; i++) {
        const before = player.zones.energyArea.length;
        const added = EnergyManager.addExtraEnergy(gameEnv, sourcePlayerId, { rested });
        if (!added) {
            return { success: false, error: 'Failed to add extra energy' };
        }
        const afterCards = player.zones.energyArea.slice(before);
        for (const energyCard of afterCards) {
            if (energyCard?.carduid) {
                addedCarduids.push(energyCard.carduid);
            }
        }
    }

    console.log(`⚡ Added ${count} extra energy to player ${sourcePlayerId}`);

    if (addedCarduids.length > 0) {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'RESOURCE_GAINED',
            {
                playerId: sourcePlayerId,
                sourceCarduid,
                effectId: effect.effectId,
                count: addedCarduids.length,
                carduids: addedCarduids,
                rested,
                isExtraEnergy: true,
                timestamp: Date.now()
            },
            'normal'
        );

        ExResourcePlacedTriggerDispatcher.dispatchIfNeeded({
            gameEnv,
            playerId: sourcePlayerId,
            placedCarduids: addedCarduids,
            sourceCarduid,
            reason: 'addExtraEnergy'
        });
    }

    return { success: true };
}

export function applyAddBasicEnergyEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    const parameters = effect.parameters;
    const count = extractNumericValue(parameters) ?? 1;
    if (count <= 0) {
        return { success: false, error: 'addBasicEnergy requires a positive value' };
    }

    const player = gameEnv.getPlayer(sourcePlayerId) || gameEnv.players[sourcePlayerId];
    if (!player?.zones || !Array.isArray(player.zones.energyArea)) {
        return { success: false, error: 'Player zones not found for addBasicEnergy' };
    }

    const rested = parameters?.rested === true;
    const addedCarduids: string[] = [];

    for (let i = 0; i < count; i++) {
        const before = player.zones.energyArea.length;
        const added = EnergyManager.addBasicEnergy(gameEnv, sourcePlayerId, { rested });
        if (!added) {
            return { success: false, error: 'Failed to add basic energy' };
        }
        const afterCards = player.zones.energyArea.slice(before);
        for (const energyCard of afterCards) {
            if (energyCard?.carduid) {
                addedCarduids.push(energyCard.carduid);
            }
        }
    }

    console.log(`⚡ Added ${count} basic energy to player ${sourcePlayerId}`);

    if (addedCarduids.length > 0) {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'RESOURCE_GAINED',
            {
                playerId: sourcePlayerId,
                sourceCarduid,
                effectId: effect.effectId,
                count: addedCarduids.length,
                carduids: addedCarduids,
                rested,
                isExtraEnergy: false,
                timestamp: Date.now()
            },
            'normal'
        );
    }

    return { success: true };
}
