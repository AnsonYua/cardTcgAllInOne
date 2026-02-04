// src/services/targets/EnergyTargetResolver.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { ResolvedTargetConfig } from './TargetResolver';
import { matchesEnergyTargetFilters, normalizeEnergyTargetFilters } from './EnergyTargetFilters';

export class EnergyTargetResolver {
    static generateEnergyTargets(
        gameEnv: GameEnvironment,
        targetPlayerIds: string[],
        targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        const normalizedFilters = normalizeEnergyTargetFilters(targetConfig?.filters);

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
                if (!matchesEnergyTargetFilters(energyCard, normalizedFilters)) {
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
