import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SourcePairedTargetResolver } from './SourcePairedTargetResolver';
import { SourceCardTargetResolver } from './SourceCardTargetResolver';

export class TargetScopeResolverRegistry {
    private static readonly RESOLVERS: Record<
        string,
        (gameEnv: GameEnvironment, sourceCarduid: string, effect: EffectDefinition) => TargetReference[] | null
    > = {
        source: (gameEnv, sourceCarduid, effect) => SourceCardTargetResolver.resolve(gameEnv, sourceCarduid, effect),
        source_paired_pilot: (gameEnv, sourceCarduid) =>
            SourcePairedTargetResolver.resolve(gameEnv, sourceCarduid, 'source_paired_pilot'),
        source_paired_unit: (gameEnv, sourceCarduid) =>
            SourcePairedTargetResolver.resolve(gameEnv, sourceCarduid, 'source_paired_unit')
    };

    static resolve(
        gameEnv: GameEnvironment,
        sourceCarduid: string,
        effect: EffectDefinition
    ): TargetReference[] | null {
        const scope = typeof effect.target?.scope === 'string' ? effect.target.scope.toLowerCase() : '';
        const resolver = scope ? this.RESOLVERS[scope] : undefined;
        const resolved = resolver ? resolver(gameEnv, sourceCarduid, effect) : null;
        return resolved && resolved.length > 0 ? resolved : null;
    }
}
