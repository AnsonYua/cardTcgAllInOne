import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';

export type OwnershipPolicy = 'TARGET_OWNER' | 'SOURCE_CONTROLLER';

type ResolveOwnershipPolicyParams = {
    effect: EffectDefinition;
    defaultPolicy?: OwnershipPolicy;
};

type ResolveDestinationPlayerParams = {
    effect: EffectDefinition;
    sourcePlayerId: string;
    targetOwnerPlayerId: string;
};

export class OwnershipPolicyResolver {
    static resolveOwnershipPolicy(params: ResolveOwnershipPolicyParams): OwnershipPolicy {
        const { effect } = params;
        const fallback: OwnershipPolicy = params.defaultPolicy || 'TARGET_OWNER';

        const parameters = (effect?.parameters && typeof effect.parameters === 'object')
            ? (effect.parameters as Record<string, unknown>)
            : {};

        const destination = parameters.destination;
        const destinationOwner = destination && typeof destination === 'object'
            ? (destination as Record<string, unknown>).owner
            : undefined;
        const fromDestination = this.normalizeOwnershipPolicy(destinationOwner);
        if (fromDestination) {
            return fromDestination;
        }

        const fromOwnershipPolicy = this.normalizeOwnershipPolicy(parameters.ownershipPolicy);
        if (fromOwnershipPolicy) {
            return fromOwnershipPolicy;
        }

        return fallback;
    }

    static resolveHandDestinationPlayer(params: ResolveDestinationPlayerParams): string {
        const policy = this.resolveOwnershipPolicy({
            effect: params.effect,
            defaultPolicy: 'TARGET_OWNER'
        });

        if (policy === 'SOURCE_CONTROLLER') {
            return params.sourcePlayerId;
        }
        return params.targetOwnerPlayerId;
    }

    static shouldAttemptUidFallback(params: {
        effect: EffectDefinition;
        sourcePlayerId: string;
        incomingTarget: TargetReference;
        directResolvedPlayerId?: string;
    }): boolean {
        const policy = this.resolveOwnershipPolicy({
            effect: params.effect,
            defaultPolicy: 'TARGET_OWNER'
        });

        if (policy !== 'TARGET_OWNER') {
            return false;
        }

        const incomingPlayerId = typeof params.incomingTarget?.playerId === 'string'
            ? params.incomingTarget.playerId
            : '';
        const directPlayerId = typeof params.directResolvedPlayerId === 'string'
            ? params.directResolvedPlayerId
            : '';

        if (!directPlayerId) {
            return true;
        }

        if (incomingPlayerId && incomingPlayerId !== directPlayerId) {
            return true;
        }

        const scope = typeof params.effect?.target?.scope === 'string'
            ? params.effect.target.scope.toLowerCase()
            : '';
        if (scope.startsWith('opponent') && directPlayerId === params.sourcePlayerId) {
            return true;
        }

        return false;
    }

    private static normalizeOwnershipPolicy(value: unknown): OwnershipPolicy | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }

        const normalized = value.trim().toUpperCase();
        if (normalized === 'TARGET_OWNER' || normalized === 'SOURCE_CONTROLLER') {
            return normalized as OwnershipPolicy;
        }
        return undefined;
    }
}
