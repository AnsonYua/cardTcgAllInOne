// src/services/effects/MainPhaseAbilityManager.ts
// Handles MAIN_PHASE activated abilities such as command card effects

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { CardDatabaseManager } from '../../models/CardSystem';
import { GameActionValidator } from '../GameActionValidator';
import { PlayerCardManager } from '../PlayerCardManager';
import { EnergyManager, EnergyCheckResult } from '../EnergyManager';
import { EffectDefinition, PlayerActionEvent, PlayerActionEventData, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from './EffectExecutor';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ExecutionResult } from '../ExecutionResult';
import { BattlePhaseManager } from '../BattlePhaseManager';

interface MainPhaseAbilityParams {
    playerId: string;
    carduid: string;
    effectId?: string;
    targetCarduid?: string;
    targets?: Array<Partial<TargetReference> & { carduid: string }>;
    fromBurst?: boolean;
}

interface TargetResolutionResult {
    success: boolean;
    targets?: TargetReference[];
    error?: string;
}

export class MainPhaseAbilityManager {

    static executeMainPhaseAbility(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const params = this.extractAbilityParams(event);
        if (!params.success) {
            return {
                success: false,
                error: params.error
            };
        }

        return this.executeWithParams(gameEnv, params.params);
    }

    private static extractAbilityParams(
        event: PlayerActionEvent
    ): { success: true; params: MainPhaseAbilityParams } | { success: false; error: string } {
        const eventData: PlayerActionEventData = event.data || ({} as PlayerActionEventData);

        const abilityPlayerId =
            typeof eventData.playerId === 'string' ? eventData.playerId : event.playerId;
        const carduid = typeof (eventData as Record<string, unknown>).carduid === 'string'
            ? ((eventData as Record<string, unknown>).carduid as string)
            : undefined;

        if (!abilityPlayerId || !carduid) {
            return {
                success: false,
                error: 'useCommandCard action requires playerId and carduid'
            };
        }

        const effectId = typeof (eventData as Record<string, unknown>).effectId === 'string'
            ? ((eventData as Record<string, unknown>).effectId as string)
            : undefined;

        const targetCarduid = typeof (eventData as Record<string, unknown>).targetCarduid === 'string'
            ? ((eventData as Record<string, unknown>).targetCarduid as string)
            : undefined;

        const targets = Array.isArray((eventData as Record<string, unknown>).targets)
            ? ((eventData as Record<string, unknown>).targets as Array<Record<string, unknown>>)
                  .filter(target => typeof target?.carduid === 'string')
                  .map(target => ({
                      carduid: target.carduid as string,
                      zone: typeof target.zone === 'string' ? (target.zone as string) : undefined,
                      playerId: typeof target.playerId === 'string' ? (target.playerId as string) : undefined
                  }))
            : undefined;

        return {
            success: true,
            params: {
                playerId: abilityPlayerId,
                carduid,
                effectId,
                targetCarduid,
                targets,
                fromBurst: Boolean((eventData as Record<string, unknown>).fromBurst)
            }
        };
    }

    private static executeWithParams(gameEnv: GameEnvironment, params: MainPhaseAbilityParams): ExecutionResult {
        const { playerId, carduid, effectId, fromBurst } = params;

        if (!playerId || !carduid) {
            return {
                success: false,
                error: 'playerId and carduid are required to activate a command ability'
            };
        }

        if (!PlayerCardManager.validateCardInHand(gameEnv, playerId, carduid)) {
            return {
                success: false,
                error: 'Command abilities currently require the card to be in hand'
            };
        }

        const cardData = CardDatabaseManager.getCardDetailsFromCarduid(carduid);
        if (!cardData) {
            return {
                success: false,
                error: `Card data not found for ${carduid}`
            };
        }

        if (cardData.cardType !== 'command') {
            return {
                success: false,
                error: `Command ability only supported for command cards (found ${cardData.cardType || 'unknown'})`
            };
        }

        const effectToExecute = this.findMainPhaseEffect(cardData.effects?.rules || [], effectId);
        if (!effectToExecute) {
            return {
                success: false,
                error: effectId
                    ? `Effect ${effectId} not found on card ${cardData.id}`
                    : `No activated effect found on card ${cardData.id}`
            };
        }

        const normalizedEffect = ensureEffectDefaults({ ...effectToExecute });

        const timingWindows = this.getTimingWindows(normalizedEffect);
        const actionWindowOpen = BattlePhaseManager.isActionWindowOpen(gameEnv);
        const allowsActionStep = timingWindows.has('ACTION_STEP') || timingWindows.has('ACTION');
        const usingActionStep = actionWindowOpen && allowsActionStep;

        if (usingActionStep) {
            if (!BattlePhaseManager.playerInActiveBattle(gameEnv, playerId)) {
                return {
                    success: false,
                    error: 'Only players involved in the current battle may use ACTION_STEP abilities'
                };
            }
        } else {
            const turnCheck = GameActionValidator.ensureTurn(gameEnv, playerId, Boolean(fromBurst));
            if (!turnCheck.success) {
                return turnCheck;
            }

            if (!timingWindows.has('MAIN_PHASE') && !allowsActionStep) {
                console.warn(`⚠️ Ability ${normalizedEffect.effectId || normalizedEffect.action} lacks explicit MAIN_PHASE or ACTION_STEP timing; defaulting to MAIN_PHASE validation`);
            }

            if (gameEnv.phase !== GamePhase.MAIN_PHASE && !fromBurst) {
                return {
                    success: false,
                    error: `Ability can only be used during MAIN_PHASE (current phase: ${gameEnv.phase})`
                };
            }
        }

        const targetResolution = this.resolveTargets(gameEnv, playerId, normalizedEffect, params);
        if (!targetResolution.success || !targetResolution.targets || targetResolution.targets.length === 0) {
            return {
                success: false,
                error: targetResolution.error || 'No valid targets provided for ability'
            };
        }

        const energyResult = EnergyManager.validateAndPayEnergyForCard(gameEnv, playerId, cardData, {
            fromBurst: Boolean(fromBurst)
        });

        if (!energyResult.success) {
            return {
                success: false,
                error: energyResult.error || 'Energy payment failed for ability'
            };
        }

        const applyResult = EffectExecutor.executeActivatedEffect(
            gameEnv,
            normalizedEffect,
            targetResolution.targets,
            playerId,
            carduid
        );

        if (!applyResult.success) {
            this.revertEnergyPayment(gameEnv, playerId, energyResult);
            return {
                success: false,
                error: applyResult.error || 'Ability effect failed to resolve'
            };
        }

        const removed = PlayerCardManager.removeCardFromHand(gameEnv, playerId, carduid);
        if (!removed) {
            console.warn(`⚠️ Failed to remove command card ${carduid} from hand after ability resolution`);
        }

        PlayerCardManager.moveCardToTrash(gameEnv, playerId, carduid, cardData.id, cardData);

        return { success: true };
    }

    private static findMainPhaseEffect(effects: EffectDefinition[], effectId?: string): EffectDefinition | undefined {
        if (!Array.isArray(effects)) {
            return undefined;
        }

        if (effectId) {
            const directMatch = effects.find(effect => effect.effectId === effectId);
            if (directMatch) {
                return directMatch;
            }
        }

        return effects.find(effect => {
            if (effect.type !== 'activated') {
                return false;
            }

            if (effectId && effect.effectId !== effectId) {
                return false;
            }

            const timingValue = effect.timing;
            if (Array.isArray(timingValue)) {
                return timingValue.some(value => typeof value === 'string' && value.toUpperCase() === 'MAIN_PHASE');
            }

            if (typeof timingValue === 'object' && timingValue) {
                const duration = (timingValue as any).duration;
                if (typeof duration === 'string' && duration.toUpperCase() === 'MAIN_PHASE') {
                    return true;
                }
            }

            if (typeof effect.trigger === 'string') {
                return effect.trigger.toUpperCase() === 'MAIN_PHASE';
            }

            return false;
        });
    }

    private static getTimingWindows(effect: EffectDefinition): Set<string> {
        const windows = new Set<string>();
        const rawTiming = effect.timing as unknown;

        if (Array.isArray(rawTiming)) {
            rawTiming.forEach(value => {
                if (typeof value === 'string') {
                    windows.add(value.toUpperCase());
                }
            });
        } else if (typeof rawTiming === 'string') {
            windows.add(rawTiming.toUpperCase());
        }

        if (rawTiming && typeof rawTiming === 'object') {
            const timingRecord = rawTiming as Record<string, unknown>;
            const durationValue = timingRecord['duration'];
            if (typeof durationValue === 'string') {
                windows.add(durationValue.toUpperCase());
            }

            const actionTurnValue = timingRecord['actionTurn'];
            if (typeof actionTurnValue === 'string') {
                windows.add(actionTurnValue.toUpperCase());
            }
        }

        if (typeof effect.trigger === 'string') {
            windows.add(effect.trigger.toUpperCase());
        }

        return windows;
    }

    private static resolveTargets(
        gameEnv: GameEnvironment,
        playerId: string,
        effect: EffectDefinition,
        params: MainPhaseAbilityParams
    ): TargetResolutionResult {
        const references: TargetReference[] = [];

        if (Array.isArray(params.targets) && params.targets.length > 0) {
            for (const rawTarget of params.targets) {
                const reference = this.resolveSingleTarget(gameEnv, playerId, rawTarget.carduid, rawTarget.zone);
                if (!reference) {
                    return {
                        success: false,
                        error: `Unable to resolve target ${rawTarget.carduid}`
                    };
                }
                references.push(reference);
            }
            return { success: true, targets: references };
        }

        if (typeof params.targetCarduid === 'string' && params.targetCarduid.length > 0) {
            const reference = this.resolveSingleTarget(gameEnv, playerId, params.targetCarduid, undefined, effect);
            if (!reference) {
                return {
                    success: false,
                    error: `Unable to locate target unit ${params.targetCarduid}`
                };
            }
            references.push(reference);
            return { success: true, targets: references };
        }

        return {
            success: false,
            error: 'Main phase ability requires explicit targetCarduid or targets array'
        };
    }

    private static resolveSingleTarget(
        gameEnv: GameEnvironment,
        playerId: string,
        targetCarduid: string,
        providedZone?: string,
        effect?: EffectDefinition
    ): TargetReference | null {
        if (!targetCarduid) {
            return null;
        }

        if (providedZone) {
            return {
                carduid: targetCarduid,
                zone: providedZone,
                playerId
            };
        }

        const targetSearch = SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, targetCarduid);
        if (!targetSearch.found || !targetSearch.slotName || !targetSearch.unit) {
            return null;
        }

        if (effect?.target?.type === 'unit' && !targetSearch.unit) {
            return null;
        }

        return {
            carduid: targetCarduid,
            zone: targetSearch.slotName,
            playerId,
            cardData: targetSearch.unit?.cardData
        };
    }

    private static revertEnergyPayment(
        gameEnv: GameEnvironment,
        playerId: string,
        energyResult: EnergyCheckResult
    ): void {
        if (!energyResult.tapped || energyResult.tapped.length === 0) {
            return;
        }

        const player = gameEnv.players[playerId];
        if (!player?.zones?.energyArea) {
            return;
        }

        for (const tappedCard of energyResult.tapped) {
            tappedCard.isRested = false;
        }

        if (Array.isArray(energyResult.consumedExtras) && energyResult.consumedExtras.length > 0) {
            for (const extra of energyResult.consumedExtras) {
                extra.isRested = false;
                player.zones.energyArea.push(extra);
            }
        }
    }
}
