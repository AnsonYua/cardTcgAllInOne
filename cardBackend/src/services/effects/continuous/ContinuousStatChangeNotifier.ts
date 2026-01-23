// src/services/effects/continuous/ContinuousStatChangeNotifier.ts
// Emits frontend notifications when continuous stat modifiers change.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import { SLOT_ZONES } from '../../../config/gameConstants';
import { GameNotificationManager } from '../../GameNotificationManager';

type StatSnapshot = Map<string, { ap: number; hp: number }>;

export class ContinuousStatChangeNotifier {
    static capture(gameEnv: GameEnvironment): StatSnapshot {
        const snapshot: StatSnapshot = new Map();

        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                const unit = slot?.unit;
                const pilot = slot?.pilot;

                if (unit?.carduid) {
                    snapshot.set(unit.carduid, {
                        ap: typeof unit.continueModifyAP === 'number' ? unit.continueModifyAP : 0,
                        hp: typeof unit.continueModifyHP === 'number' ? unit.continueModifyHP : 0
                    });
                }
                if (pilot?.carduid) {
                    snapshot.set(pilot.carduid, {
                        ap: typeof pilot.continueModifyAP === 'number' ? pilot.continueModifyAP : 0,
                        hp: typeof pilot.continueModifyHP === 'number' ? pilot.continueModifyHP : 0
                    });
                }
            }
        }

        return snapshot;
    }

    static notify(gameEnv: GameEnvironment, before: StatSnapshot): void {
        const notificationManager = new GameNotificationManager(gameEnv);

        for (const player of Object.values(gameEnv.players)) {
            if (!player?.zones) {
                continue;
            }

            for (const slotName of SLOT_ZONES) {
                const slot = (player.zones as any)[slotName];
                const cards = [slot?.unit, slot?.pilot].filter(Boolean);

                for (const card of cards) {
                    const carduid = card.carduid as string;
                    const prev = before.get(carduid) || { ap: 0, hp: 0 };
                    const nextAP = typeof card.continueModifyAP === 'number' ? card.continueModifyAP : 0;
                    const nextHP = typeof card.continueModifyHP === 'number' ? card.continueModifyHP : 0;

                    if (prev.ap !== nextAP) {
                        notificationManager.addNotificationEvent('CARD_STAT_MODIFIED', {
                            playerId: player.id,
                            carduid,
                            cardId: card.cardId,
                            cardName: card.cardData?.name || 'Unknown Card',
                            zone: slotName,
                            stat: 'modifyAP',
                            delta: nextAP - prev.ap,
                            modifierValue: nextAP,
                            source: 'continuous',
                            timestamp: Date.now()
                        });
                    }

                    if (prev.hp !== nextHP) {
                        notificationManager.addNotificationEvent('CARD_STAT_MODIFIED', {
                            playerId: player.id,
                            carduid,
                            cardId: card.cardId,
                            cardName: card.cardData?.name || 'Unknown Card',
                            zone: slotName,
                            stat: 'modifyHP',
                            delta: nextHP - prev.hp,
                            modifierValue: nextHP,
                            source: 'continuous',
                            timestamp: Date.now()
                        });
                    }
                }
            }
        }
    }
}

