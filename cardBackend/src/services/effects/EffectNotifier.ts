import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { TargetReference } from '../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../GameNotificationManager';
import { calculateSlotFieldValue } from '../../utils/FieldValueCalculator';

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
        const targetPlayer = gameEnv.players?.[target.playerId];
        const isSlotZone = typeof target.zone === 'string' && /^slot\\d+$/.test(target.zone);
        const fieldCardValue =
            isSlotZone && targetPlayer ? calculateSlotFieldValue((targetPlayer.zones as any)[target.zone]) : undefined;
        const displayValue =
            action === 'modifyAP' ? fieldCardValue?.totalAP ?? 0 : fieldCardValue?.totalHP ?? 0;

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
                displayValue,
                timestamp: Date.now()
            },
            'normal'
        );
    }

    static notifyCardDamageApplied(
        gameEnv: GameEnvironment,
        targetCard: UnitZoneCard | PilotZoneCard,
        target: TargetReference,
        damage: number,
        resultingHP: number,
        maxHP: number
    ): void {
        const notificationManager = new GameNotificationManager(gameEnv);
        const cardId = targetCard.cardId ?? target.cardData?.cardId;
        const cardName = target.cardData?.name || targetCard.cardData?.name || 'Unknown Card';

        notificationManager.addNotificationEvent(
            'CARD_DAMAGED',
            {
                playerId: target.playerId,
                carduid: target.carduid,
                cardId,
                cardName,
                zone: target.zone,
                damage,
                resultingHP,
                maxHP,
                timestamp: Date.now()
            },
            'normal'
        );
    }
}
