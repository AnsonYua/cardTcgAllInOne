// src/services/actions/ActionProcessor.ts
// Processes actions by creating and running events through the game environment

import { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerAction } from '../../models/EventInterfaces';
import { createEventFromAction } from './ActionEventFactory';

export const processAction = async (gameEnv: GameEnvironment, action: PlayerAction): Promise<any> => {
    const event = createEventFromAction(action);
    console.log('event structure 1111', JSON.stringify(event));

    if (event) {
        gameEnv.enqueueForProcessing(event);

        const result = gameEnv.processEvents();

        if (!result.success) {
            return { success: false, error: result.error || 'Event validation failed', errorCode: (result as any).errorCode };
        }

        return result;
    }

    return { success: false, error: 'Event creation failed' };
};
