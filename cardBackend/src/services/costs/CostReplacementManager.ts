import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

type ReplaceCostRule = {
    action?: string;
    trigger?: string;
    optional?: boolean;
    parameters?: Record<string, unknown>;
};

export class CostReplacementManager {
    static augmentRestBaseTargets(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        availableTargets: TargetReference[]
    ): TargetReference[] {
        const action = typeof effect.action === 'string' ? effect.action : '';
        const targetType = typeof effect.target?.type === 'string' ? effect.target.type : '';
        const targetScope = typeof effect.target?.scope === 'string' ? effect.target.scope : '';
        if (action !== 'rest' || targetType !== 'base') {
            return availableTargets;
        }

        if (!targetScope || !targetScope.toLowerCase().startsWith('self')) {
            return availableTargets;
        }

        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid);
        if (!sourceCard?.cardData || sourceCard.cardData.cardType !== 'unit') {
            return availableTargets;
        }

        const sourceOwner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!sourceOwner.found || sourceOwner.playerId !== playerId) {
            return availableTargets;
        }

        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) {
            return availableTargets;
        }

        const replacementTargets: TargetReference[] = [];

        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot?.unit?.carduid) {
                continue;
            }

            const unit = slotResult.slot.unit;
            if (unit.isRested) {
                continue;
            }

            const rules = Array.isArray(unit.cardData?.effects?.rules)
                ? (unit.cardData.effects.rules as ReplaceCostRule[])
                : [];
            if (rules.length === 0) {
                continue;
            }

            const supportsReplacement = rules.some(rule => this.isRestBaseReplacementRule(rule));
            if (!supportsReplacement) {
                continue;
            }

            replacementTargets.push({
                carduid: unit.carduid,
                zone: slotName,
                playerId,
                cardData: unit.cardData
            });
        }

        if (replacementTargets.length === 0) {
            return availableTargets;
        }

        const existing = new Set(availableTargets.map(target => `${target.playerId}:${target.zone}:${target.carduid}`));
        const merged = [...availableTargets];
        for (const replacement of replacementTargets) {
            const key = `${replacement.playerId}:${replacement.zone}:${replacement.carduid}`;
            if (existing.has(key)) {
                continue;
            }
            merged.push(replacement);
        }

        return merged;
    }

    private static isRestBaseReplacementRule(rule: ReplaceCostRule): boolean {
        if (rule?.action !== 'replace_cost') {
            return false;
        }

        if (rule.trigger && String(rule.trigger).toLowerCase() !== 'continuous') {
            return false;
        }

        const parameters = rule.parameters || {};
        const replace = parameters.replace && typeof parameters.replace === 'object'
            ? (parameters.replace as Record<string, unknown>)
            : null;
        if (!replace) {
            return false;
        }

        const from = replace.from && typeof replace.from === 'object'
            ? (replace.from as Record<string, unknown>)
            : null;
        const to = replace.to && typeof replace.to === 'object'
            ? (replace.to as Record<string, unknown>)
            : null;
        if (!from || !to) {
            return false;
        }

        const fromType = typeof from.type === 'string' ? from.type : '';
        const fromTarget = typeof from.target === 'string' ? from.target : '';
        const fromSource = typeof from.source === 'string' ? from.source : '';
        const toType = typeof to.type === 'string' ? to.type : '';
        const toTarget = typeof to.target === 'string' ? to.target : '';

        return (
            fromType === 'rest' &&
            fromTarget === 'friendly_base' &&
            fromSource === 'friendly_unit_effect' &&
            toType === 'rest' &&
            toTarget === 'self'
        );
    }
}
