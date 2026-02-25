// src/services/effects/PairingEffectOrderManager.ts
// Handles OPTION_CHOICE events that let a player pick the next pairing-triggered effect to resolve.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { ExecutionResult } from '../ExecutionResult';
import { EventFactory } from '../EventQueue/EventFactory';
import { EventStatus, type OptionChoiceEvent, type PairingEffectDefinition } from '../EventQueue/interfaces/GameEvent';

type PairingEffectOrderContext = {
    kind: 'PAIRING_EFFECT_ORDER';
    pairingCarduid?: string;
    effects: PairingEffectDefinition[];
};

export class PairingEffectOrderManager {
    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        const context = event.data.context as Partial<PairingEffectOrderContext> | undefined;
        if (!context || context.kind !== 'PAIRING_EFFECT_ORDER') {
            return { success: false, error: 'PAIRING_EFFECT_ORDER missing context' };
        }

        const effects = Array.isArray(context.effects) ? (context.effects as PairingEffectDefinition[]) : [];
        if (effects.length === 0) {
            return { success: false, error: 'PAIRING_EFFECT_ORDER has no effects to order' };
        }

        const selectedIndex = event.data.selectedOptionIndex;
        if (typeof selectedIndex !== 'number') {
            return { success: false, error: 'PAIRING_EFFECT_ORDER missing selected option' };
        }

        const selectedOption = Array.isArray(event.data.availableOptions)
            ? event.data.availableOptions.find((option) => option.index === selectedIndex)
            : undefined;
        if (selectedOption?.disabled === true) {
            const reason = typeof selectedOption.disabledReason === 'string' && selectedOption.disabledReason.length > 0
                ? selectedOption.disabledReason
                : 'Option is currently unavailable';
            return { success: false, error: `PAIRING_EFFECT_ORDER selected option is disabled: ${reason}` };
        }

        const selectedEffect = effects.find((_effect, idx) => idx === selectedIndex);
        if (!selectedEffect) {
            return { success: false, error: 'PAIRING_EFFECT_ORDER selected option is out of range' };
        }

        const remainingEffects = effects.filter((_effect, idx) => idx !== selectedIndex);
        const pairingCarduid = typeof context.pairingCarduid === 'string' && context.pairingCarduid.length > 0
            ? context.pairingCarduid
            : event.data.sourceCarduid;

        const pairingEvent = EventFactory.createPairingEffectEvent(
            event.playerId,
            pairingCarduid,
            [selectedEffect]
        );

        (pairingEvent.data as any).remainingEffects = remainingEffects;
        gameEnv.enqueueForProcessing(pairingEvent);

        return { success: true };
    }
}
