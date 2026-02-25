// src/services/PlayCardPreparationManager.ts
// Centralized validation and setup for PLAY_CARD events

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { PlayCardEventData } from './EventQueue/interfaces/GameEvent';
import { GameValidator } from './GameValidator';
import { getCardIdFromUid } from '../utils/CardUtils';
import { CardDatabaseManager, EnergyZoneCard } from '../models/CardSystem';
import { EnergyManager, EnergyCheckResult } from './EnergyManager';
import { PlayerCardManager } from './PlayerCardManager';
import { EffectExecutor } from './effects/EffectExecutor';
import { HandContinuousModifier } from './effects/HandContinuousModifier';
import { GameNotificationManager } from './GameNotificationManager';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { UnitRestrictionUtils } from './restrictions/UnitRestrictionUtils';
import { RestrictionNotificationEmitter } from './restrictions/RestrictionNotificationEmitter';
import { validateUnitReplaceSlotForPlay } from './playCard/UnitReplaceSlotCoordinator';
import { SLOT_ZONES } from '../config/gameConstants';
import { SlotCardStateUtils } from './conditions/SlotCardStateUtils';
import { ensureEffectDefaults, validateComparisonFilter } from '../utils/EffectNormalizationUtils';
import { EffectTimingWindowUtils } from '../utils/EffectTimingWindowUtils';
import { hasNameIncludes } from '../utils/CardNameMatcher';
import { TargetResolver } from './targets/TargetResolver';
import { TargetSelectionPipeline } from './targets/TargetSelectionPipeline';
import { TargetScopeResolverRegistry } from './targets/TargetScopeResolverRegistry';
import { EffectDefinition, TargetReference } from './EventQueue/interfaces/GameEvent';

export interface PlayCardPreparationFailure {
    success: false;
    error: string;
}

export interface PlayCardPreparationSuccess {
    success: true;
    player: Player;
    cardId: string;
    cardData: any;
    tappedEnergy: EnergyZoneCard[];
    fromBurst: boolean;
    finalizeAfterPlacement?: () => { success: boolean; error?: string };
    rollback: () => void;
}

export type PlayCardPreparationResult = PlayCardPreparationSuccess | PlayCardPreparationFailure;

export class PlayCardPreparationManager {

    static prepare(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        fromBurst: boolean
    ): PlayCardPreparationResult {

        const isActionStepCommand =
            eventData.playAs === 'command' && gameEnv.currentBattle?.status === 'ACTION_STEP';

        if (isActionStepCommand) {
            const { attackingPlayerId, defendingPlayerId } = gameEnv.currentBattle!;
            if (playerId !== attackingPlayerId && playerId !== defendingPlayerId) {
                return {
                    success: false,
                    error: 'Command cards during ACTION_STEP can only be played by battle participants'
                };
            }
        }

        if (!fromBurst && !isActionStepCommand) {
            const turnValidation = GameValidator.validatePlayerTurn(gameEnv, playerId);
            if (!turnValidation.isValid) {
                return {
                    success: false,
                    error: turnValidation.error || 'It is not your turn'
                };
            }
        }

        const playerValidation = GameValidator.validatePlayerZones(gameEnv, playerId);
        if (!playerValidation.isValid || !playerValidation.player) {
            return {
                success: false,
                error: playerValidation.error || 'Player zones invalid'
            };
        }
        const player = playerValidation.player;

        const cardId = getCardIdFromUid(eventData.carduid);
        const cardData = CardDatabaseManager.getCardDetails(cardId);
        if (!cardData) {
            return {
                success: false,
                error: `Card data not found for ${cardId}`
            };
        }

        if (eventData.playAs === 'pilot') {
            const targetUid = typeof eventData.targetUnit === 'string' ? eventData.targetUnit : '';
            const slotResult = targetUid
                ? SlotZoneUtils.findSlotByCarduid(player.zones, targetUid)
                : { slotName: null, unit: null, pilot: null };
            if (!slotResult.unit) {
                return {
                    success: false,
                    error: `Target unit ${eventData.targetUnit || ''} not found for pilot play`
                };
            }
            if (slotResult.unit.carduid !== targetUid) {
                return {
                    success: false,
                    error: `targetUnit must reference a unit carduid (received ${targetUid})`
                };
            }
            if (slotResult.pilot) {
                return {
                    success: false,
                    error: 'Target unit already has a pilot'
                };
            }

            if (UnitRestrictionUtils.cannotBePairedWithPilot(slotResult.unit as any)) {
                RestrictionNotificationEmitter.emitPairingBlocked(gameEnv, {
                    playerId,
                    pilotCarduid: eventData.carduid,
                    targetUnitCarduid: targetUid,
                    reason: 'restrict_pairing'
                });
                return {
                    success: false,
                    error: 'Target unit cannot be paired with a pilot'
                };
            }
        }

        if (eventData.playAs === 'unit') {
            const validation = validateUnitReplaceSlotForPlay(player.zones, eventData.replaceSlot);
            if (!validation.success) {
                return {
                    success: false,
                    error: validation.error
                };
            }
        }

        let cardDataForEnergy = HandContinuousModifier.applyModifiersForHandCardPlay(
            gameEnv,
            playerId,
            cardData
        );

        const replacementChoice = this.resolvePlayCostReplacement(
            gameEnv,
            playerId,
            eventData,
            cardData,
            cardDataForEnergy,
            fromBurst
        );
        if (replacementChoice.applyReplacement) {
            cardDataForEnergy = {
                ...cardDataForEnergy,
                level: replacementChoice.replacementLevel,
                cost: replacementChoice.replacementCost
            };
        }

        if (cardDataForEnergy && (cardDataForEnergy.cost !== cardData.cost || cardDataForEnergy.level !== cardData.level)) {
            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent(
                'HAND_CARD_MODIFIERS_APPLIED',
                {
                    playerId,
                    carduid: eventData.carduid,
                    cardId,
                    baseCost: cardData.cost,
                    effectiveCost: cardDataForEnergy.cost,
                    baseLevel: cardData.level,
                    effectiveLevel: cardDataForEnergy.level,
                    timestamp: Date.now()
                },
                'normal'
            );
        }

        const mandatoryTargetError = this.validateMandatoryFirstSequenceStepTargets(
            gameEnv,
            playerId,
            eventData,
            cardDataForEnergy
        );
        if (mandatoryTargetError) {
            return {
                success: false,
                error: mandatoryTargetError
            };
        }

        const energyResult: EnergyCheckResult = EnergyManager.validateAndPayEnergyForCard(
            gameEnv,
            playerId,
            cardDataForEnergy,
            { fromBurst }
        );

        if (!energyResult.success) {
            return {
                success: false,
                error: energyResult.error || 'Energy payment failed'
            };
        }

        if (!fromBurst) {
            const handValidation = GameValidator.validateCardInHand(gameEnv, playerId, eventData.carduid);
            if (!handValidation.isValid) {
                this.rollbackEnergy(gameEnv, playerId, energyResult.tapped, energyResult.consumedExtras);
                return {
                    success: false,
                    error: handValidation.error || 'Card not in hand'
                };
            }

            if (!PlayerCardManager.removeCardFromHand(gameEnv, playerId, eventData.carduid)) {
                this.rollbackEnergy(gameEnv, playerId, energyResult.tapped, energyResult.consumedExtras);
                return {
                    success: false,
                    error: `Failed to remove card ${eventData.carduid} from hand`
                };
            }
        }

        const rollback = () => {
            this.rollbackEnergy(gameEnv, playerId, energyResult.tapped, energyResult.consumedExtras);
            if (!fromBurst) {
                EffectExecutor.addCardToPlayerHand(gameEnv, playerId, eventData.carduid, cardData, 
                {
                    notify: false,
                    reason: 'rollback'
                });
            }
        };

        return {
            success: true,
            player,
            cardId,
            cardData,
            tappedEnergy: energyResult.tapped,
            fromBurst,
            ...(replacementChoice.finalizeAfterPlacement ? { finalizeAfterPlacement: replacementChoice.finalizeAfterPlacement } : {}),
            rollback
        };
    }

    private static resolvePlayCostReplacement(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        cardData: any,
        effectiveCardData: any,
        fromBurst: boolean
    ): {
        applyReplacement: boolean;
        replacementCost: number;
        replacementLevel: number;
        finalizeAfterPlacement?: () => { success: boolean; error?: string };
    } {
        if (fromBurst) {
            return {
                applyReplacement: false,
                replacementCost: effectiveCardData?.cost || cardData?.cost || 0,
                replacementLevel: effectiveCardData?.level || cardData?.level || 0
            };
        }

        const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        const baseReplacementCost = typeof effectiveCardData?.cost === 'number' ? effectiveCardData.cost : Number(effectiveCardData?.cost || 0);
        const baseReplacementLevel = typeof effectiveCardData?.level === 'number' ? effectiveCardData.level : Number(effectiveCardData?.level || 0);

        for (const rule of rules) {
            if (!rule || typeof rule !== 'object' || rule.action !== 'replace_cost') {
                continue;
            }

            const replacementResult = this.resolveReplacementRuleResult(
                gameEnv,
                playerId,
                eventData,
                rule,
                baseReplacementCost,
                baseReplacementLevel
            );
            if (replacementResult) {
                return replacementResult;
            }
        }

        return {
            applyReplacement: false,
            replacementCost: baseReplacementCost,
            replacementLevel: baseReplacementLevel
        };
    }

    private static resolveReplacementRuleResult(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        replacementRule: any,
        currentCost: number,
        currentLevel: number
    ): {
        applyReplacement: boolean;
        replacementCost: number;
        replacementLevel: number;
        finalizeAfterPlacement?: () => { success: boolean; error?: string };
    } | null {
        if (this.isDestroyLinkedUnitCostReplacementRule(replacementRule)) {
            return this.resolveDestroyLinkedUnitCostReplacement(
                gameEnv,
                playerId,
                eventData,
                replacementRule,
                currentCost,
                currentLevel
            );
        }

        if (this.isPairTargetUnitCostReplacementRule(replacementRule)) {
            return this.resolvePairTargetUnitCostReplacement(
                gameEnv,
                playerId,
                eventData,
                replacementRule,
                currentCost,
                currentLevel
            );
        }

        return null;
    }

    private static resolveDestroyLinkedUnitCostReplacement(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        replacementRule: any,
        currentCost: number,
        currentLevel: number
    ): {
        applyReplacement: boolean;
        replacementCost: number;
        replacementLevel: number;
        finalizeAfterPlacement?: () => { success: boolean; error?: string };
    } | null {
        const requestedByEvent = (eventData as any).useCostReplacement === true;
        const availableEnergy = EnergyManager.getAvailableEnergy(gameEnv, playerId);
        const shouldAttempt = requestedByEvent || availableEnergy < currentCost;
        if (!shouldAttempt) {
            return null;
        }

        const eligible = this.findEligibleLinkedUnitsForCostReplacement(gameEnv, playerId, replacementRule);
        if (eligible.length === 0) {
            return null;
        }

        const requestedTarget = typeof (eventData as any).costReplacementTargetCarduid === 'string'
            ? String((eventData as any).costReplacementTargetCarduid)
            : '';
        const selected = eligible.find(entry => entry.unit.carduid === requestedTarget) || eligible[0];

        const replacement = replacementRule?.parameters?.replace?.to || {};
        const replacementCost = typeof replacement.cost === 'number' ? replacement.cost : 0;
        const replacementLevel = typeof replacement.level === 'number' ? replacement.level : 0;

        return {
            applyReplacement: true,
            replacementCost,
            replacementLevel,
            finalizeAfterPlacement: () => {
                const player = gameEnv.getPlayer(playerId);
                if (!player?.zones) {
                    return { success: false, error: `Player ${playerId} zones not found for cost replacement` };
                }

                const slotLookup = SlotZoneUtils.getSlotZone(player.zones, selected.slotName);
                const currentUnit = slotLookup.isValid ? slotLookup.slot?.unit : null;
                if (!currentUnit || currentUnit.carduid !== selected.unit.carduid) {
                    return { success: false, error: `Cost replacement unit ${selected.unit.carduid} no longer available` };
                }

                const destroyed = PlayerCardManager.destroyUnitInSlot(
                    gameEnv,
                    playerId,
                    selected.slotName,
                    currentUnit as any
                );
                if (!destroyed) {
                    return { success: false, error: `Failed to destroy cost replacement unit ${selected.unit.carduid}` };
                }

                return { success: true };
            }
        };
    }

    private static isDestroyLinkedUnitCostReplacementRule(rule: any): boolean {
        if (!rule || typeof rule !== 'object') {
            return false;
        }
        if (rule.action !== 'replace_cost') {
            return false;
        }

        const replace = rule?.parameters?.replace;
        if (!replace || typeof replace !== 'object') {
            return false;
        }

        const from = replace.from;
        const to = replace.to;
        if (!from || typeof from !== 'object' || !to || typeof to !== 'object') {
            return false;
        }

        return from.type === 'destroy' && from.target === 'friendly_linked_unit';
    }

    private static isPairTargetUnitCostReplacementRule(rule: any): boolean {
        if (!rule || typeof rule !== 'object') {
            return false;
        }
        if (rule.action !== 'replace_cost') {
            return false;
        }

        const replace = rule?.parameters?.replace;
        if (!replace || typeof replace !== 'object') {
            return false;
        }

        const from = replace.from;
        const to = replace.to;
        if (!from || typeof from !== 'object' || !to || typeof to !== 'object') {
            return false;
        }

        return from.type === 'pair_target_unit';
    }

    private static resolvePairTargetUnitCostReplacement(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        replacementRule: any,
        currentCost: number,
        currentLevel: number
    ): {
        applyReplacement: boolean;
        replacementCost: number;
        replacementLevel: number;
    } | null {
        if (eventData.playAs !== 'pilot') {
            return null;
        }

        const targetUnitUid = typeof eventData.targetUnit === 'string' ? eventData.targetUnit : '';
        if (!targetUnitUid) {
            return null;
        }

        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) {
            return null;
        }

        const slotResult = SlotZoneUtils.findSlotByCarduid(player.zones, targetUnitUid);
        const targetUnit = slotResult?.unit;
        if (!targetUnit || targetUnit.carduid !== targetUnitUid) {
            return null;
        }

        const from = replacementRule?.parameters?.replace?.from || {};
        const filters = from.filters && typeof from.filters === 'object'
            ? (from.filters as Record<string, unknown>)
            : {};
        const requiredNameIncludes = typeof filters.nameIncludes === 'string'
            ? String(filters.nameIncludes).toLowerCase()
            : '';
        if (!requiredNameIncludes) {
            return null;
        }

        if (!hasNameIncludes(targetUnit, requiredNameIncludes)) {
            return null;
        }

        const replacement = replacementRule?.parameters?.replace?.to || {};
        const replacementCost = typeof replacement.cost === 'number' ? replacement.cost : currentCost;
        const replacementLevel = typeof replacement.level === 'number' ? replacement.level : currentLevel;

        return {
            applyReplacement: true,
            replacementCost,
            replacementLevel
        };
    }

    private static findEligibleLinkedUnitsForCostReplacement(
        gameEnv: GameEnvironment,
        playerId: string,
        replacementRule: any
    ): Array<{ slotName: string; unit: any }> {
        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) {
            return [];
        }

        const from = replacementRule?.parameters?.replace?.from || {};
        const filters = from.filters && typeof from.filters === 'object'
            ? (from.filters as Record<string, unknown>)
            : {};
        const requiredNameIncludes = typeof filters.nameIncludes === 'string'
            ? String(filters.nameIncludes).toLowerCase()
            : '';
        const requiredLevel = filters.level;
        const requiredCardType = typeof filters.cardType === 'string'
            ? String(filters.cardType).toLowerCase()
            : '';

        const eligible: Array<{ slotName: string; unit: any }> = [];

        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            const unit = slotResult.isValid ? slotResult.slot?.unit : null;
            if (!unit?.carduid || !unit?.cardData) {
                continue;
            }

            if (!SlotCardStateUtils.isCardLinked(gameEnv, unit.carduid)) {
                continue;
            }

            const cardType = typeof unit.cardData.cardType === 'string'
                ? String(unit.cardData.cardType).toLowerCase()
                : '';
            if (requiredCardType && cardType !== requiredCardType) {
                continue;
            }

            if (requiredNameIncludes && !hasNameIncludes(unit, requiredNameIncludes)) {
                continue;
            }

            const level = typeof unit.cardData.level === 'number' ? unit.cardData.level : 0;
            if (!this.matchesNumericFilter(level, requiredLevel)) {
                continue;
            }

            eligible.push({ slotName, unit });
        }

        return eligible;
    }

    private static matchesNumericFilter(value: number, filter: unknown): boolean {
        if (typeof filter === 'number') {
            return value === filter;
        }
        if (typeof filter !== 'string' || !filter) {
            return true;
        }

        const normalized = filter.trim();
        if (/^\d+$/.test(normalized)) {
            return value === Number(normalized);
        }
        if (/^=\d+$/.test(normalized)) {
            return value === Number(normalized.slice(1));
        }

        return validateComparisonFilter(value, normalized);
    }

    private static rollbackEnergy(
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

    private static validateMandatoryFirstSequenceStepTargets(
        gameEnv: GameEnvironment,
        playerId: string,
        eventData: PlayCardEventData,
        cardData: any
    ): string | null {
        const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        const activePlayRules = rules.filter((rule: any) =>
            rule?.type === 'play' &&
            rule?.action === 'sequence' &&
            EffectTimingWindowUtils.allowsPhase(rule, gameEnv.phase)
        );

        for (const rule of activePlayRules) {
            const steps = Array.isArray(rule?.parameters?.steps) ? rule.parameters.steps : [];
            if (steps.length === 0) {
                continue;
            }

            const firstStep = steps[0];
            if (!this.isMandatoryTargetStep(firstStep, rule)) {
                continue;
            }

            const availableTargets = this.resolveAvailableTargetsForSequenceStep(
                gameEnv,
                playerId,
                eventData.carduid,
                firstStep,
                rule
            );

            if (availableTargets.length === 0) {
                return `No eligible targets for mandatory effect step (card ${cardData?.id || eventData.carduid}, effect ${rule?.effectId || 'play_effect'})`;
            }
        }

        return null;
    }

    private static isMandatoryTargetStep(step: any, parentRule: any): boolean {
        if (!step || typeof step !== 'object' || !step.target || typeof step.target !== 'object') {
            return false;
        }

        if (step.optional === true || parentRule?.optional === true) {
            return false;
        }

        if (step.allowEmptySelection === true || step.target.allowEmptySelection === true) {
            return false;
        }

        if (step.target.required === false) {
            return false;
        }

        const countConfig = step.target.count;
        if (countConfig && typeof countConfig === 'object' && typeof countConfig.min === 'number' && countConfig.min <= 0) {
            return false;
        }

        return true;
    }

    private static resolveAvailableTargetsForSequenceStep(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        step: any,
        parentRule: any
    ): TargetReference[] {
        const stepEffect = ensureEffectDefaults({
            effectId: step.effectId || `${parentRule?.effectId || 'play_effect'}_step1_precheck`,
            type: 'internal',
            trigger: 'SEQUENCE_STEP',
            optional: false,
            action: step.action,
            target: step.target
        } as EffectDefinition);

        const scoped = TargetScopeResolverRegistry.resolve(gameEnv, sourceCarduid, stepEffect);
        let availableTargets = Array.isArray(scoped)
            ? scoped
            : TargetResolver.generateAvailableTargets(
                gameEnv,
                playerId,
                TargetResolver.resolveTargetConfig(stepEffect),
                sourceCarduid
            );

        availableTargets = TargetSelectionPipeline.apply(
            gameEnv,
            availableTargets,
            stepEffect,
            sourceCarduid
        );

        return availableTargets;
    }
}
