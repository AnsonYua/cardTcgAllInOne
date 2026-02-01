import type { GameEnvironment } from '../../models/GameEnvironment';
import { GameNotificationManager } from '../GameNotificationManager';

export function markBurstChoiceNotificationCompleted(
    gameEnv: GameEnvironment,
    params: {
        burstEventId: string;
        userDecision: 'ACTIVATE' | 'DECLINE';
    }
): void {
    const queue = gameEnv.notificationQueue;
    if (!Array.isArray(queue) || queue.length === 0) {
        return;
    }

    const now = Date.now();
    const notificationManager = new GameNotificationManager(gameEnv);

    const single = queue.find(evt => evt?.type === 'BURST_EFFECT_CHOICE' && evt?.id === params.burstEventId);
    if (single?.payload?.event) {
        single.payload.event.status = 'RESOLVED';
        if (!single.payload.event.data) {
            single.payload.event.data = {};
        }
        single.payload.event.data.userDecisionMade = true;
        single.payload.event.data.userDecision = params.userDecision;
        single.payload.event.data.resolvedAt = now;
        single.payload.isCompleted = true;

        notificationManager.makePersistent(single.id);
    }

    const group = queue.find(evt =>
        evt?.type === 'BURST_EFFECT_CHOICE_GROUP'
        && Array.isArray(evt?.payload?.events)
        && evt.payload.events.some((e: any) => e?.id === params.burstEventId)
    );

    if (!group) {
        return;
    }

    const groupEvents: any[] = group.payload.events;
    const matching = groupEvents.find(e => e?.id === params.burstEventId);
    if (matching) {
        matching.status = 'RESOLVED';
        if (!matching.data) {
            matching.data = {};
        }
        matching.data.userDecisionMade = true;
        matching.data.userDecision = params.userDecision;
        matching.data.resolvedAt = now;
    }

    if (!Array.isArray(group.payload.resolvedEventIds)) {
        group.payload.resolvedEventIds = [];
    }
    if (!group.payload.resolvedEventIds.includes(params.burstEventId)) {
        group.payload.resolvedEventIds.push(params.burstEventId);
    }

    group.payload.isCompleted = group.payload.resolvedEventIds.length >= groupEvents.length;
    notificationManager.makePersistent(group.id);
}
