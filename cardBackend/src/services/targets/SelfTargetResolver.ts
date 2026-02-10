import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SourceCardTargetResolver } from './SourceCardTargetResolver';

export class SelfTargetResolver {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetReference[] | null {
        // Backward-compat alias: "SelfTargetResolver" historically meant "the source card itself".
        const scope = typeof effect.target?.scope === 'string' ? effect.target.scope.toLowerCase() : '';
        if (scope !== 'source') {
            return null;
        }
        return SourceCardTargetResolver.resolve(gameEnv, sourceCarduid, effect);
    }
}
