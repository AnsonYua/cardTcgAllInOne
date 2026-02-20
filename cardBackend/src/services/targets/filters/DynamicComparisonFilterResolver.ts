import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

interface DynamicTargetFilterContext {
    previousTargets?: TargetReference[];
}

export class DynamicComparisonFilterResolver {
    static resolve(
        rawFilter: string,
        gameEnv: GameEnvironment,
        sourceCarduid?: string,
        dynamicContext?: DynamicTargetFilterContext
    ): string | null {
        if (!rawFilter) {
            return null;
        }

        const sourceMatch = rawFilter.match(/^(<=|>=|<|>|==|!=)\s*(SOURCE_LEVEL|sourceLevel)$/);
        if (sourceMatch) {
            if (!sourceCarduid) {
                console.log(`⚠️ Cannot resolve ${rawFilter} without sourceCarduid`);
                return null;
            }

            const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as any;
            const sourceLevel = typeof sourceCard?.cardData?.level === 'number' ? (sourceCard.cardData.level as number) : null;
            if (sourceLevel === null) {
                console.log(`⚠️ Cannot resolve ${rawFilter}: source ${sourceCarduid} has no level`);
                return null;
            }

            return `${sourceMatch[1]}${sourceLevel}`;
        }

        const attackerMatch = rawFilter.match(/^(<=|>=|<|>|==|!=)\s*(EVENT_ATTACKER_LEVEL|eventAttackerLevel)$/);
        if (attackerMatch) {
            const attackerCarduid = this.getEventAttackerCarduid(gameEnv);
            if (!attackerCarduid) {
                console.log(`⚠️ Cannot resolve ${rawFilter}: event attacker not found`);
                return null;
            }

            const attacker = SlotZoneUtils.getCardByUid(gameEnv, attackerCarduid) as any;
            const attackerLevel = typeof attacker?.cardData?.level === 'number' ? (attacker.cardData.level as number) : null;
            if (attackerLevel === null) {
                console.log(`⚠️ Cannot resolve ${rawFilter}: attacker ${attackerCarduid} has no level`);
                return null;
            }

            return `${attackerMatch[1]}${attackerLevel}`;
        }

        const restedUnitMatch = rawFilter.match(/^(<=|>=|<|>|==|!=)\s*(RESTED_UNIT_LEVEL|restedUnitLevel)$/);
        if (restedUnitMatch) {
            const previousTargets = Array.isArray(dynamicContext?.previousTargets)
                ? dynamicContext.previousTargets
                : [];
            const restedUnitRef = previousTargets.find(target => typeof target?.carduid === 'string');
            if (!restedUnitRef?.carduid) {
                console.log(`⚠️ Cannot resolve ${rawFilter}: rested unit context is missing`);
                return null;
            }

            const restedUnit = SlotZoneUtils.getCardByUid(gameEnv, restedUnitRef.carduid) as any;
            const restedUnitLevel = typeof restedUnit?.cardData?.level === 'number'
                ? (restedUnit.cardData.level as number)
                : null;
            if (restedUnitLevel === null) {
                console.log(`⚠️ Cannot resolve ${rawFilter}: rested target ${restedUnitRef.carduid} has no level`);
                return null;
            }

            return `${restedUnitMatch[1]}${restedUnitLevel}`;
        }

        return rawFilter;
    }

    private static getEventAttackerCarduid(gameEnv: GameEnvironment): string | null {
        const queue = Array.isArray((gameEnv as any).notificationQueue) ? ((gameEnv as any).notificationQueue as any[]) : [];
        const latest = queue.length > 0 ? queue[queue.length - 1] : null;
        const fromNotification = typeof latest?.payload?.attackerCarduid === 'string'
            ? latest.payload.attackerCarduid
            : null;
        if (fromNotification) {
            return fromNotification;
        }

        const battle = gameEnv.currentBattle as any;
        if (typeof battle?.attackerCarduid === 'string' && battle.attackerCarduid.length > 0) {
            return battle.attackerCarduid;
        }

        return null;
    }
}
