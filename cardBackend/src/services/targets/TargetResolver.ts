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

export interface ResolvedTargetConfig {
    type: TargetType;
    scope: TargetScope;
    count: number;
    filters: TargetFilters;
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
        targetConfig: ResolvedTargetConfig
    ): TargetReference[] {
        const targets: TargetReference[] = [];

        console.log(`🔍 Generating targets for config:`, JSON.stringify(targetConfig, null, 2));

        const scopeValue = typeof targetConfig.scope === 'string' ? targetConfig.scope.toLowerCase() : '';
        const isShieldScope = scopeValue.includes('shield') || targetConfig.type === 'shield';
        const isHandScope = scopeValue.includes('hand');
        const isEnergyScope = targetConfig.type === 'energy' || scopeValue.includes('resource') || scopeValue.includes('energy');
        const isTrashScope = scopeValue.includes('trash');
        const isBaseScope = targetConfig.type === 'base' || scopeValue.includes('base');

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
                        cardData: shieldCard as any
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

                    if (targetConfig.type === 'unit' && SlotZoneUtils.hasUnit(slotZone)) {
                        const unit = SlotZoneUtils.getUnit(slotZone);
                        if (unit && this.validateTargetFilters(gameEnv, unit, targetConfig.filters || {}, targetPlayerId)) {
                            targets.push({
                                carduid: unit.carduid,
                                zone: slotName,
                                playerId: targetPlayerId,
                                cardData: unit.cardData
                            });
                            console.log(`✅ Added unit target: ${unit.carduid} in ${slotName}`);
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
        targetPlayerId?: string
    ): boolean {
        const excludeCarduids = Array.isArray(filters.excludeCarduids)
            ? filters.excludeCarduids.filter((id): id is string => typeof id === 'string')
            : [];
        if (excludeCarduids.length > 0 && excludeCarduids.includes(card.carduid)) {
            return false;
        }

        if (filters.ap !== undefined) {
            const apResult = TargetNumericFilterUtils.evaluateApFilter(gameEnv, card, filters.ap);
            if (!apResult.ok) {
                console.log(`❌ Card ${card.carduid} failed AP filter: ${filters.ap} (actual ${apResult.actual})`);
                return false;
            }
        }

        if (filters.level) {
            const cardLevel = card.cardData?.level || 0;
            if (!validateComparisonFilter(cardLevel, filters.level)) {
                console.log(`❌ Card ${card.carduid} failed level filter: ${filters.level}`);
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

        if (filters.status) {
            const cardStatus = card.isRested ? 'rested' : 'active';
            if (cardStatus !== filters.status) {
                console.log(`❌ Card ${card.carduid} failed status filter: expected ${filters.status}, got ${cardStatus}`);
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

        const keywordResult = TargetKeywordFilterUtils.validateKeywordFilters(card, filters);
        if (!keywordResult.ok) {
            console.log(`❌ Card ${card.carduid} failed keyword filter: ${keywordResult.reason ?? 'unknown'}`);
            return false;
        }

        return true;
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
