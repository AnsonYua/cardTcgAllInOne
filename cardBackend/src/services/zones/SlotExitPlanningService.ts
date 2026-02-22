import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { SlotExitPolicy } from './SlotExitPolicy';
import { type SlotCardEntry, type SlotCardType } from './SlotExitTransferService';

export type SlotExitHandPlan = {
    ownerPlayerId: string;
    slotName: string;
    targetType: SlotCardType;
    plannedCards: SlotCardEntry[];
};

export type SlotExitTrashPlan = {
    ownerPlayerId: string;
    slotName: string;
    targetType: SlotCardType;
    plannedCards: SlotCardEntry[];
};

export class SlotExitPlanningService {
    static planTargetToHand(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        targetType: SlotCardType,
        effect: EffectDefinition
    ): { success: boolean; error?: string; plan?: SlotExitHandPlan } {
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found` };
        }

        const slot = (owner.zones as any)[slotName];
        if (!slot) {
            return { success: false, error: `Slot ${slotName} not found for player ${ownerPlayerId}` };
        }

        const includePairedPilotWithUnit = SlotExitPolicy.shouldIncludePairedPilotWithUnit('hand', targetType, effect);
        const plannedCards = this.buildSlotExitPlan(slot, targetType, { includePairedPilotWithUnit });
        if (!plannedCards.success) {
            return { success: false, error: plannedCards.error };
        }

        return {
            success: true,
            plan: {
                ownerPlayerId,
                slotName,
                targetType,
                plannedCards: plannedCards.cards
            }
        };
    }

    static planTargetToTrash(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        targetType: SlotCardType
    ): { success: boolean; error?: string; plan?: SlotExitTrashPlan } {
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found` };
        }

        const slot = (owner.zones as any)[slotName];
        if (!slot) {
            return { success: false, error: `Slot ${slotName} not found for player ${ownerPlayerId}` };
        }

        const includePairedPilotWithUnit = SlotExitPolicy.shouldIncludePairedPilotWithUnit('trash', targetType);
        const plannedCards = this.buildSlotExitPlan(slot, targetType, { includePairedPilotWithUnit });
        if (!plannedCards.success) {
            return { success: false, error: plannedCards.error };
        }

        return {
            success: true,
            plan: {
                ownerPlayerId,
                slotName,
                targetType,
                plannedCards: plannedCards.cards
            }
        };
    }

    private static buildSlotExitPlan(
        slot: any,
        targetType: SlotCardType,
        options: { includePairedPilotWithUnit: boolean }
    ): { success: boolean; error?: string; cards: SlotCardEntry[] } {
        const cards: SlotCardEntry[] = [];

        if (targetType === 'unit') {
            if (!slot?.unit) {
                return { success: false, error: 'Target unit not found in slot', cards: [] };
            }
            cards.push({ card: slot.unit, type: 'unit' });
            if (options.includePairedPilotWithUnit && slot?.pilot) {
                cards.push({ card: slot.pilot, type: 'pilot' });
            }
            return { success: true, cards };
        }

        if (!slot?.pilot) {
            return { success: false, error: 'Target pilot not found in slot', cards: [] };
        }
        cards.push({ card: slot.pilot, type: 'pilot' });
        return { success: true, cards };
    }
}
