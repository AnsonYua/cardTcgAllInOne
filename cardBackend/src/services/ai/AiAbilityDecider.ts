import type { AiDecision } from './AiTypes';
import { EffectExecutor } from '../effects/EffectExecutor';
import { isPlayOrActivatedEffect } from '../../utils/EffectTypeRouter';
import { TargetResolver } from '../targets/TargetResolver';
import { SlotCardStateUtils } from '../conditions/SlotCardStateUtils';
import { effectRequiresLinkedSource } from '../../utils/ImplicitEffectConditionUtils';
import { EffectTimingWindowUtils } from '../../utils/EffectTimingWindowUtils';
import { buildViewAdapter, scoreTargetForAction } from './AiTargetUtils';
import { getAvailableEnergyCount, getTotalEnergyCount } from './AiEnergyUtils';
import { SLOT_NAMES } from './AiTypes';

export function findNonAttackAction(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    if (gameEnvView?.phase !== 'MAIN_PHASE') {
        return null;
    }
    if (gameEnvView?.currentBattle) {
        return null;
    }

    const command = findCommandAbilityNoTarget(gameEnvView, aiPlayerId);
    if (command) {
        return command;
    }

    const targetedCommand = findCommandAbilityWithTargets(gameEnvView, aiPlayerId);
    if (targetedCommand) {
        return targetedCommand;
    }

    const unitOrPilot = findUnitOrPilotAbility(gameEnvView, aiPlayerId);
    if (unitOrPilot) {
        return unitOrPilot;
    }

    const baseAbility = findBaseAbility(gameEnvView, aiPlayerId);
    if (baseAbility) {
        return baseAbility;
    }

    return null;
}

function findCommandAbilityNoTarget(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
    if (hand.length === 0) {
        return null;
    }

    const availableEnergy = getAvailableEnergyCount(self);
    const totalEnergy = getTotalEnergyCount(self);

    for (const card of hand) {
        const cardData = card?.cardData || {};
        if (cardData?.cardType !== 'command') {
            continue;
        }

        const effectiveCostRaw = cardData?.effectiveCost ?? cardData?.cost ?? 0;
        const effectiveLevelRaw = cardData?.effectiveLevel ?? cardData?.level ?? 0;
        const cost = Number.isFinite(Number(effectiveCostRaw)) ? Number(effectiveCostRaw) : 0;
        const level = Number.isFinite(Number(effectiveLevelRaw)) ? Number(effectiveLevelRaw) : 0;
        if (cost > availableEnergy || level > totalEnergy) {
            continue;
        }

        const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        const effect = rules.find((rule: any) =>
            isPlayOrActivatedEffect(rule)
            && EffectExecutor.actionSupportsNoTargets(rule?.action)
        );
        if (!effect) {
            continue;
        }

        return {
            kind: 'playerAction',
            reason: 'use_command_no_target',
            payload: {
                actionType: 'useCommandCard',
                carduid: card.carduid,
                effectId: effect.effectId
            }
        };
    }

    return null;
}

function findCommandAbilityWithTargets(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
    if (hand.length === 0) {
        return null;
    }

    const availableEnergy = getAvailableEnergyCount(self);
    const totalEnergy = getTotalEnergyCount(self);
    const adapter = buildViewAdapter(gameEnvView);

    for (const card of hand) {
        const cardData = card?.cardData || {};
        if (cardData?.cardType !== 'command') {
            continue;
        }

        const effectiveCostRaw = cardData?.effectiveCost ?? cardData?.cost ?? 0;
        const effectiveLevelRaw = cardData?.effectiveLevel ?? cardData?.level ?? 0;
        const cost = Number.isFinite(Number(effectiveCostRaw)) ? Number(effectiveCostRaw) : 0;
        const level = Number.isFinite(Number(effectiveLevelRaw)) ? Number(effectiveLevelRaw) : 0;
        if (cost > availableEnergy || level > totalEnergy) {
            continue;
        }

        const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        for (const rule of rules) {
            if (!isPlayOrActivatedEffect(rule)) {
                continue;
            }
            const action = rule?.action;
            if (EffectExecutor.actionSupportsNoTargets(action)) {
                continue;
            }
            if (!rule?.target) {
                continue;
            }

            const targetConfig = TargetResolver.resolveTargetConfig(rule);
            const availableTargets = TargetResolver.generateAvailableTargets(
                adapter,
                aiPlayerId,
                targetConfig,
                card.carduid
            );
            if (availableTargets.length === 0) {
                continue;
            }

            const count = Math.max(1, targetConfig.count || 1);
            const selected = availableTargets
                .map((target) => ({ target, score: scoreTargetForAction(gameEnvView, target, rule, targetConfig.scope) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, count)
                .map((entry) => entry.target);
            if (selected.length === 0) {
                continue;
            }

            return {
                kind: 'playerAction',
                reason: 'use_command_with_targets',
                payload: {
                    actionType: 'useCommandCard',
                    carduid: card.carduid,
                    effectId: rule.effectId,
                    ...(selected.length === 1
                        ? { targetCarduid: selected[0].carduid }
                        : {
                              targets: selected.map((t) => ({
                                  carduid: t.carduid,
                                  zone: t.zone,
                                  playerId: t.playerId
                              }))
                          })
                }
            };
        }
    }

    return null;
}

function findUnitOrPilotAbility(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const zones = self?.zones || {};
    const currentTurn = Number(gameEnvView?.currentTurn || 0);
    const adapter = buildViewAdapter(gameEnvView);

    const candidates: Array<{ carduid: string; cardData: any; isRested: boolean; effectUsage?: Record<string, any> }> = [];

    for (const slotName of SLOT_NAMES) {
        const slot = zones?.[slotName];
        if (slot?.unit?.carduid) {
            candidates.push({
                carduid: slot.unit.carduid,
                cardData: slot.unit.cardData,
                isRested: Boolean(slot.unit.isRested),
                effectUsage: slot.unit.effectUsage || {}
            });
        }
        if (slot?.pilot?.carduid) {
            candidates.push({
                carduid: slot.pilot.carduid,
                cardData: slot.pilot.cardData,
                isRested: Boolean(slot.pilot.isRested),
                effectUsage: slot.pilot.effectUsage || {}
            });
        }
    }

    for (const source of candidates) {
        const rules = Array.isArray(source.cardData?.effects?.rules) ? source.cardData.effects.rules : [];
        for (const rule of rules) {
            if (rule?.type !== 'activated') {
                continue;
            }
            if (!EffectTimingWindowUtils.allowsPhase(rule, gameEnvView?.phase, { defaultToMainPhaseWhenMissing: true })) {
                continue;
            }

            const cost = rule?.cost || {};
            if (cost?.oncePerTurn === true) {
                const lastUsedTurn = source.effectUsage?.[rule.effectId]?.lastUsedTurn;
                if (typeof lastUsedTurn === 'number' && lastUsedTurn >= currentTurn) {
                    continue;
                }
            }

            const requiresRest = cost?.restSelf === true || cost?.rest === 'self' || cost?.tap === 'self';
            if (requiresRest && source.isRested) {
                continue;
            }

            if (effectRequiresLinkedSource(rule, source.cardData) && !SlotCardStateUtils.isCardLinked(adapter, source.carduid)) {
                continue;
            }

            return {
                kind: 'playerAction',
                reason: 'activate_unit_or_pilot_ability',
                payload: {
                    actionType: 'activateCardAbility',
                    carduid: source.carduid,
                    effectId: rule.effectId
                }
            };
        }
    }

    return null;
}

function findBaseAbility(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const zones = self?.zones || {};
    const bases = Array.isArray(zones.base) ? zones.base : [];
    if (bases.length === 0) {
        return null;
    }

    const currentTurn = Number(gameEnvView?.currentTurn || 0);

    for (const base of bases) {
        const cardData = base?.cardData || {};
        const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        const effect = rules.find((rule: any) => rule?.type === 'activated');
        if (!effect) {
            continue;
        }

        const cost = effect?.cost || {};
        if (cost?.oncePerTurn === true) {
            const lastUsedTurn = base?.effectUsage?.[effect.effectId]?.lastUsedTurn;
            if (typeof lastUsedTurn === 'number' && lastUsedTurn >= currentTurn) {
                continue;
            }
        }

        const requiresRest = cost?.restSelf === true || cost?.rest === 'self' || cost?.tap === 'self';
        if (requiresRest && base?.isRested) {
            continue;
        }

        return {
            kind: 'playerAction',
            reason: 'activate_base_ability',
            payload: {
                actionType: 'activateCardAbility',
                carduid: base.carduid,
                effectId: effect.effectId
            }
        };
    }

    return null;
}
