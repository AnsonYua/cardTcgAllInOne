import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import type { TargetReference, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { TargetResolver } from '../targets/TargetResolver';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { GameNotificationManager } from '../GameNotificationManager';
import { EffectConditionEvaluator } from '../conditions/EffectConditionEvaluator';

type RequireAttackTargetParameters = {
    candidateTarget?: Record<string, unknown>;
    chooser?: string;
};

type AttackTargetRequirement = {
    sourceCarduid: string;
    chooser: 'ATTACKER' | 'DEFENDER';
    candidates: TargetReference[];
};

export class ForcedAttackTargetManager {
    static enforceIfNeeded(
        gameEnv: GameEnvironment,
        attackEvent: PlayerActionEvent,
        defendingPlayerId: string
    ): { success: boolean; error?: string; errorCode?: string; requiresSelection?: boolean } {
        const eventData = attackEvent.data || {};
        if (eventData.skipForcedTargetCheck === true) {
            return { success: true };
        }

        const attackerPlayerId = attackEvent.playerId;
        const attackerCarduid = typeof eventData.attackerCarduid === 'string' ? eventData.attackerCarduid : '';
        if (!attackerPlayerId || !attackerCarduid) {
            return { success: true };
        }

        const requirements = this.collectRequirements(gameEnv, defendingPlayerId);
        if (requirements.length === 0) {
            return { success: true };
        }

        const merged = this.mergeRequirements(requirements);
        if (merged.candidates.length === 0) {
            return { success: true };
        }

        const currentTargetCarduid = typeof (eventData as any).targetUnitUid === 'string'
            ? String((eventData as any).targetUnitUid)
            : (typeof (eventData as any).targetCarduid === 'string' ? String((eventData as any).targetCarduid) : '');
        const currentTargetPlayerId = typeof eventData.targetPlayerId === 'string' ? eventData.targetPlayerId : defendingPlayerId;
        const currentActionType = typeof eventData.actionType === 'string' ? eventData.actionType : '';

        const alreadyTargetsCandidate =
            currentActionType === 'attackUnit' &&
            merged.candidates.some(candidate =>
                candidate.carduid === currentTargetCarduid && candidate.playerId === currentTargetPlayerId
            );

        if (alreadyTargetsCandidate) {
            return { success: true };
        }

        if (merged.candidates.length === 1) {
            const forced = merged.candidates[0];
            const forcedName = (forced.cardData as any)?.name || forced.carduid;
            return {
                success: false,
                errorCode: 'FORCED_ATTACK_TARGET_REQUIRED',
                error: `Attack target is forced to ${forcedName} (${forced.zone}). Use actionType=attackUnit with targetUnitUid=${forced.carduid}.`
            };
        }

        const chooserPlayerId = merged.chooser === 'DEFENDER' ? defendingPlayerId : attackerPlayerId;

        const choiceEffect: EffectDefinition = ensureEffectDefaults({
            effectId: 'force_attack_target_choice',
            type: 'internal',
            trigger: 'ATTACK_TARGET_REQUIREMENT',
            action: 'force_attack_target',
            target: {
                type: 'unit',
                scope: 'self',
                count: 1,
                selection: {
                    type: 'player_choice'
                }
            }
        } as any);

        const choiceEvent = ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
            playerId: chooserPlayerId,
            sourceCarduid: merged.sourceCarduid,
            effect: choiceEffect,
            availableTargets: merged.candidates
        });

        choiceEvent.data.context = {
            kind: 'FORCED_ATTACK_TARGET',
            attackerPlayerId,
            attackerCarduid,
            originalActionType: currentActionType,
            originalTargetPlayerId: currentTargetPlayerId,
            originalTargetCarduid: currentTargetCarduid,
            defendingPlayerId
        };

        return { success: true, requiresSelection: true };
    }

    private static mergeRequirements(requirements: AttackTargetRequirement[]): AttackTargetRequirement {
        if (requirements.length === 1) {
            return requirements[0];
        }

        const allCandidates: TargetReference[] = [];
        for (const req of requirements) {
            allCandidates.push(...req.candidates);
        }

        const seen = new Set<string>();
        const unique = allCandidates.filter(candidate => {
            const key = `${candidate.playerId}:${candidate.zone}:${candidate.carduid}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });

        const chooser = requirements.some(req => req.chooser === 'ATTACKER') ? 'ATTACKER' : 'DEFENDER';
        return {
            sourceCarduid: requirements[0].sourceCarduid,
            chooser,
            candidates: unique
        };
    }

    private static collectRequirements(gameEnv: GameEnvironment, defendingPlayerId: string): AttackTargetRequirement[] {
        const player = gameEnv.getPlayer(defendingPlayerId);
        if (!player?.zones) {
            return [];
        }

        const requirements: AttackTargetRequirement[] = [];

        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot?.unit?.carduid) {
                continue;
            }

            const unit = slotResult.slot.unit;
            const effects = Array.isArray(unit.cardData?.effects?.rules) ? unit.cardData.effects.rules : [];
            if (effects.length === 0) {
                continue;
            }

            for (const rule of effects) {
                const normalized = ensureEffectDefaults({ ...(rule as any) });

                const extractedRequirements = this.extractRequireAttackTargetEffects(
                    normalized,
                    gameEnv,
                    defendingPlayerId,
                    unit as any
                );
                if (extractedRequirements.length === 0) {
                    continue;
                }

                if (!ContinuousEffectManager.sourceConditionsMet(normalized as any, unit as any, gameEnv, defendingPlayerId)) {
                    continue;
                }

                for (const extracted of extractedRequirements) {
                    const candidates = this.resolveCandidates(gameEnv, defendingPlayerId, unit.carduid, extracted.parameters);
                    if (candidates.length === 0) {
                        continue;
                    }

                    requirements.push({
                        sourceCarduid: unit.carduid,
                        chooser: extracted.chooser,
                        candidates
                    });
                }
            }
        }

        return requirements;
    }

    private static extractRequireAttackTargetEffects(
        effect: EffectDefinition,
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        sourceUnit: Record<string, unknown>
    ): Array<{ chooser: 'ATTACKER' | 'DEFENDER'; parameters: RequireAttackTargetParameters }> {
        const extracted: Array<{ chooser: 'ATTACKER' | 'DEFENDER'; parameters: RequireAttackTargetParameters }> = [];
        const action = typeof effect.action === 'string' ? effect.action : '';
        if (action === 'require_attack_target_if_available') {
            const chooserRaw = typeof effect.parameters?.chooser === 'string'
                ? String(effect.parameters.chooser).toUpperCase()
                : 'DEFENDER';
            extracted.push({
                chooser: chooserRaw === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
                parameters: effect.parameters as RequireAttackTargetParameters
            });
            return extracted;
        }

        if (action !== 'sequence') {
            return extracted;
        }

        const steps = Array.isArray((effect.parameters as any)?.steps) ? ((effect.parameters as any).steps as any[]) : [];
        this.collectFromSequenceSteps(extracted, steps, gameEnv, defendingPlayerId, sourceUnit);
        return extracted;
    }

    private static collectFromSequenceSteps(
        output: Array<{ chooser: 'ATTACKER' | 'DEFENDER'; parameters: RequireAttackTargetParameters }>,
        steps: any[],
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        sourceUnit: Record<string, unknown>
    ): void {
        for (const step of steps) {
            if (!step || typeof step.action !== 'string') {
                continue;
            }

            if (step.action === 'require_attack_target_if_available') {
                const chooserRaw = typeof step.parameters?.chooser === 'string'
                    ? String(step.parameters.chooser).toUpperCase()
                    : 'DEFENDER';
                output.push({
                    chooser: chooserRaw === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
                    parameters: step.parameters as RequireAttackTargetParameters
                });
                continue;
            }

            if (step.action === 'conditional') {
                const params = (step.parameters && typeof step.parameters === 'object')
                    ? (step.parameters as Record<string, unknown>)
                    : {};
                const ifConditions = Array.isArray(params.if) ? (params.if as Array<Record<string, unknown>>) : [];
                const conditionMet = this.evaluateConditionalStepSnapshot(
                    gameEnv,
                    defendingPlayerId,
                    sourceUnit,
                    ifConditions
                );
                const branchSteps = conditionMet
                    ? (Array.isArray(params.then) ? (params.then as any[]) : [])
                    : (Array.isArray(params.else) ? (params.else as any[]) : []);
                if (branchSteps.length > 0) {
                    this.collectFromSequenceSteps(output, branchSteps, gameEnv, defendingPlayerId, sourceUnit);
                }
                continue;
            }

            if (step.action === 'sequence') {
                const nestedSteps = Array.isArray(step.parameters?.steps) ? (step.parameters.steps as any[]) : [];
                if (nestedSteps.length > 0) {
                    this.collectFromSequenceSteps(output, nestedSteps, gameEnv, defendingPlayerId, sourceUnit);
                }
            }
        }
    }

    private static evaluateConditionalStepSnapshot(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        sourceUnit: Record<string, unknown>,
        conditions: Array<Record<string, unknown>>
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return false;
        }

        for (const condition of conditions) {
            const isMet = EffectConditionEvaluator.validateEffectConditions(
                ensureEffectDefaults({
                    effectId: 'forced_attack_target_conditional_preview',
                    type: 'internal',
                    trigger: 'continuous',
                    action: 'noop',
                    conditions: [condition]
                } as any),
                gameEnv,
                defendingPlayerId,
                sourceUnit as any
            );
            if (!isMet) {
                return false;
            }
        }
        return true;
    }

    private static resolveCandidates(
        gameEnv: GameEnvironment,
        defendingPlayerId: string,
        sourceUnitCarduid: string,
        params: RequireAttackTargetParameters
    ): TargetReference[] {
        const candidate = params.candidateTarget && typeof params.candidateTarget === 'object'
            ? (params.candidateTarget as Record<string, unknown>)
            : null;
        if (!candidate) {
            return [];
        }

        const scope = typeof candidate.scope === 'string' ? candidate.scope : '';
        const type = typeof candidate.type === 'string' ? candidate.type : 'unit';

        if (type === 'unit' && scope === 'self') {
            const resolved = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceUnitCarduid);
            if (!resolved.found || resolved.playerId !== defendingPlayerId || resolved.type !== 'unit') {
                return [];
            }
            const unit = resolved.unit as any;
            if (!unit) {
                return [];
            }

            const filters = candidate.filters && typeof candidate.filters === 'object'
                ? (candidate.filters as Record<string, unknown>)
                : {};
            const status = typeof filters.status === 'string' ? filters.status : '';
            if (status === 'rested' && unit.isRested !== true) {
                return [];
            }
            if (status === 'active' && unit.isRested === true) {
                return [];
            }

            return [
                {
                    carduid: unit.carduid,
                    zone: resolved.slotName as string,
                    playerId: defendingPlayerId,
                    cardData: unit.cardData
                }
            ];
        }

        const effect: EffectDefinition = ensureEffectDefaults({
            effectId: 'candidate_attack_target',
            type: 'internal',
            trigger: 'ATTACK_TARGET_REQUIREMENT',
            action: 'noop',
            target: {
                type,
                scope,
                count: 99,
                ...(candidate.filters ? { filters: candidate.filters as any } : {})
            }
        } as any);

        const targetConfig = TargetResolver.resolveTargetConfig(effect);
        return TargetResolver.generateAvailableTargets(gameEnv, defendingPlayerId, targetConfig, sourceUnitCarduid);
    }
}
