// src/services/TurnLifecycleManager.ts
// Handles non-phase turn lifecycle steps (cleanup, energy, draw, effects)

import { GameEnvironment } from '../models/GameEnvironment';
import { DeployTargetManager } from './DeployTargetManager';
import { EnergyManager } from './EnergyManager';
import { PlayerCardManager } from './PlayerCardManager';
import { ContinuousEffectManager } from './ContinuousEffectManager';
import { SLOT_ZONES } from '../config/gameConstants';

export class TurnLifecycleManager {
    static cleanupEndTurn(gameEnv: GameEnvironment, playerId: string): void {
        DeployTargetManager.cleanupExpiredTemporaryEffects(gameEnv, playerId);
        gameEnv.notificationQueue = [];
    }

    static startTurn(gameEnv: GameEnvironment, playerId: string): void {
        const player = gameEnv.players[playerId];
        if (player?.zones) {
            player.zones.repairAbilitiesCheckedThisCycle = false;
            console.log(`🔄 Reset repair abilities flag for new player: ${playerId}`);
        }

        EnergyManager.untapAllEnergy(gameEnv, playerId);
        EnergyManager.addBasicEnergy(gameEnv, playerId);

        if (player?.deck) {
            PlayerCardManager.drawCards(gameEnv, playerId, 1);
            console.log(`🃏 Drew 1 card for player ${playerId}`);
        }

        try {
            const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
            console.log(
                `✅ Continuous effects processed: ${result.effectsProcessed} processed, ${result.effectsActivated} activated, ${result.effectsDeactivated} deactivated`
            );
        } catch (error) {
            console.error(`❌ Error processing continuous effects on turn change:`, error);
        }
    }

    static readyMainPhase(gameEnv: GameEnvironment, playerId: string): void {
        const player = gameEnv.players[playerId];
        if (!player?.zones) return;

        const energyArea = player.zones.energyArea || [];
        for (const energy of energyArea) {
            energy.isRested = false;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            if (slot?.unit) {
                slot.unit.isRested = false;
            }
        }

        const bases = player.zones.base || [];
        for (const base of bases) {
            base.isRested = false;
        }
    }
}
