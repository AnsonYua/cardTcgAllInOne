import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SourcePairedTargetResolver } from './SourcePairedTargetResolver';
import { SelfTargetResolver } from './SelfTargetResolver';

export class TargetScopeResolverRegistry {
    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetReference[] | null {
        const scope = typeof effect.target?.scope === 'string' ? effect.target.scope : '';
        switch (scope) {
            case 'self': {
                const resolved = SelfTargetResolver.resolve(gameEnv, sourceCarduid, effect);
                return resolved && resolved.length > 0 ? resolved : null;
            }
            case 'source_paired_pilot':
            case 'source_paired_unit':
                return SourcePairedTargetResolver.resolve(gameEnv, sourceCarduid, scope);
            default:
                return null;
        }
    }
}
