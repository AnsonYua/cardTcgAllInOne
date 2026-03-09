import type { AiDecision } from './AiTypes';
import { SLOT_NAMES } from './AiTypes';
import { UnitRestrictionUtils } from '../restrictions/UnitRestrictionUtils';
import { getAvailableEnergyCount, getTotalEnergyCount } from './AiEnergyUtils';
import type { AiGameEnvView, AiHandCard, AiSlotView } from './AiViewTypes';
import type { ZoneCard } from '../../models/CardSystem';
import { getEffectPlayMode } from '../effects/EffectActionAccess';

type PlayableCard = {
    carduid: string;
    cardType: string;
    cost: number;
    level: number;
    cardData: AiHandCard['cardData'];
};

export function findBestPlayCard(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
    if (hand.length === 0) {
        return null;
    }

    const zones = (self?.zones || {}) as Record<string, AiSlotView | undefined> & {
        base?: Array<Record<string, unknown>>;
    };
    const availableEnergy = getAvailableEnergyCount(self);
    const totalEnergy = getTotalEnergyCount(self);
    const hasBase = Array.isArray(zones.base) && zones.base.length > 0;
    const emptyUnitSlots = SLOT_NAMES.filter((slotName) => !zones?.[slotName]?.unit);
    const unitWithoutPilot = SLOT_NAMES
        .map((slotName) => zones?.[slotName] as AiSlotView | undefined)
        .find((slot) =>
            slot?.unit
            && !slot?.pilot
            && !UnitRestrictionUtils.cannotBePairedWithPilot(slot.unit as unknown as ZoneCard)
        );

    const playable = hand
        .map((card): PlayableCard | null => {
            const cardData = card?.cardData || {};
            const effectiveCostRaw = cardData?.effectiveCost ?? cardData?.cost ?? 0;
            const effectiveLevelRaw = cardData?.effectiveLevel ?? cardData?.level ?? 0;
            const cost = Number.isFinite(Number(effectiveCostRaw)) ? Number(effectiveCostRaw) : 0;
            const level = Number.isFinite(Number(effectiveLevelRaw)) ? Number(effectiveLevelRaw) : 0;
            const cardType = cardData?.cardType;
            const carduid = typeof card?.carduid === 'string' ? card.carduid : '';
            if (!carduid || typeof cardType !== 'string') {
                return null;
            }
            return {
                carduid,
                cardType,
                cost,
                level,
                cardData
            };
        })
        .filter((card): card is PlayableCard =>
            Boolean(card && card.cost <= availableEnergy && card.level <= totalEnergy)
        );

    const bestBase = playable.find((card) => card.cardType === 'base');
    if (bestBase && !hasBase) {
        return {
            kind: 'playCard',
            reason: 'establish_base',
            payload: {
                action: {
                    type: 'PlayCard',
                    carduid: bestBase.carduid,
                    playAs: 'base'
                }
            }
        };
    }

    const bestUnit = playable
        .filter((card) => card.cardType === 'unit' && emptyUnitSlots.length > 0)
        .sort((a, b) => b.cost - a.cost)[0];
    if (bestUnit) {
        return {
            kind: 'playCard',
            reason: 'develop_unit',
            payload: {
                action: {
                    type: 'PlayCard',
                    carduid: bestUnit.carduid,
                    playAs: 'unit'
                }
            }
        };
    }

    const bestPilot = playable
        .filter((card) => card.cardType === 'pilot' && unitWithoutPilot?.unit?.carduid)
        .sort((a, b) => b.cost - a.cost)[0];
    if (bestPilot && unitWithoutPilot?.unit?.carduid) {
        return {
            kind: 'playCard',
            reason: 'pair_pilot',
            payload: {
                action: {
                    type: 'PlayCard',
                    carduid: bestPilot.carduid,
                    playAs: 'pilot',
                    targetUnit: unitWithoutPilot.unit.carduid
                }
            }
        };
    }

    const bestCommandPilot = playable
        .filter((card) => card.cardType === 'command' && unitWithoutPilot?.unit?.carduid)
        .map((card) => {
            const ruleList = Array.isArray(card?.cardData?.effects?.rules) ? card.cardData.effects.rules : [];
            const hasDesignatePilot = ruleList.some((rule) => getEffectPlayMode(rule as any) === 'designate_pilot');
            return { ...card, hasDesignatePilot };
        })
        .filter((card) => card.hasDesignatePilot)
        .sort((a, b) => b.cost - a.cost)[0];
    if (bestCommandPilot && unitWithoutPilot?.unit?.carduid) {
        return {
            kind: 'playCard',
            reason: 'pair_command_pilot',
            payload: {
                action: {
                    type: 'PlayCard',
                    carduid: bestCommandPilot.carduid,
                    playAs: 'pilot',
                    targetUnit: unitWithoutPilot.unit.carduid
                }
            }
        };
    }

    const bestCommand = playable
        .filter((card) => card.cardType === 'command')
        .sort((a, b) => b.cost - a.cost)[0];
    if (bestCommand) {
        return {
            kind: 'playCard',
            reason: 'spend_command',
            payload: {
                action: {
                    type: 'PlayCard',
                    carduid: bestCommand.carduid,
                    playAs: 'command'
                }
            }
        };
    }

    return null;
}
