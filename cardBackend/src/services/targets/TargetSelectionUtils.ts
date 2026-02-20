// src/services/targets/TargetSelectionUtils.ts

import type { EffectTargetConfig, TargetReference } from '../EventQueue/interfaces/GameEvent';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerCardManager } from '../PlayerCardManager';

export interface TargetSelectionContext {
    justLinkedUnitCarduid?: string;
}

export class TargetSelectionUtils {
    static excludeCarduid(
        targets: TargetReference[],
        excludedCarduid: string | undefined
    ): TargetReference[] {
        if (!excludedCarduid) {
            return targets;
        }
        return targets.filter(target => target.carduid !== excludedCarduid);
    }

    static applySelection(
        gameEnv: GameEnvironment,
        targets: TargetReference[],
        selection: EffectTargetConfig['selection'] | undefined,
        selectionContext?: TargetSelectionContext
    ): TargetReference[] {
        if (!selection || !selection.type) {
            return targets;
        }

        switch (selection.type) {
            case 'HIGHEST_LEVEL':
                return this.filterHighestLevelTargets(targets);
            case 'LOWEST_HP':
                return this.filterLowestHpTargets(gameEnv, targets);
            case 'JUST_LINKED':
                return this.filterJustLinkedTargets(targets, selectionContext?.justLinkedUnitCarduid);
            default:
                return targets;
        }
    }

    private static filterJustLinkedTargets(targets: TargetReference[], justLinkedUnitCarduid: string | undefined): TargetReference[] {
        if (!justLinkedUnitCarduid) {
            return [];
        }
        return targets.filter((target) => target.carduid === justLinkedUnitCarduid);
    }

    private static filterHighestLevelTargets(targets: TargetReference[]): TargetReference[] {
        if (targets.length <= 1) {
            return targets;
        }

        let highestLevel = -Infinity;
        for (const target of targets) {
            const level = typeof target.cardData?.level === 'number' ? target.cardData.level : 0;
            if (level > highestLevel) {
                highestLevel = level;
            }
        }

        return targets.filter(target => {
            const level = typeof target.cardData?.level === 'number' ? target.cardData.level : 0;
            return level === highestLevel;
        });
    }

    private static filterLowestHpTargets(gameEnv: GameEnvironment, targets: TargetReference[]): TargetReference[] {
        if (targets.length <= 1) {
            return targets;
        }

        let lowestHp = Infinity;
        const hpByCarduid = new Map<string, number>();

        for (const target of targets) {
            const carduid = target?.carduid;
            if (!carduid) {
                continue;
            }

            const computed = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, carduid).totalHP;
            const fallback = typeof target.cardData?.hp === 'number' ? target.cardData.hp : 0;
            const hp = computed > 0 ? computed : fallback;
            hpByCarduid.set(carduid, hp);
            if (hp < lowestHp) {
                lowestHp = hp;
            }
        }

        if (!Number.isFinite(lowestHp)) {
            return targets;
        }

        return targets.filter(target => {
            const hp = hpByCarduid.get(target.carduid);
            return typeof hp === 'number' ? hp === lowestHp : false;
        });
    }
}
