import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, PlayCardEventData } from '../EventQueue/interfaces/GameEvent';
import { PairingEffectManager } from '../PairingEffectManager';
import { PairingGlobalEffectManager } from '../effects/PairingGlobalEffectManager';

type RehydrationResult = {
    pairedSlotsScanned: number;
    applied: number;
    warnings: string[];
};

const SLOT_IDS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
const REHYDRATABLE_TERMINAL_ACTIONS = new Set([
    'allow_attack_target',
    'grant_breach',
    'grant_keyword',
    'grant_keywords',
    'modifyAP',
    'modifyHP',
    'prevent_battle_damage',
    'prevent_effect_damage',
    'prevent_ap_reduction'
]);
const REHYDRATION_WRAPPER_ACTIONS = new Set(['sequence', 'conditional']);

export class TestStatePairingRehydrationService {
    static rehydratePairingDerivedEffects(gameEnv: GameEnvironment): RehydrationResult {
        const warnings: string[] = [];
        let pairedSlotsScanned = 0;
        let applied = 0;

        for (const [playerId, player] of Object.entries((gameEnv as any)?.players ?? {})) {
            const zones = (player as any)?.zones;
            if (!zones) continue;

            for (const slotId of SLOT_IDS) {
                const slot = zones?.[slotId];
                const unit = slot?.unit;
                const pilot = slot?.pilot;
                if (!unit || !pilot) {
                    continue;
                }

                pairedSlotsScanned += 1;

                try {
                    this.removeAllowAttackTargetTempsForSources(gameEnv, playerId, [unit.carduid, pilot.carduid]);

                    const eventData: PlayCardEventData = {
                        carduid: pilot.carduid,
                        playAs: 'pilot',
                        targetUnit: unit.carduid,
                        slotName: slotId
                    };
                    const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(eventData, gameEnv, playerId);
                    const pairEffects = Array.isArray(pairingEvent?.data?.effects)
                        ? pairingEvent.data.effects
                        : [];
                    const rehydratablePairEffects = pairEffects.filter((effect) => this.isRehydratablePairingEffect(effect));
                    if (pairEffects.length > rehydratablePairEffects.length) {
                        warnings.push(
                            `Skipped ${pairEffects.length - rehydratablePairEffects.length} non-derived pairing effect(s) for ${playerId}/${slotId}`
                        );
                    }
                    if (pairingEvent?.data && rehydratablePairEffects.length > 0) {
                        const result = PairingEffectManager.processPairingEffect(gameEnv, playerId, {
                            ...pairingEvent.data,
                            effects: rehydratablePairEffects
                        });
                        if (!result.success) {
                            warnings.push(`Pairing rehydrate failed for ${playerId}/${slotId}: ${result.error || 'unknown error'}`);
                            continue;
                        }

                        applied += result.effectsProcessed ?? rehydratablePairEffects.length;
                    }

                    const globalResult = PairingGlobalEffectManager.enqueueGlobalPairingTriggeredEffects(
                        gameEnv,
                        playerId,
                        {
                            pairedUnitColor: unit?.cardData?.color,
                            pairedUnitCarduid: unit?.carduid,
                            pairedPilotLevel: typeof pilot?.cardData?.level === 'number' ? pilot.cardData.level : undefined
                        },
                        {
                            effectFilter: (effect) => this.isRehydratablePairingEffect(effect)
                        }
                    );
                    if (!globalResult.success) {
                        warnings.push(`Global pairing rehydrate failed for ${playerId}/${slotId}: ${globalResult.error || 'unknown error'}`);
                    } else {
                        applied += globalResult.effectsQueued || 0;
                    }
                } catch (error) {
                    warnings.push(
                        `Pairing rehydrate exception for ${playerId}/${slotId}: ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        }

        return {
            pairedSlotsScanned,
            applied,
            warnings
        };
    }

    private static removeAllowAttackTargetTempsForSources(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduids: string[]
    ): number {
        const sourceSet = new Set(sourceCarduids.filter((v): v is string => typeof v === 'string' && v.length > 0));
        if (sourceSet.size === 0) return 0;

        const player = (gameEnv as any)?.players?.[sourcePlayerId];
        const zones = player?.zones;
        if (!zones) return 0;

        let removed = 0;

        for (const slotId of SLOT_IDS) {
            const slot = zones?.[slotId];
            for (const card of [slot?.unit, slot?.pilot]) {
                if (!card || !Array.isArray(card.temporaryEffects) || card.temporaryEffects.length === 0) {
                    continue;
                }
                const before = card.temporaryEffects.length;
                card.temporaryEffects = card.temporaryEffects.filter((temp: any) => {
                    if (!temp?.allowAttackTarget) return true;
                    const source = temp?.sourceCarduid;
                    return !(typeof source === 'string' && sourceSet.has(source));
                });
                removed += Math.max(0, before - card.temporaryEffects.length);
            }
        }

        return removed;
    }

    private static isRehydratablePairingEffect(effect: EffectDefinition | any): boolean {
        const terminalActions = this.collectTerminalActions(effect);
        if (terminalActions.length === 0) {
            return false;
        }
        return terminalActions.every((action) => REHYDRATABLE_TERMINAL_ACTIONS.has(action));
    }

    private static collectTerminalActions(effect: any): string[] {
        const found: string[] = [];
        const visit = (node: any): void => {
            if (!node || typeof node !== 'object') return;
            const action = typeof node.action === 'string' ? node.action : undefined;
            if (action) {
                if (!REHYDRATION_WRAPPER_ACTIONS.has(action)) {
                    found.push(action);
                }
            }
            const params = node.parameters;
            if (params && typeof params === 'object') {
                if (Array.isArray((params as any).steps)) {
                    for (const step of (params as any).steps) visit(step);
                }
                if (Array.isArray((params as any).then)) {
                    for (const step of (params as any).then) visit(step);
                }
                if (Array.isArray((params as any).else)) {
                    for (const step of (params as any).else) visit(step);
                }
            }
        };
        visit(effect);
        return found;
    }
}
