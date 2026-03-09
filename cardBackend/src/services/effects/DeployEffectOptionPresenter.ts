import { CardDatabaseManager } from '../../models/CardSystem';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { getEffectEventTrigger } from './timing/EffectTimingAccess';

/**
 * Centralized presenter for player-facing deploy effect option labels.
 * Keeps DeployEffectManager focused on orchestration, not UI copy building.
 */
export class DeployEffectOptionPresenter {
    static describe(effect: EffectDefinition, sourceCarduid?: string): string {
        const effectId = typeof effect.effectId === 'string' && effect.effectId.length > 0 ? effect.effectId : 'deploy_effect';
        const action = typeof effect.action === 'string' && effect.action.length > 0 ? effect.action : 'effect';
        const sequenceText = this.getEffectText(effect);
        const cardText = this.getDeployEffectCardText(effect, sourceCarduid);

        if (cardText) {
            return cardText;
        }

        if (action === 'conditionalTokenDeploy') {
            return this.describeConditionalTokenDeploy(effect) ?? 'Deploy token based on conditions';
        }

        if (sequenceText) {
            return sequenceText;
        }

        switch (action) {
            case 'draw':
                return 'Draw cards';
            case 'damage':
                return 'Deal damage';
            case 'heal':
                return 'Recover HP';
            case 'deploy':
                return 'Deploy a unit/token';
            case 'addToHand':
                return 'Add card to hand';
            case 'sequence':
                return 'Resolve this effect';
            default:
                return `${effectId} (${action})`;
        }
    }

    private static getDeployEffectCardText(effect: EffectDefinition, sourceCarduid?: string): string | undefined {
        if (typeof sourceCarduid !== 'string' || sourceCarduid.length === 0) return undefined;
        const sourceCard = CardDatabaseManager.getCardDetailsFromCarduid(sourceCarduid);
        const rules = Array.isArray(sourceCard?.effects?.rules) ? sourceCard.effects.rules : [];
        const descriptions = Array.isArray(sourceCard?.effects?.description) ? sourceCard.effects.description : [];
        if (rules.length === 0 || descriptions.length === 0) return undefined;

        const effectId = typeof effect?.effectId === 'string' ? effect.effectId : '';
        const action = typeof effect?.action === 'string' ? effect.action : '';
        const trigger = getEffectEventTrigger(effect) || '';

        let idx = rules.findIndex((rule: any) => {
            if (!rule || typeof rule !== 'object') return false;
            if (effectId && rule.effectId !== effectId) return false;
            if (action && rule.action !== action) return false;
            if (trigger && getEffectEventTrigger(rule) !== trigger) return false;
            return true;
        });

        if (idx < 0 && effectId) {
            idx = rules.findIndex((rule: any) => rule?.effectId === effectId);
        }

        if (idx < 0 || idx >= descriptions.length) return undefined;
        const raw = descriptions[idx];
        if (typeof raw !== 'string') return undefined;
        const normalized = raw.replace(/^\[[^\]]+\]\s*/g, '').trim();
        return normalized.length > 0 ? normalized : undefined;
    }

    private static getEffectText(effect: EffectDefinition): string | undefined {
        const raw = (effect as any)?.parameters?.text;
        if (typeof raw !== 'string') return undefined;
        const text = raw.trim();
        if (!text || text === '.') return undefined;
        return text;
    }

    private static describeConditionalTokenDeploy(effect: EffectDefinition): string | undefined {
        const params = (effect as any)?.parameters;
        if (!params || typeof params !== 'object') return undefined;

        const parts: string[] = [];
        for (const key of Object.keys(params)) {
            const condition = (params as any)[key];
            if (!condition || typeof condition !== 'object') continue;
            const tokenId = condition?.token?.cardId;
            if (typeof tokenId !== 'string' || tokenId.length === 0) continue;
            const count = Number(condition?.count ?? 1);
            const safeCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
            const tokenName = this.getCardDisplayName(tokenId);
            parts.push(`${safeCount} ${tokenName}${safeCount > 1 ? ' tokens' : ' token'}`);
        }

        if (parts.length === 0) return undefined;
        if (parts.length === 1) return `Deploy ${parts[0]} if conditions are met`;
        return `Deploy token based on conditions (${parts.join(' / ')})`;
    }

    private static getCardDisplayName(cardId: string): string {
        const card = CardDatabaseManager.getCardDetails(cardId);
        const name = typeof card?.name === 'string' ? card.name.trim() : '';
        return name.length > 0 ? name : cardId;
    }
}
