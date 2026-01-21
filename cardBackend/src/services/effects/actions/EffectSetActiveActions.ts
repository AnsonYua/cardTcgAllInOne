import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { UnitZoneCard, PilotZoneCard } from '../../../models/CardSystem';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

export function applySetActiveEffect(
    gameEnv: GameEnvironment,
    _sourcePlayerId: string,
    _effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
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
        targetCard.isRested = false;
        console.log(`  😌 ${target.carduid}: activated`);
    }

    return { success: true };
}
