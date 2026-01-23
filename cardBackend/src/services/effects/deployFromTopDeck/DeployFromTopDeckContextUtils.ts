// src/services/effects/deployFromTopDeck/DeployFromTopDeckContextUtils.ts

import type { DeckBottomOrder } from '../../zones/DeckZoneManager';

export type DeployFromTopDeckContext = {
    lookedCarduids: string[];
    restOrder: DeckBottomOrder;
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

