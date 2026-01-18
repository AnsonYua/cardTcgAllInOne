import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../GameNotificationManager';

export class EffectNotifier {
    static notifyCardStatChange(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference,
        action: 'modifyAP' | 'modifyHP',
        delta: number,
        modifierValue: number
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const cardId = targetCard.cardId ?? target.cardData?.cardId;
        const cardName = target.cardData?.name || targetCard.cardData?.name || 'Unknown Card';

        notificationManager.addNotificationEvent(
            'CARD_STAT_MODIFIED',
            {
                playerId: target.playerId,
                carduid: target.carduid,
                cardId,
                cardName,
                zone: target.zone,
                stat: action,
                delta,
                modifierValue,
                timestamp: Date.now()
            },
            'normal'
        );
    }
}
