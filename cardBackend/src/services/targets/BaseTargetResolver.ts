import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from './TargetResolver';

export class BaseTargetResolver {
    static generateBaseTargets(
        gameEnv: GameEnvironment,
        targetPlayerIds: string[],
        targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            if (!player?.zones) {
                continue;
            }

            const baseArea = Array.isArray(player.zones.base) ? player.zones.base : [];
            for (const base of baseArea) {
                if (!base?.carduid) {
                    continue;
                }

                if (typeof (targetConfig.filters as any)?.isRested === 'boolean') {
                    if (base.isRested !== (targetConfig.filters as any).isRested) {
                        continue;
                    }
                }

                if (targetConfig.filters?.status) {
                    const status = base.isRested ? 'rested' : 'active';
                    if (status !== targetConfig.filters.status) {
                        continue;
                    }
                }

                targets.push({
                    carduid: base.carduid,
                    zone: 'base',
                    playerId: targetPlayerId,
                    cardData: base.cardData as any
                });
            }
        }

        return targets;
    }
}
