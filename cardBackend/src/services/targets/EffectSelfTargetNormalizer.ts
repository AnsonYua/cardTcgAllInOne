import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

type ZoneSourceCard = UnitZoneCard | PilotZoneCard;

const SELF_REFERENTIAL_ACTIONS = new Set([
    'allow_attack_target',
    'destroy',
    'modifyAP',
    'modifyHP',
    'grant_keyword',
    'grant_breach',
    'prevent_battle_damage',
    'prevent_damage',
    'restrict_attack',
    'returnToDeckBottom',
    'setActive'
]);

function resolveAction(effect: EffectDefinition): string {
    return typeof effect.action === 'string' ? effect.action : '';
}

function resolveTargetType(effect: EffectDefinition): string {
    return typeof effect.target?.type === 'string' ? effect.target.type.toLowerCase() : '';
}

function hasPlayerChoice(effect: EffectDefinition): boolean {
    const selectionType =
        typeof effect.target?.selection?.type === 'string'
            ? effect.target.selection.type.toLowerCase()
            : '';
    return selectionType === 'player_choice';
}

function isSingleTarget(effect: EffectDefinition): boolean {
    const count = effect.target?.count;
    return count === undefined || count === 1;
}

function inferSourceScope(sourceCard: ZoneSourceCard, targetType: string): 'source' | 'source_paired_unit' {
    const sourceType = sourceCard?.cardData?.cardType;
    if (sourceType === 'pilot' && targetType === 'unit') {
        return 'source_paired_unit';
    }
    return 'source';
}

export class EffectSelfTargetNormalizer {
    static normalizeWithSourceCarduid(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        sourceCarduid: string | undefined
    ): EffectDefinition {
        if (!sourceCarduid) {
            return effect;
        }
        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as ZoneSourceCard | null;
        if (!sourceCard) {
            return effect;
        }
        return this.normalize(effect, sourceCard);
    }

    static normalize(
        effect: EffectDefinition,
        sourceCard: ZoneSourceCard
    ): EffectDefinition {
        const action = resolveAction(effect);
        if (!action || !SELF_REFERENTIAL_ACTIONS.has(action)) {
            return effect;
        }

        // Explicit player choice rules should remain unchanged.
        if (hasPlayerChoice(effect)) {
            return effect;
        }

        const targetType = resolveTargetType(effect) || 'unit';
        const sourceScope = inferSourceScope(sourceCard, targetType);

        // Self-referential effects target exactly one source card by design.
        if (!isSingleTarget(effect)) {
            return effect;
        }

        if (!effect.target) {
            if (action !== 'allow_attack_target') {
                return effect;
            }
            return {
                ...effect,
                target: {
                    type: targetType,
                    scope: sourceScope,
                    count: 1
                }
            };
        }

        const scope = typeof effect.target.scope === 'string' ? effect.target.scope.toLowerCase() : '';
        if (scope !== 'self') {
            return effect;
        }

        return {
            ...effect,
            target: {
                ...effect.target,
                type: targetType,
                scope: sourceScope
            }
        };
    }
}
