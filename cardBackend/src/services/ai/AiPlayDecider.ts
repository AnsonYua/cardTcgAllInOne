import type { AiDecision } from './AiTypes';
import { SLOT_NAMES } from './AiTypes';
import { UnitRestrictionUtils } from '../restrictions/UnitRestrictionUtils';
import { getAvailableEnergyCount, getTotalEnergyCount } from './AiEnergyUtils';

export function findBestPlayCard(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const self = gameEnvView?.players?.[aiPlayerId];
    const hand = Array.isArray(self?.deck?.hand) ? self.deck.hand : [];
    if (hand.length === 0) {
        return null;
    }

    const zones = self?.zones || {};
    const availableEnergy = getAvailableEnergyCount(self);
    const totalEnergy = getTotalEnergyCount(self);
    const hasBase = Array.isArray(zones.base) && zones.base.length > 0;
    const emptyUnitSlots = SLOT_NAMES.filter((slotName) => !zones?.[slotName]?.unit);
    const unitWithoutPilot = SLOT_NAMES
        .map((slotName) => zones?.[slotName])
        .find((slot) => slot?.unit && !slot?.pilot && !UnitRestrictionUtils.cannotBePairedWithPilot(slot.unit as any));

    const playable = hand
        .map((card: any) => {
            const cardData = card?.cardData || {};
            const effectiveCostRaw = cardData?.effectiveCost ?? cardData?.cost ?? 0;
            const effectiveLevelRaw = cardData?.effectiveLevel ?? cardData?.level ?? 0;
            const cost = Number.isFinite(Number(effectiveCostRaw)) ? Number(effectiveCostRaw) : 0;
            const level = Number.isFinite(Number(effectiveLevelRaw)) ? Number(effectiveLevelRaw) : 0;
            const cardType = cardData?.cardType;
            return {
                carduid: card?.carduid,
                cardType,
                cost,
                level,
                cardData
            };
        })
        .filter((card: any) =>
            typeof card.carduid === 'string'
            && typeof card.cardType === 'string'
            && card.cost <= availableEnergy
            && card.level <= totalEnergy
        );

    const bestBase = playable.find((card: any) => card.cardType === 'base');
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
        .filter((card: any) => card.cardType === 'unit' && emptyUnitSlots.length > 0)
        .sort((a: any, b: any) => b.cost - a.cost)[0];
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
        .filter((card: any) => card.cardType === 'pilot' && unitWithoutPilot?.unit?.carduid)
        .sort((a: any, b: any) => b.cost - a.cost)[0];
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
        .filter((card: any) => card.cardType === 'command' && unitWithoutPilot?.unit?.carduid)
        .map((card: any) => {
            const ruleList = Array.isArray(card?.cardData?.effects?.rules) ? card.cardData.effects.rules : [];
            const hasDesignatePilot = ruleList.some((rule: any) => rule?.action === 'designate_pilot');
            return { ...card, hasDesignatePilot };
        })
        .filter((card: any) => card.hasDesignatePilot)
        .sort((a: any, b: any) => b.cost - a.cost)[0];
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
        .filter((card: any) => card.cardType === 'command')
        .sort((a: any, b: any) => b.cost - a.cost)[0];
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
