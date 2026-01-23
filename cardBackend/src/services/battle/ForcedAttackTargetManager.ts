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
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
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

        const currentTargetCarduid = typeof eventData.targetCarduid === 'string' ? eventData.targetCarduid : '';
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
            attackEvent.data.actionType = 'attackUnit';
            (attackEvent.data as any).targetPlayerId = forced.playerId;
            (attackEvent.data as any).targetCarduid = forced.carduid;
            (attackEvent.data as any).skipForcedTargetCheck = true;

            const notificationManager = new GameNotificationManager(gameEnv);
            notificationManager.addNotificationEvent('ATTACK_TARGET_FORCED', {
                attackerPlayerId,
                attackerCarduid,
                defendingPlayerId: forced.playerId,
                forcedTargetCarduid: forced.carduid,
                forcedBySourceCarduid: merged.sourceCarduid,
                timestamp: Date.now()
            });

            return { success: true };
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

                const extracted = this.extractRequireAttackTargetEffect(normalized);
                if (!extracted) {
                    continue;
                }

                if (!ContinuousEffectManager.sourceConditionsMet(normalized as any, unit as any, gameEnv, defendingPlayerId)) {
                    continue;
                }

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

        return requirements;
    }

    private static extractRequireAttackTargetEffect(effect: EffectDefinition): { chooser: 'ATTACKER' | 'DEFENDER'; parameters: RequireAttackTargetParameters } | null {
        const action = typeof effect.action === 'string' ? effect.action : '';
        if (action === 'require_attack_target_if_available') {
            const chooserRaw = typeof effect.parameters?.chooser === 'string'
                ? String(effect.parameters.chooser).toUpperCase()
                : 'DEFENDER';
            return {
                chooser: chooserRaw === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
                parameters: effect.parameters as RequireAttackTargetParameters
            };
        }

        if (action !== 'sequence') {
            return null;
        }

        const steps = Array.isArray((effect.parameters as any)?.steps) ? ((effect.parameters as any).steps as any[]) : [];
        for (const step of steps) {
            if (!step || typeof step.action !== 'string') {
                continue;
            }
            if (step.action !== 'require_attack_target_if_available') {
                continue;
            }
            const chooserRaw = typeof step.parameters?.chooser === 'string'
                ? String(step.parameters.chooser).toUpperCase()
                : 'DEFENDER';
            return {
                chooser: chooserRaw === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
                parameters: step.parameters as RequireAttackTargetParameters
            };
        }

        return null;
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
        return TargetResolver.generateAvailableTargets(gameEnv, defendingPlayerId, targetConfig);
    }
}
