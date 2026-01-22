// src/services/effects/EndTurnTriggeredEffectManager.ts
// Handles END_OF_TURN triggered effects that are not covered by keyword-specific managers (e.g. Repair).

import { GameEnvironment } from '../../models/GameEnvironment';
import { EventType } from '../../models/GameEnums';
import { SLOT_ZONES } from '../../config/gameConstants';
import type { StateBasedAction } from '../EventQueue/StateBasedActionEngine';
import type { EffectDefinition, EndTurnTriggeredEffectEvent } from '../EventQueue/interfaces/GameEvent';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from './EffectExecutor';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { DeployTargetManager } from '../DeployTargetManager';

export class EndTurnTriggeredEffectManager {
    static checkEndTurnTriggeredEffects(
        gameEnv: GameEnvironment,
        playerId: string
    ): StateBasedAction[] {
        const actions: StateBasedAction[] = [];

        const player = gameEnv.players[playerId];
        if (!player?.zones) {
            return actions;
        }

        for (const slotName of SLOT_ZONES) {
            const slot = (player.zones as any)[slotName];
            const cardsToCheck = [slot?.unit, slot?.pilot].filter(Boolean);

            for (const sourceCard of cardsToCheck) {
                const normalizedEffects = EffectRuleCatalog.collectEffects(sourceCard.cardData, {
                    trigger: 'END_OF_TURN',
                    fallbackEffectId: 'end_of_turn_effect',
                    expectedTriggers: ['END_OF_TURN'],
                    requireAction: true,
                    defaultTargetScope: 'self'
                });

                for (const effectRule of normalizedEffects) {
                    const normalizedEffect = ensureEffectDefaults(effectRule);
                    const action = EffectExecutor.getEffectAction(normalizedEffect);

                    if (action === 'heal') {
                        continue;
                    }

                    if (!ContinuousEffectManager.validateEffectConditions(
                        normalizedEffect,
                        gameEnv,
                        playerId,
                        sourceCard
                    )) {
                        continue;
                    }

                    actions.push({
                        actionId: `end_turn_trigger_${normalizedEffect.effectId}_${sourceCard.carduid}_${Date.now()}`,
                        type: EventType.TRIGGER_END_OF_TURN_EFFECT,
                        autoExecute: true,
                        data: {
                            sourceCarduid: sourceCard.carduid,
                            effect: normalizedEffect
                        }
                    });
                }
            }
        }

        return actions;
    }

    static executeEndTurnTriggeredEffect(
        event: EndTurnTriggeredEffectEvent,
        gameEnv: GameEnvironment
    ): { success: boolean; error?: string } {
        const playerId = event.playerId;
        const effect: EffectDefinition = event.data.effect;
        const sourceCarduid = event.data.sourceCarduid;

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            playerId,
            sourceCarduid,
            effect
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return { success: true };
    }
}

