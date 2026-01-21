import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { EnergyManager } from '../../EnergyManager';
import { extractNumericValue } from './EffectActionUtils';

export function applyAddExtraEnergyEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    const parameters = effect.parameters;
    const count = extractNumericValue(parameters) ?? 1;
    if (count <= 0) {
        return { success: false, error: 'addExtraEnergy requires a positive value' };
    }

    for (let i = 0; i < count; i++) {
        const added = EnergyManager.addExtraEnergy(gameEnv, sourcePlayerId);
        if (!added) {
            return { success: false, error: 'Failed to add extra energy' };
        }
    }

    console.log(`⚡ Added ${count} extra energy to player ${sourcePlayerId}`);
    return { success: true };
}
