// src/services/effects/BaseAbilityManager.ts
// Handles activated abilities originating from base cards

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { PlayerActionEvent, PlayerActionEventData, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { GameActionValidator } from '../GameActionValidator';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { DeployTargetManager } from '../DeployTargetManager';
import { ExecutionResult } from '../ExecutionResult';

export class BaseAbilityManager {

    static executeBaseAbility(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const eventData: PlayerActionEventData = event.data || ({} as PlayerActionEventData);
        const actingPlayerId = typeof eventData.playerId === 'string' ? eventData.playerId : event.playerId;
        const fromBurst = Boolean(eventData.fromBurst);

        if (!actingPlayerId) {
            return { success: false, error: 'activateBaseAbility requires playerId' };
        }

        const turnCheck = GameActionValidator.ensureTurn(gameEnv, actingPlayerId, fromBurst);
        if (!turnCheck.success) {
            return turnCheck;
        }

        if (!fromBurst && gameEnv.phase !== GamePhase.MAIN_PHASE) {
            return {
                success: false,
                error: `activateBaseAbility only available during MAIN_PHASE (current: ${gameEnv.phase})`
            };
        }

        const baseCarduid = typeof (eventData as Record<string, unknown>).carduid === 'string'
            ? ((eventData as Record<string, unknown>).carduid as string)
            : undefined;

        if (!baseCarduid) {
            return {
                success: false,
                error: 'activateBaseAbility requires carduid'
            };
        }

        const playerState = gameEnv.players[actingPlayerId];
        if (!playerState?.zones?.base || !Array.isArray(playerState.zones.base)) {
            return {
                success: false,
                error: 'Player does not control a base zone'
            };
        }

        const baseCard = playerState.zones.base.find(card => card.carduid === baseCarduid);
        if (!baseCard) {
            return {
                success: false,
                error: `Base ${baseCarduid} not found for player ${actingPlayerId}`
            };
        }

        if (baseCard.isRested) {
            return {
                success: false,
                error: 'Base is already rested'
            };
        }

        const requestedEffectId = typeof (eventData as Record<string, unknown>).effectId === 'string'
            ? ((eventData as Record<string, unknown>).effectId as string)
            : undefined;

        const effectLookup = BaseAbilityManager.findActivatedEffect(baseCard.cardData?.effects?.rules, requestedEffectId);
        if (!effectLookup.success || !('effect' in effectLookup)) {
            return effectLookup;
        }

        const effectDefinition = effectLookup.effect;
        const normalizedEffect = ensureEffectDefaults({ ...effectDefinition });
        if (!fromBurst && !BaseAbilityManager.allowsMainPhase(normalizedEffect)) {
            return {
                success: false,
                error: `Effect ${normalizedEffect.effectId} cannot be activated during MAIN_PHASE`
            };
        }

        const costConfig = (effectDefinition as unknown as { cost?: Record<string, unknown> }).cost;
        let baseRestedForCost = false;

        if (costConfig) {
            const requiresRest = costConfig['rest'] === 'self' || costConfig['tap'] === 'self';
            if (requiresRest) {
                baseCard.isRested = true;
                baseRestedForCost = true;
            }
        }

        const abilityResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            actingPlayerId,
            baseCard.carduid,
            normalizedEffect
        );

        if (!abilityResult.success) {
            if (baseRestedForCost) {
                baseCard.isRested = false;
            }
            return {
                success: false,
                error: abilityResult.error || 'Base ability failed'
            };
        }

        console.log(`🏰 Activated base ability ${normalizedEffect.effectId} from ${baseCard.carduid}`);
        return { success: true };
    }

    private static findActivatedEffect(rules: unknown, requestedId?: string): { success: true; effect: EffectDefinition } | ExecutionResult {
        if (!Array.isArray(rules)) {
            return { success: false, error: 'No activated effect available on base' };
        }

        const effect = rules.find(rule => {
            if (!rule || typeof rule !== 'object') {
                return false;
            }

            const definition = rule as EffectDefinition;
            if (requestedId) {
                return definition.effectId === requestedId;
            }
            return definition.type === 'activated';
        }) as EffectDefinition | undefined;

        if (!effect) {
            return {
                success: false,
                error: requestedId ? `Effect ${requestedId} not found on base` : 'No activated effect available on base'
            };
        }

        if (effect.type && effect.type !== 'activated') {
            return {
                success: false,
                error: `Effect ${effect.effectId} is not an activated ability`
            };
        }

        return { success: true, effect };
    }

    private static allowsMainPhase(effect: EffectDefinition): boolean {
        const timingRecord = effect.timing as Record<string, unknown> | undefined;
        const windows = Array.isArray(timingRecord?.['windows'])
            ? (timingRecord!['windows'] as string[]).map(window => window.toUpperCase())
            : [];

        if (windows.length === 0) {
            return true;
        }

        return windows.includes('MAIN_PHASE');
    }
}
