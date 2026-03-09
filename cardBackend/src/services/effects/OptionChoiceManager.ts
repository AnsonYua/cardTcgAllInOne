// src/services/effects/OptionChoiceManager.ts
// Executes generic OPTION_CHOICE events.

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EventStatus, OptionChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { TopDeckSelectionManager } from './TopDeckSelectionManager';
import { PairingEffectOrderManager } from './PairingEffectOrderManager';
import { DeployEffectOrderManager } from './DeployEffectOrderManager';
import { ScryTopDeckManager } from './ScryTopDeckManager';
import { AttackEffectOrderManager } from './AttackEffectOrderManager';

export class OptionChoiceManager {
    static executeOptionChoice(event: OptionChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        if (event.status !== EventStatus.RESOLVING) {
            return { success: true };
        }

        const action = event.data.effect?.action;
        switch (action) {
            case 'select_from_top_deck':
                return TopDeckSelectionManager.executeOptionChoice(event, gameEnv);
            case 'scry_top_deck':
                return ScryTopDeckManager.executeOptionChoice(event, gameEnv);
            case 'pairing_effect_order':
                return PairingEffectOrderManager.executeOptionChoice(event, gameEnv);
            case 'deploy_effect_order':
                return DeployEffectOrderManager.executeOptionChoice(event, gameEnv);
            case 'attack_effect_order':
                return AttackEffectOrderManager.executeOptionChoice(event, gameEnv);
            default:
                return { success: false, error: `OPTION_CHOICE unsupported effect action: ${action || 'unknown'}` };
        }
    }
}
