import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { DeployTargetResult } from '../DeployTargetResult';
import { EffectExecutor } from './EffectExecutor';
import { TokenChoiceManager } from './TokenChoiceManager';
import { DrawThenDiscardManager } from './DrawThenDiscardManager';
import { TopDeckSelectionManager } from './TopDeckSelectionManager';
import { SequenceEffectManager } from './SequenceEffectManager';
import { ConditionalEffectManager } from './ConditionalEffectManager';
import { ConditionalTokenDeployFlowManager } from './ConditionalTokenDeployFlowManager';
import { getEffectStructure } from './EffectActionAccess';

export class EffectActionRouter {
    static tryProcessEffectAction(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DeployTargetResult | null {
        const effectAction = EffectExecutor.getEffectAction(effect);
        const effectStructure = getEffectStructure(effect);

        if (effectAction === 'choose_one_then_deploy_token') {
            return TokenChoiceManager.processTokenChoiceEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectAction === 'draw_then_discard') {
            return DrawThenDiscardManager.processDrawThenDiscardEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectAction === 'select_from_top_deck') {
            return TopDeckSelectionManager.processEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectStructure === 'sequence') {
            return SequenceEffectManager.processSequenceEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectStructure === 'conditional') {
            return ConditionalEffectManager.processConditionalEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectAction === 'conditionalTokenDeploy') {
            return ConditionalTokenDeployFlowManager.processEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        return null;
    }
}
