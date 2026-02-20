// src/services/effects/MainPhaseAbilityManager.ts
// Handles MAIN_PHASE activated abilities such as command card effects

import { GameEnvironment } from '../../models/GameEnvironment';
import { GamePhase } from '../../models/GameEnums';
import { CardDatabaseManager } from '../../models/CardSystem';
import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { GameActionValidator } from '../GameActionValidator';
import { PlayerCardManager } from '../PlayerCardManager';
import { EnergyManager, EnergyCheckResult } from '../EnergyManager';
import type { EffectDefinition, PlayerActionEvent, PlayerActionEventData, TargetFilters, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { isPlayOrActivatedEffect } from '../../utils/EffectTypeRouter';
import { EffectExecutor } from './EffectExecutor';
import { ExecutionResult } from '../ExecutionResult';
import { BattlePhaseManager } from '../BattlePhaseManager';
import { EffectTargetResolver, ResolvedTargetContext } from './EffectTargetResolver';
import { TargetStateFilterUtils } from '../targets/TargetStateFilterUtils';

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

        if (!fromBurst && !PlayerCardManager.validateCardInHand(gameEnv, playerId, carduid)) {
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
        const action = EffectExecutor.getEffectAction(normalizedEffect);
        const targetsRequired = !EffectExecutor.actionSupportsNoTargets(action);
        if (!targetResolution.success || !targetResolution.targets || (targetsRequired && targetResolution.targets.length === 0)) {
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
            targetResolution.targets || [],
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

        if (!fromBurst) {
            const removed = PlayerCardManager.removeCardFromHand(gameEnv, playerId, carduid);
            if (!removed) {
                console.warn(`⚠️ Failed to remove command card ${carduid} from hand after ability resolution`);
            }

            PlayerCardManager.moveCardToTrash(gameEnv, playerId, carduid, cardData.id, cardData);
        }

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
            if (!isPlayOrActivatedEffect(effect)) {
                return false;
            }

            if (effectId && effect.effectId !== effectId) {
                return false;
            }

            const windows = this.getTimingWindows(effect);
            if (windows.size === 0 && typeof effect.trigger === 'string') {
                return effect.trigger.toUpperCase() === 'MAIN_PHASE';
            }

            return windows.has('MAIN_PHASE');
        });
    }

    private static getTimingWindows(effect: EffectDefinition): Set<string> {
        const windows = new Set<string>();
        const timingRecord = effect.timing as Record<string, unknown> | undefined;

        if (timingRecord && typeof timingRecord === 'object') {
            const windowValues = timingRecord['windows'];
            if (Array.isArray(windowValues)) {
                windowValues.forEach(value => {
                    if (typeof value === 'string') {
                        windows.add(value.toUpperCase());
                    }
                });
            }

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
        const resolvedContexts: ResolvedTargetContext[] = [];
        const action = EffectExecutor.getEffectAction(effect);
        if (EffectExecutor.actionSupportsNoTargets(action)) {
            return { success: true, targets: [] };
        }

        if (Array.isArray(params.targets) && params.targets.length > 0) {
            for (const rawTarget of params.targets) {
                const resolution = EffectTargetResolver.resolveSingleTarget(
                    gameEnv,
                    rawTarget.carduid,
                    rawTarget.zone,
                    rawTarget.playerId
                );

                if (!resolution.success) {
                    return {
                        success: false,
                        error: resolution.error || `Unable to resolve target ${rawTarget.carduid}`
                    };
                }

                resolvedContexts.push({
                    ...resolution.context,
                    requestedPlayerId: rawTarget.playerId
                });
            }
        } else if (typeof params.targetCarduid === 'string' && params.targetCarduid.length > 0) {
            const resolution = EffectTargetResolver.resolveSingleTarget(
                gameEnv,
                params.targetCarduid,
                undefined
            );

            if (!resolution.success) {
                return {
                    success: false,
                    error: resolution.error || `Unable to locate target ${params.targetCarduid}`
                };
            }

            resolvedContexts.push(resolution.context);
        } else {
            return {
                success: false,
                error: 'Main phase ability requires explicit targetCarduid or targets array'
            };
        }

        const references: TargetReference[] = [];

        for (const context of resolvedContexts) {
            const validation = this.validateResolvedTarget(gameEnv, playerId, effect, context);
            if (!validation.success) {
                return {
                    success: false,
                    error: validation.error || 'Selected target does not meet effect requirements'
                };
            }

            references.push(context.reference);
        }

        return { success: true, targets: references };
    }

    private static validateResolvedTarget(
        gameEnv: GameEnvironment,
        actingPlayerId: string,
        effect: EffectDefinition,
        context: ResolvedTargetContext
    ): { success: boolean; error?: string } {
        const targetConfig = effect.target;
        if (!targetConfig) {
            return { success: true };
        }

        const card = (context.searchResult.card || context.searchResult.unit || context.searchResult.pilot) as
            | UnitZoneCard
            | PilotZoneCard
            | undefined;

        if (!card) {
            return {
                success: false,
                error: `Unable to resolve card data for target ${context.reference.carduid}`
            };
        }

        const actualController = context.reference.playerId;
        const opponentId = gameEnv.getOpponentId(actingPlayerId);

        if (targetConfig.scope) {
            const normalizedScope = targetConfig.scope.toString().toUpperCase();
            if (normalizedScope.startsWith('OPPONENT')) {
                if (!opponentId || actualController !== opponentId) {
                    return {
                        success: false,
                        error: `Target ${context.reference.carduid} must be controlled by the opponent`
                    };
                }
            } else if (normalizedScope.startsWith('SELF')) {
                if (actualController !== actingPlayerId) {
                    return {
                        success: false,
                        error: `Target ${context.reference.carduid} must be controlled by the acting player`
                    };
                }
            }
        }

        const resolvedType = (context.searchResult.type || (context.searchResult.unit ? 'unit' : context.searchResult.pilot ? 'pilot' : '')).toLowerCase();

        if (targetConfig.type) {
            const expectedType = targetConfig.type.toString().toLowerCase();
            if (expectedType.includes('unit') && resolvedType !== 'unit') {
                return {
                    success: false,
                    error: `Effect requires a unit target`
                };
            }
            if (expectedType.includes('pilot') && resolvedType !== 'pilot') {
                return {
                    success: false,
                    error: `Effect requires a pilot target`
                };
            }
        }

        const filters = (targetConfig.filters || {}) as TargetFilters;

        if (filters.controller) {
            const normalizedController = filters.controller.toString().toUpperCase();
            if (normalizedController === 'SELF' && actualController !== actingPlayerId) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} does not satisfy controller:self`
                };
            }
            if (normalizedController === 'OPPONENT' && (!opponentId || actualController !== opponentId)) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} does not satisfy controller:opponent`
                };
            }
        }

        if (Array.isArray(filters.zone) && filters.zone.length > 0) {
            const allowedZones = filters.zone.map(zone => zone.toString());
            if (!allowedZones.includes(context.reference.zone)) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} is not located in an allowed zone`
                };
            }
        }

        if (filters.status) {
            const expectedStatus = filters.status.toString().toLowerCase();
            const actualStatus = card.isRested ? 'rested' : 'active';
            if (expectedStatus !== actualStatus) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} must be ${expectedStatus}`
                };
            }
        }

        if (filters.hp && resolvedType === 'unit') {
            const currentHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, card.carduid).totalHP;
            if (!validateComparisonFilter(currentHp, filters.hp)) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} does not meet HP requirement (${filters.hp})`
                };
            }
        }

        if (typeof filters.damaged === 'boolean') {
            if (resolvedType !== 'unit') {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} must be a unit to satisfy damaged filter`
                };
            }

            const isDamaged = TargetStateFilterUtils.isDamaged(gameEnv, card);
            if (filters.damaged !== isDamaged) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} does not satisfy damaged:${filters.damaged}`
                };
            }
        }

        if (Array.isArray(filters.traits) && filters.traits.length > 0) {
            const cardTraits = Array.isArray(card.cardData?.traits) ? (card.cardData?.traits as string[]) : [];
            const matchesTrait = filters.traits.some(requiredTrait => cardTraits.includes(requiredTrait));
            if (!matchesTrait) {
                return {
                    success: false,
                    error: `Target ${context.reference.carduid} lacks required traits`
                };
            }
        }

        return { success: true };
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
