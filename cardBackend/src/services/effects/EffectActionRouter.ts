import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { DeployTargetResult } from '../DeployTargetResult';
import { EffectExecutor } from './EffectExecutor';
import { TokenChoiceManager } from './TokenChoiceManager';
import { DrawThenDiscardManager } from './DrawThenDiscardManager';
import { TutorTopDeckManager } from './TutorTopDeckManager';
import { DeployFromTopDeckManager } from './DeployFromTopDeckManager';
import { SequenceEffectManager } from './SequenceEffectManager';
import { ConditionalEffectManager } from './ConditionalEffectManager';

export class EffectActionRouter {
    static tryProcessEffectAction(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DeployTargetResult | null {
        const effectAction = EffectExecutor.getEffectAction(effect);

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

        if (effectAction === 'tutor_top_deck') {
            return TutorTopDeckManager.processTutorTopDeckEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectAction === 'deploy_from_top_deck') {
            return DeployFromTopDeckManager.processDeployFromTopDeckEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectAction === 'sequence') {
            return SequenceEffectManager.processSequenceEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                effect,
                cardPlayNotificationId
            ) as DeployTargetResult;
        }

        if (effectAction === 'conditional') {
            return ConditionalEffectManager.processConditionalEffect(
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

