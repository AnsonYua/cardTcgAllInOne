import { GameEnvironment } from '../../models/GameEnvironment';
import { TargetFilters, TargetReference, TargetScope, TargetType, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { normalizeTargetConfig, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { PlayerCardManager } from '../PlayerCardManager';
import { HandTargetResolver } from './HandTargetResolver';
import { EnergyTargetResolver } from './EnergyTargetResolver';
import { LinkUtils } from '../../utils/LinkUtils';
import { TrashTargetResolver } from './TrashTargetResolver';
import { TargetFilterUtils } from './TargetFilterUtils';
import { BaseTargetResolver } from './BaseTargetResolver';
import { TargetNumericFilterUtils } from './TargetNumericFilterUtils';
import { TargetCountUtils } from './TargetCountUtils';
import { TargetKeywordFilterUtils } from './TargetKeywordFilterUtils';
import { TargetStateFilterUtils } from './TargetStateFilterUtils';
import { getSlotTotals } from '../../utils/FieldValueCalculator';
import { DynamicComparisonFilterResolver } from './filters/DynamicComparisonFilterResolver';

export interface ResolvedTargetConfig {
    type: TargetType;
    scope: TargetScope;
    count: number;
    filters: TargetFilters;
}

export interface DynamicTargetFilterContext {
    previousTargets?: TargetReference[];
}

export class TargetResolver {
    private static readonly DEFAULT_TARGET_TYPE: TargetType = 'unit';
    private static readonly DEFAULT_TARGET_SCOPE: TargetScope = 'opponent';
    private static readonly DEFAULT_TARGET_COUNT = 1;

    static resolveTargetConfig(effect: EffectDefinition): ResolvedTargetConfig {
        const normalizedTarget = normalizeTargetConfig(effect.target, {
            scope: this.DEFAULT_TARGET_SCOPE,
            type: this.DEFAULT_TARGET_TYPE,
            count: this.DEFAULT_TARGET_COUNT
        });

        const type = (normalizedTarget?.type as TargetType) || this.DEFAULT_TARGET_TYPE;
        const scope = (normalizedTarget?.scope as TargetScope) || this.DEFAULT_TARGET_SCOPE;
        const count = TargetCountUtils.resolveMaxCount(normalizedTarget?.count, this.DEFAULT_TARGET_COUNT);
        const filters: TargetFilters = normalizedTarget?.filters ? { ...normalizedTarget.filters } : {};
        if (normalizedTarget?.zone) {
            filters.zone = normalizedTarget.zone;
        }

        return {
            type,
            scope,
            count,
            filters
        };
    }

    static generateAvailableTargets(
        gameEnv: GameEnvironment,
        playerId: string,
        targetConfig: ResolvedTargetConfig,
        sourceCarduid?: string,
        dynamicContext?: DynamicTargetFilterContext
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        console.log(`🔍 Generating targets for config:`, JSON.stringify(targetConfig, null, 2));

        const scopeValue = typeof targetConfig.scope === 'string' ? targetConfig.scope.toLowerCase() : '';
        const isShieldScope = scopeValue.includes('shield') || targetConfig.type === 'shield';
        const isHandScope = scopeValue.includes('hand');
        const isEnergyScope = targetConfig.type === 'energy' || scopeValue.includes('resource') || scopeValue.includes('energy');
        const isTrashScope = scopeValue.includes('trash');
        const filteredCardType = typeof (targetConfig.filters as any)?.cardType === 'string'
            ? (((targetConfig.filters as any).cardType as string) || '').toLowerCase()
            : '';
        const isBaseScope =
            targetConfig.type === 'base' ||
            scopeValue.includes('base') ||
            (targetConfig.type === 'card' && filteredCardType === 'base');

        if (isShieldScope) {
            const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
            for (const targetPlayerId of targetPlayerIds) {
                const player = gameEnv.getPlayer(targetPlayerId);
                if (!player) {
                    continue;
                }
                const shieldCards = player.getShieldCards();
                console.log(`🛡️ Found ${shieldCards.length} shield cards for player ${targetPlayerId}`);

                for (let i = 0; i < shieldCards.length; i++) {
                    const shieldCard = shieldCards[i];
                    targets.push({
                        carduid: shieldCard.carduid,
                        zone: 'shield',
                        playerId: targetPlayerId,
                        cardData: shieldCard.cardData as any
                    });
                }
            }
        } else if (isHandScope) {
            const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
            targets.push(...HandTargetResolver.generateHandTargets(gameEnv, targetPlayerIds, targetConfig));
        } else if (isTrashScope) {
            const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
            targets.push(...TrashTargetResolver.generateTrashTargets(gameEnv, targetPlayerIds, targetConfig));
        } else if (isEnergyScope) {
            const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
            targets.push(...EnergyTargetResolver.generateEnergyTargets(gameEnv, targetPlayerIds, targetConfig));
        } else if (isBaseScope) {
            const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);
            targets.push(...BaseTargetResolver.generateBaseTargets(gameEnv, targetPlayerIds, targetConfig));
        } else {
            const targetPlayerIds = this.getTargetPlayerIds(gameEnv, playerId, targetConfig.scope);

            for (const targetPlayerId of targetPlayerIds) {
                const player = gameEnv.getPlayer(targetPlayerId);
                if (!player) {
                    console.error(`❌ Target player ${targetPlayerId} not found`);
                    continue;
                }

                console.log(`🎯 Searching player ${targetPlayerId} for valid targets`);

                const zonesToSearch = targetConfig.filters.zone || SLOT_ZONES;

                for (const slotName of zonesToSearch) {
                    const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
                    if (!slotResult.isValid || !slotResult.slot) {
                        console.log(`⚠️ Skipping invalid slot ${slotName}: ${slotResult.error}`);
                        continue;
                    }

                    const slotZone = slotResult.slot;

                    const wantsUnit =
                        targetConfig.type === 'unit' ||
                        (targetConfig.type === 'card' && filteredCardType === 'unit');
                    const wantsPilot =
                        targetConfig.type === 'pilot' ||
                        (targetConfig.type === 'card' && filteredCardType === 'pilot');

                    if (wantsUnit && SlotZoneUtils.hasUnit(slotZone)) {
                        const unit = SlotZoneUtils.getUnit(slotZone);
                        if (unit && this.validateTargetFilters(
                            gameEnv,
                            unit,
                            targetConfig.filters || {},
                            targetPlayerId,
                            sourceCarduid,
                            slotName,
                            dynamicContext
                        )) {
                            targets.push({
                                carduid: unit.carduid,
                                zone: slotName,
                                playerId: targetPlayerId,
                                cardData: unit.cardData,
                                computed: getSlotTotals(slotZone)
                            });
                            console.log(`✅ Added unit target: ${unit.carduid} in ${slotName}`);
                        }
                    }

                    if (wantsPilot && slotZone.pilot) {
                        const pilot = slotZone.pilot;
                        if (this.validateTargetFilters(
                            gameEnv,
                            pilot,
                            targetConfig.filters || {},
                            targetPlayerId,
                            sourceCarduid,
                            slotName,
                            dynamicContext
                        )) {
                            targets.push({
                                carduid: pilot.carduid,
                                zone: slotName,
                                playerId: targetPlayerId,
                                cardData: pilot.cardData
                            });
                            console.log(`✅ Added pilot target: ${pilot.carduid} in ${slotName}`);
                        }
                    }
                }
            }
        }

        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }

    private static getTargetPlayerIds(gameEnv: GameEnvironment, playerId: string, scope: TargetScope): string[] {
        const scopeValue = typeof scope === 'string' ? scope.toLowerCase() : '';

        if (scopeValue === 'any' || scopeValue === 'all' || scopeValue.startsWith('any')) {
            return Object.keys(gameEnv.players);
        }

        if (scopeValue.startsWith('self')) {
            return [playerId];
        }

        if (scopeValue.startsWith('opponent')) {
            const opponentId = gameEnv.getOpponentId(playerId);
            return opponentId ? [opponentId] : [];
        }

        console.log(`⚠️ Unknown target scope: ${scope}`);
        return [];
    }

    private static validateTargetFilters(
        gameEnv: GameEnvironment,
        card: UnitZoneCard | PilotZoneCard,
        filters: TargetFilters = {},
        targetPlayerId?: string,
        sourceCarduid?: string,
        slotNameHint?: string,
        dynamicContext?: DynamicTargetFilterContext
    ): boolean {
        const cardType = typeof (card as any)?.cardData?.cardType === 'string'
            ? ((card as any).cardData.cardType as string).toLowerCase()
            : '';
        if (cardType === 'unit') {
            const currentHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, card.carduid).totalHP;
            if (currentHp <= 0) {
                console.log(`❌ Card ${card.carduid} excluded from targets: destroyed (HP ${currentHp})`);
                return false;
            }
        }

        const excludeCarduids = Array.isArray(filters.excludeCarduids)
            ? filters.excludeCarduids.filter((id): id is string => typeof id === 'string')
            : [];
        if (excludeCarduids.length > 0 && excludeCarduids.includes(card.carduid)) {
            return false;
        }
        if (filters.excludeSelf === true && typeof sourceCarduid === 'string' && sourceCarduid.length > 0 && card.carduid === sourceCarduid) {
            return false;
        }

        if (filters.ap !== undefined) {
            const apResult = TargetNumericFilterUtils.evaluateApFilter(gameEnv, card, filters.ap);
            if (!apResult.ok) {
                console.log(`❌ Card ${card.carduid} failed AP filter: ${filters.ap} (actual ${apResult.actual})`);
                return false;
            }
        }

        if (filters.level !== undefined) {
            const cardLevel = card.cardData?.level || 0;
            if (typeof filters.level === 'number') {
                if (cardLevel !== filters.level) {
                    console.log(`❌ Card ${card.carduid} failed level filter: ${filters.level}`);
                    return false;
                }
            } else if (typeof filters.level === 'string') {
                const resolvedFilter = DynamicComparisonFilterResolver.resolve(
                    filters.level,
                    gameEnv,
                    sourceCarduid,
                    dynamicContext
                );
                if (!resolvedFilter) {
                    console.log(`❌ Card ${card.carduid} failed level filter: ${filters.level}`);
                    return false;
                }
                if (!validateComparisonFilter(cardLevel, resolvedFilter)) {
                    console.log(`❌ Card ${card.carduid} failed level filter: ${resolvedFilter}`);
                    return false;
                }
            } else {
                console.log(`⚠️ Unsupported level filter type for ${card.carduid}: ${String(filters.level)}`);
                return false;
            }
        }

        if (filters.hp) {
            const currentHp = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, card.carduid).totalHP;
            if (!validateComparisonFilter(currentHp, filters.hp)) {
                console.log(`❌ Card ${card.carduid} failed HP filter: ${filters.hp}`);
                return false;
            }
        }

        if (typeof filters.damaged === 'boolean') {
            const damagedResult = TargetStateFilterUtils.validateDamagedFilter(gameEnv, card, filters.damaged);
            if (!damagedResult.ok) {
                console.log(`❌ Card ${card.carduid} failed damaged filter: ${damagedResult.reason || 'unknown'}`);
                return false;
            }
        }

        if (filters.status) {
            const cardStatus = card.isRested ? 'rested' : 'active';
            if (cardStatus !== filters.status) {
                console.log(`❌ Card ${card.carduid} failed status filter: expected ${filters.status}, got ${cardStatus}`);
                return false;
            }
        }
        if (typeof (filters as any).isRested === 'boolean') {
            if ((card.isRested === true) !== ((filters as any).isRested === true)) {
                return false;
            }
        }

        const cardColor = typeof (card.cardData as any)?.color === 'string' ? ((card.cardData as any).color as string) : undefined;
        const colorResult = TargetFilterUtils.validateColorFilter(cardColor, filters);
        if (!colorResult.ok) {
            console.log(`❌ Card ${card.carduid} failed color filter: ${colorResult.reason ?? 'unknown'}`);
            return false;
        }

        const hasTraitFilters =
            (Array.isArray(filters.traits) && filters.traits.length > 0) ||
            (Array.isArray(filters.traitsAny) && filters.traitsAny.length > 0) ||
            (Array.isArray(filters.traitsAll) && filters.traitsAll.length > 0);
        if (hasTraitFilters) {
            const cardTraits = Array.isArray(card.cardData?.traits) ? card.cardData.traits : [];
            const traitResult = TargetFilterUtils.validateTraitFilters(cardTraits, filters);
            if (!traitResult.ok) {
                console.log(`❌ Card ${card.carduid} failed trait filter: ${traitResult.reason}`);
                return false;
            }
        }

        if (filters.linkStatus) {
            const desiredStatus = typeof filters.linkStatus === 'string'
                ? filters.linkStatus.toLowerCase()
                : '';
            const isLinked = this.isUnitLinked(gameEnv, card, targetPlayerId);
            if (desiredStatus === 'linked' && !isLinked) {
                console.log(`❌ Card ${card.carduid} failed linkStatus filter: expected linked`);
                return false;
            }
            if (desiredStatus === 'unlinked' && isLinked) {
                console.log(`❌ Card ${card.carduid} failed linkStatus filter: expected unlinked`);
                return false;
            }
        }

        const slotContext = this.resolveSlotContext(gameEnv, card, targetPlayerId, slotNameHint);

        if (typeof (filters as any).pairedPilot === 'string') {
            const pairedPilotFilter = String((filters as any).pairedPilot).toLowerCase();
            const hasPairedPilot = Boolean(slotContext?.slot?.pilot);
            if (pairedPilotFilter === 'any' && !hasPairedPilot) {
                return false;
            }
            if (pairedPilotFilter === 'none' && hasPairedPilot) {
                return false;
            }
        }

        if (typeof (filters as any).pairedPilotTrait === 'string') {
            const expectedTrait = String((filters as any).pairedPilotTrait);
            const pilotTraits = Array.isArray(slotContext?.slot?.pilot?.cardData?.traits)
                ? slotContext!.slot.pilot.cardData.traits
                : [];
            if (!pilotTraits.includes(expectedTrait)) {
                return false;
            }
        }

        if ((filters as any).pairedUnitLevel !== undefined) {
            const pairedUnitLevelFilter = (filters as any).pairedUnitLevel;
            const pairedUnit = slotContext?.slot?.unit;
            const level = this.getEffectiveUnitLevel(pairedUnit);
            if (typeof level !== 'number') {
                return false;
            }
            if (typeof pairedUnitLevelFilter === 'number') {
                if (level !== pairedUnitLevelFilter) {
                    return false;
                }
            } else if (typeof pairedUnitLevelFilter === 'string') {
                if (!validateComparisonFilter(level, pairedUnitLevelFilter)) {
                    return false;
                }
            } else {
                return false;
            }
        }

        if (typeof (filters as any).isBattling === 'boolean') {
            const expectedBattling = (filters as any).isBattling === true;
            const battle = gameEnv.currentBattle;
            const unitCarduid = slotContext?.slot?.unit?.carduid;
            const isBattling = Boolean(
                unitCarduid &&
                battle &&
                (battle.attackerCarduid === unitCarduid || battle.targetCarduid === unitCarduid)
            );
            if (isBattling !== expectedBattling) {
                return false;
            }
        }

        if (typeof (filters as any).isLinkUnit === 'boolean') {
            const linked = LinkUtils.isLinkedPair(slotContext?.slot?.unit, slotContext?.slot?.pilot);
            if (linked !== ((filters as any).isLinkUnit === true)) {
                return false;
            }
        }

        const keywordResult = TargetKeywordFilterUtils.validateKeywordFilters(card, filters);
        if (!keywordResult.ok) {
            console.log(`❌ Card ${card.carduid} failed keyword filter: ${keywordResult.reason ?? 'unknown'}`);
            return false;
        }

        return true;
    }

    private static resolveSlotContext(
        gameEnv: GameEnvironment,
        card: UnitZoneCard | PilotZoneCard,
        targetPlayerId?: string,
        slotNameHint?: string
    ): { slot: any; slotName: string } | null {
        if (!targetPlayerId) {
            return null;
        }

        const player = gameEnv.getPlayer(targetPlayerId);
        if (!player?.zones) {
            return null;
        }

        if (slotNameHint) {
            const hinted = SlotZoneUtils.getSlotZone(player.zones, slotNameHint);
            if (hinted.isValid && hinted.slot) {
                const matchesHinted =
                    hinted.slot.unit?.carduid === card.carduid ||
                    hinted.slot.pilot?.carduid === card.carduid;
                if (matchesHinted) {
                    return { slot: hinted.slot, slotName: slotNameHint };
                }
            }
        }

        for (const slotName of SLOT_ZONES) {
            const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotName);
            if (!slotResult.isValid || !slotResult.slot) {
                continue;
            }
            if (slotResult.slot.unit?.carduid === card.carduid || slotResult.slot.pilot?.carduid === card.carduid) {
                return { slot: slotResult.slot, slotName };
            }
        }

        return null;
    }

    private static getEffectiveUnitLevel(unit: UnitZoneCard | null | undefined): number | null {
        if (!unit) {
            return null;
        }
        const baseLevel = typeof unit?.cardData?.level === 'number' ? unit.cardData.level : 0;
        const levelModifier = typeof (unit as any)?.modifyLevel === 'number' ? (unit as any).modifyLevel : 0;
        return baseLevel + levelModifier;
    }

    private static isUnitLinked(
        gameEnv: GameEnvironment,
        card: UnitZoneCard | PilotZoneCard,
        targetPlayerId?: string
    ): boolean {
        if (!targetPlayerId) {
            return false;
        }

        const slotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, targetPlayerId, card.carduid);
        if (!slotResult.found || !slotResult.unit || !slotResult.pilot) {
            return false;
        }

        return LinkUtils.isLinkedPair(slotResult.unit, slotResult.pilot);
    }
}
