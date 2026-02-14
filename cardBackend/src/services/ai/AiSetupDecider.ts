import type { AiDecision } from './AiTypes';

export function decideSetupPhase(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const phase = gameEnvView?.phase;
    if (phase === 'DECIDE_FIRST_PLAYER_PHASE') {
        if (gameEnvView?.firstPlayerChooser === aiPlayerId) {
            return {
                kind: 'chooseFirstPlayer',
                reason: 'ai_choose_first_player',
                payload: {
                    chosenFirstPlayerId: aiPlayerId
                }
            };
        }
        return null;
    }

    if (phase === 'REDRAW_PHASE') {
        const self = gameEnvView?.players?.[aiPlayerId];
        const alreadyReady = Boolean(self?.confirmIsRedraw);
        if (!alreadyReady) {
            return {
                kind: 'startReady',
                reason: 'ai_confirm_redraw_phase',
                payload: {
                    isRedraw: false
                }
            };
        }
        return null;
    }

    return null;
}
