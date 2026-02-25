import { CardDatabaseManager } from '../../models/CardSystem';
import { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { EnergyManager } from '../EnergyManager';
import type { EnergyRequirement } from '../../utils/EnergyUtils';

type DeployAffordabilityResult = {
    isAffordable: boolean;
    effectiveCost: number;
    effectiveLevel: number;
    reason?: string;
    cardData?: any;
    effectiveRequirements: EnergyRequirement;
};

function normalizeZoneName(zone: string | undefined): string {
    const normalized = String(zone || '').toLowerCase();
    if (normalized === 'trasharea' || normalized === 'trash') return 'trash';
    if (normalized === 'hand') return 'hand';
    return normalized;
}

function applySelfZoneContinuousModifiers(cardData: any, zone: string): { effectiveCost: number; effectiveLevel: number } {
    const baseCostRaw = Number(cardData?.cost ?? 0);
    const baseLevelRaw = Number(cardData?.level ?? 0);
    let effectiveCost = Number.isFinite(baseCostRaw) ? baseCostRaw : 0;
    let effectiveLevel = Number.isFinite(baseLevelRaw) ? baseLevelRaw : 0;

    const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    const expectedScope = `self_${zone}`;

    for (const rule of rules) {
        if (!rule || typeof rule !== 'object') continue;
        const ruleType = String((rule as any).type || '').toLowerCase();
        const trigger = String((rule as any).trigger || '').toLowerCase();
        const action = String((rule as any).action || '').toLowerCase();
        const scope = String((rule as any).target?.scope || '').toLowerCase();

        if (ruleType !== 'continuous' || trigger !== 'continuous') continue;
        if (scope !== expectedScope) continue;

        const deltaRaw = Number((rule as any).parameters?.value ?? 0);
        const delta = Number.isFinite(deltaRaw) ? deltaRaw : 0;

        if (action === 'modifycost') {
            effectiveCost = Math.max(0, effectiveCost + delta);
        }
        if (action === 'modifylevel') {
            effectiveLevel = Math.max(0, effectiveLevel + delta);
        }
    }

    return { effectiveCost, effectiveLevel };
}

export class DeployAffordabilityEvaluator {
    static evaluate(
        gameEnv: GameEnvironment,
        playerId: string,
        target: TargetReference,
        effect: EffectDefinition,
        _sourceCarduid?: string
    ): DeployAffordabilityResult {
        const payCost = effect.parameters?.payCost === true;
        const carduid = target.carduid;
        const cardId = typeof carduid === 'string' ? carduid.split('_')[0] : '';
        const cardData = target.cardData || CardDatabaseManager.getCardDetails(cardId);

        if (!cardData || cardData.cardType !== 'unit') {
            return {
                isAffordable: false,
                effectiveCost: 0,
                effectiveLevel: 0,
                effectiveRequirements: { level: 0, cost: 0 },
                reason: 'not_unit_card'
            };
        }

        const zone = normalizeZoneName(target.zone);
        const modified = applySelfZoneContinuousModifiers(cardData, zone);
        const effectiveRequirements: EnergyRequirement = {
            level: modified.effectiveLevel,
            cost: modified.effectiveCost
        };

        if (!payCost) {
            return {
                isAffordable: true,
                effectiveCost: modified.effectiveCost,
                effectiveLevel: modified.effectiveLevel,
                effectiveRequirements,
                cardData
            };
        }

        const validation = EnergyManager.validateEnergyForRequirements(gameEnv, playerId, effectiveRequirements, {
            fromBurst: false
        });

        return {
            isAffordable: validation.isValid,
            effectiveCost: modified.effectiveCost,
            effectiveLevel: modified.effectiveLevel,
            effectiveRequirements,
            reason: validation.isValid ? undefined : validation.error,
            cardData
        };
    }
}

