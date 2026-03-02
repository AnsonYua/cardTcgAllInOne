import { EventPriority, EventStatus, GameEvent } from './interfaces/GameEvent';
import { StateBasedAction } from './StateBasedActionEngine';

export class StateBasedActionEventFactory {
    static createAutoExecuteEvents(
        actions: StateBasedAction[],
        playerId: string,
        baseTimestamp: number = Date.now()
    ): GameEvent[] {
        const stateEvents: GameEvent[] = [];

        for (const action of actions) {
            if (!action.autoExecute) {
                continue;
            }

            const eventIndex = stateEvents.length;
            stateEvents.push({
                id: `state_${action.actionId}_${eventIndex}`,
                type: action.type,
                status: EventStatus.DECLARED,
                priority: EventPriority.HIGH,
                timestamp: baseTimestamp + eventIndex,
                playerId,
                data: action.data || {}
            });
        }

        return stateEvents;
    }
}
