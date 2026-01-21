import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { UnitZoneCard, PilotZoneCard } from '../../../models/CardSystem';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { extractNumericValue } from './EffectActionUtils';

export function applyGrantBreachEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    const breachValue = extractNumericValue(effect.parameters);
    if (!breachValue || breachValue <= 0) {
        return { success: false, error: 'grant_breach requires a positive value' };
    }

    for (const target of selectedTargets) {
        const resolvedTarget = SlotZoneUtils.resolveTargetReference(gameEnv, target);
        if (!resolvedTarget) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        const targetCard = resolvedTarget.card as UnitZoneCard | PilotZoneCard;
        if (!targetCard.temporaryEffects) {
            targetCard.temporaryEffects = [];
        }

        targetCard.temporaryEffects.push({
            sourceCarduid: sourceCarduid || 'unknown',
            breachValue,
            duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
            appliedTurn: gameEnv.currentTurn,
            appliedBy: sourcePlayerId,
            endOnSourceDestroyed: effect.timing?.endOnSourceDestroyed === true
        });

        console.log(`🛡️ Granted Breach ${breachValue} to ${target.carduid} (source ${sourceCarduid || 'unknown'})`);
    }

    return { success: true };
}
