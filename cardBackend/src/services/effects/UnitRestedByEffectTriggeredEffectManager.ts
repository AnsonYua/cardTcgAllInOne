import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { EffectUsageTracker } from './EffectUsageTracker';
import { DeployTargetManager } from '../DeployTargetManager';

type SourceCard = any;

export interface UnitRestedByEffectContext {
    sourcePlayerId: string;
    targetPlayerId: string;
    targetCarduid: string;
}

export class UnitRestedByEffectTriggeredEffectManager {
    static process(
        gameEnv: GameEnvironment,
        context: UnitRestedByEffectContext
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        if (!context.targetPlayerId || !context.targetCarduid) {
            return { success: true };
        }

        const player = gameEnv.getPlayer(context.targetPlayerId) || gameEnv.players[context.targetPlayerId];
        if (!player?.zones) {
            return { success: true };
        }

        const sources: SourceCard[] = [];
        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit) sources.push(slot.unit);
            if (slot?.pilot) sources.push(slot.pilot);
        }
        const bases = Array.isArray((player.zones as any).base) ? (player.zones as any).base : [];
        for (const base of bases) {
            if (base?.carduid) sources.push(base);
        }

        for (const sourceCard of sources) {
            const effects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                trigger: 'UNIT_RESTED_BY_EFFECT',
                fallbackEffectId: 'unit_rested_by_effect',
                expectedTriggers: ['UNIT_RESTED_BY_EFFECT'],
                requireAction: true,
                defaultTargetScope: 'self'
            }

            );

            for (const effectRule of effects) {
                const normalized = ensureEffectDefaults({ ...effectRule }) as EffectDefinition;
                if (!ContinuousEffectManager.sourceConditionsMet(normalized, sourceCard, gameEnv, context.targetPlayerId)) {
                    continue;
                }

                if (!this.eventConditionsSatisfied(
                    normalized.conditions,
                    context,
                    context.targetPlayerId,
                    sourceCard.carduid
                )) {
                    continue;
                }

                const nonEventConditions = Array.isArray(normalized.conditions)
                    ? normalized.conditions.filter((c: any) => c?.type !== 'unitRestedByEffectEvent')
                    : undefined;
                const normalizedWithoutEvent = ensureEffectDefaults({
                    ...normalized,
                    conditions: nonEventConditions
                } as EffectDefinition);

                if (!ContinuousEffectManager.validateEffectConditions(
                    normalizedWithoutEvent,
                    gameEnv,
                    context.targetPlayerId,
                    sourceCard
                )) {
                    continue;
                }

                const restrictions = Array.isArray((normalized as any).restrictions)
                    ? ((normalized as any).restrictions as unknown[])
                    : [];
                const usageKey = EffectUsageTracker.getUsageKey(normalized, 'unit_rested_by_effect');
                if (restrictions.includes('once_per_turn')) {
                    if (!EffectUsageTracker.canUseOncePerTurn(sourceCard, usageKey, gameEnv.currentTurn)) {
                        continue;
                    }
                }

                const result = DeployTargetManager.processEffectWithTargetChoice(
                    gameEnv,
                    context.targetPlayerId,
                    sourceCard.carduid,
                    normalizedWithoutEvent
                );
                if (!result.success) {
                    return { success: false, error: result.error || `Failed to apply UNIT_RESTED_BY_EFFECT effect ${normalized.effectId}` };
                }

                if (restrictions.includes('once_per_turn')) {
                    EffectUsageTracker.markUsedThisTurn(sourceCard, usageKey, gameEnv.currentTurn);
                }

                if (result.requiresSelection) {
                    return { success: true, requiresSelection: true };
                }
            }
        }

        return { success: true };
    }

    private static eventConditionsSatisfied(
        conditions: unknown,
        context: UnitRestedByEffectContext,
        ownerPlayerId: string,
        sourceCarduid?: string
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        for (const raw of conditions) {
            if (!raw || typeof raw !== 'object') {
                continue;
            }
            const typed = raw as Record<string, unknown>;
            if (typed.type !== 'unitRestedByEffectEvent') {
                continue;
            }

            const sourceController = typeof typed.sourceController === 'string'
                ? typed.sourceController.toLowerCase()
                : 'any';
            const targetController = typeof typed.targetController === 'string'
                ? typed.targetController.toLowerCase()
                : 'self';
            const targetCarduidRaw = typeof typed.targetCarduid === 'string'
                ? typed.targetCarduid
                : undefined;

            if (sourceController === 'self' && context.sourcePlayerId !== ownerPlayerId) {
                return false;
            }
            if (sourceController === 'opponent' && context.sourcePlayerId === ownerPlayerId) {
                return false;
            }

            if (targetController === 'self' && context.targetPlayerId !== ownerPlayerId) {
                return false;
            }
            if (targetController === 'opponent' && context.targetPlayerId === ownerPlayerId) {
                return false;
            }

            const targetCarduid = typeof targetCarduidRaw === 'string'
                ? targetCarduidRaw.toLowerCase()
                : undefined;
            const expectedTargetCarduid =
                targetCarduid === 'self' || targetCarduid === 'source'
                    ? sourceCarduid
                    : targetCarduidRaw;

            if (expectedTargetCarduid && expectedTargetCarduid !== context.targetCarduid) {
                return false;
            }
        }

        return true;
    }
}
