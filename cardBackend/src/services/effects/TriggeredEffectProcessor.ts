// src/services/effects/TriggeredEffectProcessor.ts
// Shared executor for simple "triggered" effects sourced from a single card (unit/pilot/base).

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { BaseCard, PilotZoneCard, UnitZoneCard } from '../../models/CardSystem';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from './EffectRuleCatalog';
import { EffectExecutor } from './EffectExecutor';
import { ContinuousEffectManager } from '../ContinuousEffectManager';
import { DeployTargetManager } from '../DeployTargetManager';

type SourceCard = UnitZoneCard | PilotZoneCard | BaseCard;

export class TriggeredEffectProcessor {
    static processForSourceCard(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCard: SourceCard,
        config: {
            trigger: string;
            expectedTriggers: string[];
            fallbackEffectId: string;
            defaultTargetScope?: string;
            cardPlayNotificationId?: string;
            includePairedMetadata?: {
                pairedSlot: string;
                sourceCarduid: string;
            };
        }
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        const collected = EffectRuleCatalog.collectEffects((sourceCard as any).cardData, {
            trigger: config.trigger,
            fallbackEffectId: config.fallbackEffectId,
            expectedTriggers: config.expectedTriggers,
            requireAction: true,
            defaultTargetScope: config.defaultTargetScope || 'self',
            includePairedMetadata: config.includePairedMetadata
        });

        for (const effectRule of collected) {
            const normalized = ensureEffectDefaults({ ...effectRule }) as EffectDefinition;

            if (!ContinuousEffectManager.sourceConditionsMet(normalized, sourceCard as any, gameEnv, sourcePlayerId)) {
                continue;
            }

            if (!ContinuousEffectManager.validateEffectConditions(normalized, gameEnv, sourcePlayerId, sourceCard as any)) {
                continue;
            }

            const action = EffectExecutor.getEffectAction(normalized);
            if (!action) {
                continue;
            }

            const result = EffectExecutor.actionSupportsNoTargets(action)
                ? EffectExecutor.applyEffectToTargets(gameEnv, normalized, [], sourcePlayerId, sourceCard.carduid)
                : DeployTargetManager.processEffectWithTargetChoice(
                      gameEnv,
                      sourcePlayerId,
                      sourceCard.carduid,
                      normalized,
                      config.cardPlayNotificationId
                  );

            if (!result.success) {
                return { success: false, error: result.error || `Failed to apply triggered effect ${normalized.effectId}` };
            }

            if ((result as any).requiresSelection) {
                return { success: true, requiresSelection: true };
            }
        }

        return { success: true };
    }
}
