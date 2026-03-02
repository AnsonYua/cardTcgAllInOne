// src/services/effects/deployFromTopDeck/DeployFromTopDeckContextUtils.ts

import type { DeckBottomOrder } from '../../zones/DeckZoneManager';
import type { EffectDefinition, OptionChoiceOption } from '../../EventQueue/interfaces/GameEvent';

export type DeployFromTopDeckContext = {
    lookedCarduids: string[];
    restOrder: DeckBottomOrder;
};

export type DeployFromTopDeckReviewConfirmContext = {
    kind: 'DEPLOY_FROM_TOP_DECK_REVIEW_CONFIRM';
    deployFromTopDeck: {
        lookedCards: Array<{
            carduid: string;
            cardId: string;
            name?: string;
            traits: string[];
            matchesFilters: boolean;
        }>;
        lookedCarduids: string[];
        restOrder: DeckBottomOrder;
        availableOptions: OptionChoiceOption[];
        sourceCarduid: string;
        effect: EffectDefinition;
        optionChoice: {
            headerText: string;
            promptText: string;
            defaultOptionIndex?: number;
            layoutHint: 'card' | 'hybrid';
        };
    };
};

export function parseRestOrder(raw: unknown): DeckBottomOrder {
    return raw === 'random' ? 'random' : 'preserve';
}

export function parseDeployFromTopDeckContext(raw: unknown): DeployFromTopDeckContext | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const context = raw as Record<string, unknown>;
    const deployRaw = context['deployFromTopDeck'];
    if (!deployRaw || typeof deployRaw !== 'object') {
        return null;
    }
    const deploy = deployRaw as Record<string, unknown>;
    const looked = deploy['lookedCarduids'];
    const lookedCarduids = Array.isArray(looked)
        ? looked.filter((c: unknown) => typeof c === 'string')
        : [];
    const restOrder = parseRestOrder(deploy['restOrder']);
    if (lookedCarduids.length === 0) {
        return null;
    }
    return { lookedCarduids, restOrder };
}

export function parseDeployReviewConfirmContext(raw: unknown): DeployFromTopDeckReviewConfirmContext | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const context = raw as Record<string, unknown>;
    if (context.kind !== 'DEPLOY_FROM_TOP_DECK_REVIEW_CONFIRM') {
        return null;
    }

    const deployRaw = context.deployFromTopDeck;
    if (!deployRaw || typeof deployRaw !== 'object') {
        return null;
    }

    const deploy = deployRaw as Record<string, unknown>;
    const looked = Array.isArray(deploy.lookedCarduids)
        ? deploy.lookedCarduids.filter((c: unknown): c is string => typeof c === 'string')
        : [];
    const sourceCarduid = typeof deploy.sourceCarduid === 'string' ? deploy.sourceCarduid : '';
    const effect = deploy.effect as EffectDefinition | undefined;
    const optionChoiceRaw = deploy.optionChoice;
    if (!sourceCarduid || !effect || looked.length === 0 || !optionChoiceRaw || typeof optionChoiceRaw !== 'object') {
        return null;
    }

    return raw as DeployFromTopDeckReviewConfirmContext;
}
