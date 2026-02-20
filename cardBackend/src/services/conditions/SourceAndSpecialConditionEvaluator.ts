import type { GameEnvironment } from '../../models/GameEnvironment';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SlotHealthService } from '../health/SlotHealthService';
import { SourceStatConditionEvaluator } from './SourceStatConditionEvaluator';
import { SourceTraitConditionEvaluator } from './SourceTraitConditionEvaluator';
import { SlotCardStateUtils } from './SlotCardStateUtils';
import { ConditionScopeUtils } from './ConditionScopeUtils';

export interface SourceAndSpecialConditionContext {
    gameEnv: GameEnvironment;
    cardOwnerPlayerId: string | null;
    sourceCard?: any;
    type: string;
    scope: string;
    typedCondition: Record<string, unknown>;
}

export class SourceAndSpecialConditionEvaluator {
    static evaluate(context: SourceAndSpecialConditionContext): boolean | null {
        const { gameEnv, cardOwnerPlayerId, sourceCard, type, scope, typedCondition } = context;

        switch (type) {
            case 'sourceTrait': {
                const value = typedCondition.value;
                const trait = typeof value === 'string' ? value : '';
                const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
                if (!sourceCarduid || !trait) {
                    return false;
                }
                return SourceTraitConditionEvaluator.sourceHasTrait(gameEnv, sourceCarduid, trait);
            }

            case 'sourceColor': {
                if (scope !== 'source') {
                    return false;
                }
                const expected = typeof typedCondition.value === 'string' ? typedCondition.value.toLowerCase() : '';
                const actual = typeof sourceCard?.cardData?.color === 'string'
                    ? String(sourceCard.cardData.color).toLowerCase()
                    : '';
                if (!expected || !actual) {
                    return false;
                }
                return actual === expected;
            }

            case 'cardsInTrashWithNameIncludes': {
                const scopedPlayerId = ConditionScopeUtils.resolveScopedPlayerId(gameEnv, cardOwnerPlayerId, scope);
                if (!scopedPlayerId) {
                    return false;
                }
                const player = gameEnv.getPlayer(scopedPlayerId);
                const trash = Array.isArray((player?.zones as any)?.trashArea)
                    ? ((player?.zones as any).trashArea as any[])
                    : Array.isArray((player?.zones as any)?.trash)
                        ? ((player?.zones as any).trash as any[])
                        : [];
                const needle = typeof (typedCondition as any).name === 'string'
                    ? String((typedCondition as any).name).toLowerCase()
                    : '';
                if (!needle) {
                    return false;
                }
                const matches = trash.filter((card: any) => {
                    const name = typeof card?.cardData?.name === 'string'
                        ? card.cardData.name
                        : typeof card?.name === 'string'
                            ? card.name
                            : '';
                    return name.toLowerCase().includes(needle);
                }).length;
                if (typeof typedCondition.value === 'number') {
                    return matches === typedCondition.value;
                }
                if (typeof typedCondition.value === 'string') {
                    return validateComparisonFilter(matches, typedCondition.value);
                }
                return true;
            }

            case 'sourcePairedWithPilot': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const paired = SlotCardStateUtils.isCardPaired(gameEnv, sourceCarduid);
                return paired === expected;
            }

            case 'sourceIsBattling': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const battle = gameEnv.currentBattle;
                const battling = Boolean(
                    battle &&
                    (battle.attackerCarduid === sourceCarduid || battle.targetCarduid === sourceCarduid)
                );
                return battling === expected;
            }

            case 'battleTargetHasTrigger': {
                if (scope !== 'source') {
                    return false;
                }
                const expectedTrigger = typeof typedCondition.value === 'string'
                    ? typedCondition.value.toUpperCase()
                    : '';
                if (!expectedTrigger) {
                    return false;
                }
                const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
                const battle = gameEnv.currentBattle;
                if (!battle || battle.actionType !== 'attackUnit') {
                    return false;
                }
                const targetCarduid = battle.attackerCarduid === sourceCarduid
                    ? battle.targetCarduid
                    : battle.targetCarduid === sourceCarduid
                        ? battle.attackerCarduid
                        : undefined;
                const targetCard = targetCarduid ? SlotZoneUtils.getCardByUid(gameEnv, targetCarduid) : null;
                const rules = Array.isArray((targetCard as any)?.cardData?.effects?.rules)
                    ? ((targetCard as any).cardData.effects.rules as any[])
                    : [];
                return rules.some((rule: any) => String(rule?.trigger || '').toUpperCase() === expectedTrigger);
            }

            case 'sourceDeployedFrom': {
                if (scope !== 'source') {
                    return false;
                }
                const expected = typeof typedCondition.value === 'string'
                    ? typedCondition.value.toLowerCase()
                    : '';
                const actual = typeof sourceCard?.deployedFrom === 'string'
                    ? String(sourceCard.deployedFrom).toLowerCase()
                    : '';
                if (!expected || !actual) {
                    return false;
                }
                return actual === expected;
            }

            case 'sourceStatus': {
                if (scope !== 'source') {
                    return false;
                }
                if (!sourceCard) {
                    return false;
                }

                const statusRaw =
                    (typedCondition.status as string | undefined) ??
                    (typedCondition.value as string | undefined);
                const desired = typeof statusRaw === 'string' ? statusRaw.toLowerCase() : '';
                if (!desired) {
                    return true;
                }

                const isRested = sourceCard?.isRested === true;
                if (desired === 'rested') {
                    return isRested;
                }
                if (desired === 'active') {
                    return !isRested;
                }

                console.log(`⚠️ Unknown sourceStatus value: ${desired}`);
                return false;
            }

            case 'sourceDamaged': {
                if (scope !== 'source') {
                    return false;
                }
                if (!sourceCard) {
                    return false;
                }
                const expected = typeof typedCondition.value === 'boolean' ? typedCondition.value : true;
                const sourceCarduid = typeof sourceCard.carduid === 'string' ? sourceCard.carduid : '';
                const slotState = sourceCarduid
                    ? SlotHealthService.getSlotHealthState(gameEnv, sourceCarduid)
                    : null;
                const damaged = slotState
                    ? slotState.sharedDamage > 0
                    : (typeof sourceCard?.damageReceived === 'number' ? sourceCard.damageReceived > 0 : false);
                return damaged === expected;
            }

            case 'sourceLevel': {
                if (scope !== 'source') {
                    return false;
                }
                if (!sourceCard) {
                    return false;
                }
                const sourceLevel = typeof sourceCard?.cardData?.level === 'number'
                    ? sourceCard.cardData.level
                    : (typeof sourceCard?.level === 'number' ? sourceCard.level : 0);
                if (typeof typedCondition.value === 'number') {
                    return sourceLevel === typedCondition.value;
                }
                if (typeof typedCondition.value === 'string') {
                    return validateComparisonFilter(sourceLevel, typedCondition.value);
                }
                return true;
            }

            case 'sourceAp': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
                if (!sourceCarduid) {
                    return false;
                }
                return SourceStatConditionEvaluator.sourceApMatches(gameEnv, sourceCarduid, typedCondition.value);
            }

            case 'sourceHp': {
                if (scope !== 'source') {
                    return false;
                }
                const sourceCarduid = typeof sourceCard?.carduid === 'string' ? sourceCard.carduid : '';
                if (!sourceCarduid) {
                    return false;
                }
                return SourceStatConditionEvaluator.sourceHpMatches(gameEnv, sourceCarduid, typedCondition.value);
            }

            default:
                return null;
        }
    }
}
