// src/services/targets/EnergyTargetResolver.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from './TargetResolver';

export class EnergyTargetResolver {
    static generateEnergyTargets(
        gameEnv: GameEnvironment,
        targetPlayerIds: string[],
        _targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        for (const targetPlayerId of targetPlayerIds) {
            const player = gameEnv.getPlayer(targetPlayerId);
            const energyArea = player?.zones?.energyArea;
            if (!Array.isArray(energyArea)) {
                continue;
            }

            for (const energyCard of energyArea) {
                if (!energyCard?.carduid) {
                    continue;
                }
                targets.push({
                    carduid: energyCard.carduid,
                    zone: 'energy',
                    playerId: targetPlayerId,
                    cardData: energyCard.cardData as any
                });
            }
        }

        return targets;
    }
}
