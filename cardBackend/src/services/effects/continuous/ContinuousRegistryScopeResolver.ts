import type { GameEnvironment } from '../../../models/GameEnvironment';
import { ContinuousScopeUtils } from './ContinuousScopeUtils';
import { ContinuousRegistryTargetResolver } from './ContinuousRegistryTargetResolver';
import { ContinuousTargetFilter } from './ContinuousTargetFilter';

export class ContinuousRegistryScopeResolver {
    static resolve(effectEntry: any, gameEnv: GameEnvironment, getAllPlayerUnitsInSlot: (playerId: string, env: GameEnvironment) => any[]): any[] {
        const scope = ContinuousScopeUtils.normalizeScope(effectEntry.scope);
        const sourcePlayerId = effectEntry.sourcePlayerId;

        switch (scope) {
            case 'self_all_unit': {
                const units = getAllPlayerUnitsInSlot(sourcePlayerId, gameEnv);
                return ContinuousTargetFilter.apply(units, effectEntry.effectData?.target, effectEntry.sourceCarduid);
            }
            case 'self_all_shield': {
                const player = gameEnv.players[sourcePlayerId];
                const shields = Array.isArray(player?.zones?.shieldArea) ? player.zones.shieldArea : [];
                return shields.map((card: any) => ({
                    ...card,
                    zone: 'shield',
                    playerId: sourcePlayerId
                }));
            }
            case 'opponent_all': {
                const opponentId = this.getOpponentId(sourcePlayerId, gameEnv);
                return ContinuousTargetFilter.apply(
                    getAllPlayerUnitsInSlot(opponentId, gameEnv),
                    effectEntry.effectData?.target,
                    effectEntry.sourceCarduid
                );
            }
            case 'self':
                return ContinuousTargetFilter.apply(
                    ContinuousRegistryTargetResolver.resolveSelf(effectEntry, gameEnv),
                    effectEntry.effectData?.target,
                    effectEntry.sourceCarduid
                );
            case 'battle_opponent': {
                const targets = ContinuousRegistryTargetResolver.resolveBattleOpponent(effectEntry, gameEnv);
                return ContinuousTargetFilter.apply(targets, effectEntry.effectData?.target, effectEntry.sourceCarduid);
            }
            default:
                console.log(`⚠️ Unknown scope: ${scope}`);
                return [];
        }
    }

    private static getOpponentId(playerId: string, gameEnv: GameEnvironment): string {
        const playerIds = Object.keys(gameEnv.players);
        return playerIds.find((id) => id !== playerId) || '';
    }
}
