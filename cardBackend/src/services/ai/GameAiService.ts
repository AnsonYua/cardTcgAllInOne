import type { AiDecision } from './AiTypes';
import type { AiGameEnvView } from './AiViewTypes';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { validateScopeMatrix } from './AiScopeValidator';
import { GameAiV1Service } from './v1/GameAiV1Service';

type GameAiDecisionRuntime = {
    rawGameEnv?: GameEnvironment;
};

export class GameAiService {
    private static buildEmergencyFallback(gameEnvView: AiGameEnvView, aiPlayerId: string, reason: string): AiDecision {
        if (gameEnvView?.currentPlayer === aiPlayerId && gameEnvView?.phase === 'MAIN_PHASE') {
            return {
                kind: 'endTurn',
                reason: 'v1_wrapper_emergency_end_turn',
                telemetry: {
                    fallbackReason: reason,
                    fallbackKind: 'wrapper_end_turn'
                }
            };
        }

        return {
            kind: 'wait',
            reason: 'v1_wrapper_wait',
            telemetry: {
                fallbackReason: reason,
                fallbackKind: 'wrapper_wait'
            }
        };
    }

    static async decide(gameEnvView: AiGameEnvView, aiPlayerId: string, runtime: GameAiDecisionRuntime = {}): Promise<AiDecision> {
        const scopeIssue = validateScopeMatrix(gameEnvView, aiPlayerId);
        if (scopeIssue) {
            return {
                kind: 'wait',
                reason: `scope_violation:${scopeIssue}`
            };
        }

        try {
            return await GameAiV1Service.decide(gameEnvView, aiPlayerId, runtime);
        } catch (error) {
            console.error('❌ AI v1 pipeline failed:', error);
            return this.buildEmergencyFallback(gameEnvView, aiPlayerId, 'v1_pipeline_error');
        }
    }
}
