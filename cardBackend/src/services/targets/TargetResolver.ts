import { GameEnvironment } from '../../models/GameEnvironment';
import { TargetFilters, TargetReference, TargetScope, TargetType, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { SLOT_ZONES } from '../../config/gameConstants';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { normalizeTargetConfig, validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { PlayerCardManager } from '../PlayerCardManager';

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
        const countValue = normalizedTarget?.count;
        const count = typeof countValue === 'number' && countValue > 0
            ? countValue
            : this.DEFAULT_TARGET_COUNT;
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

        if (targetConfig.scope === 'self_shield') {
            const player = gameEnv.getPlayer(playerId);
            if (player) {
                const shieldCards = player.getShieldCards();
                console.log(`🛡️ Found ${shieldCards.length} shield cards for player ${playerId}`);

                for (let i = 0; i < Math.min(shieldCards.length, targetConfig.count); i++) {
                    const shieldCard = shieldCards[i];
                    targets.push({
                        carduid: shieldCard.carduid,
                        zone: 'shield',
                        playerId: playerId,
                        cardData: shieldCard as any
                    });
                }
            }
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

                    /*
                    if (targetConfig.type === 'pilot' && SlotZoneUtils.hasPilot(slotZone)) {
                        const pilot = SlotZoneUtils.getPilot(slotZone);
                        if (pilot && this.validateTargetFilters(gameEnv, pilot, targetConfig.filters || {}, targetPlayerId)) {
                            targets.push({
                                carduid: pilot.carduid,
                                zone: slotName,
                                playerId: targetPlayerId,
                                cardData: pilot.cardData
                            });
                            console.log(`✅ Added pilot target: ${pilot.carduid} in ${slotName}`);
                        }
                    }*/
                }
            }
        }

        console.log(`🎯 Generated ${targets.length} valid targets`);
        return targets;
    }

    private static getTargetPlayerIds(gameEnv: GameEnvironment, playerId: string, scope: TargetScope): string[] {
        switch (scope) {
            case 'self':
            case 'self_all_unit':
            case 'self_all':
            case 'self_unit':
            case 'self_shield':
                return [playerId];
            case 'opponent':
            case 'opponent_unit':
            case 'opponent_all_unit': {
                const opponentId = gameEnv.getOpponentId(playerId);
                return opponentId ? [opponentId] : [];
            }
            case 'any':
                return Object.keys(gameEnv.players);
            default:
                if (typeof scope === 'string') {
                    if (scope.startsWith('self')) {
                        return [playerId];
                    }
                    if (scope.startsWith('opponent')) {
                        const opponent = gameEnv.getOpponentId(playerId);
                        return opponent ? [opponent] : [];
                    }
                }
                console.log(`⚠️ Unknown target scope: ${scope}`);
                return [];
        }
    }

    private static validateTargetFilters(
        gameEnv: GameEnvironment,
        card: UnitZoneCard | PilotZoneCard,
        filters: TargetFilters = {},
        targetPlayerId?: string
    ): boolean {
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

        if (filters.traits && filters.traits.length > 0) {
            const cardTraits = card.cardData?.traits || [];
            const hasRequiredTrait = filters.traits.some((requiredTrait: string) =>
                cardTraits.some((cardTrait: string) => cardTrait === requiredTrait)
            );
            if (!hasRequiredTrait) {
                console.log(`❌ Card ${card.carduid} failed trait filter: required ${filters.traits}, has ${cardTraits}`);
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

        const unitLink = slotResult.unit.cardData?.link;
        if (!unitLink || !Array.isArray(unitLink) || unitLink.length === 0) {
            return false;
        }

        const pilot = slotResult.pilot as PilotZoneCard;
        let pilotNameForMatching: string | null = null;
        let pilotTraits: string[] = [];

        if (pilot.playedAs === 'pilot' && pilot.cardData?.cardType === 'command') {
            const designatePilotEffect = pilot.cardData?.effects?.rules?.find((rule: any) =>
                rule.action === 'designate_pilot'
            );
            if (designatePilotEffect?.parameters?.pilotName) {
                pilotNameForMatching = designatePilotEffect.parameters.pilotName as string;
            }
        } else {
            pilotNameForMatching = pilot.cardData?.name || null;
            pilotTraits = pilot.cardData?.traits || [];
        }

        if (pilotNameForMatching && unitLink.includes(pilotNameForMatching)) {
            return true;
        }

        return unitLink.some((linkValue: string) => pilotTraits.includes(linkValue));
    }
}
