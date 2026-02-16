// src/services/cards/CardSetService.ts

import * as fs from 'fs';
import * as path from 'path';
import { resolveDataPath } from '../../config/dataPaths';

export type CardSetSummary = {
    id: string;
    name: string;
};

export function parseSetId(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const value = raw.trim().toLowerCase();
    if (!/^(gd|st)\d{2}$/.test(value)) return null;
    return value;
}

export function getCardSetFileName(setId: string): string {
    return `${setId}Card.json`;
}

export function resolveCardSetPath(setId: string): string {
    return resolveDataPath(getCardSetFileName(setId));
}

export async function listAvailableCardSets(): Promise<CardSetSummary[]> {
    const dataDir = path.dirname(resolveDataPath('gcgdecks.json'));
    const entries = await fs.promises.readdir(dataDir);

    return entries
        .filter((name) => /^(gd|st)\d{2}Card\.json$/i.test(name))
        .map((name) => {
            const id = name.slice(0, 4).toLowerCase();
            return { id, name: id.toUpperCase() };
        })
        .sort((a, b) => a.id.localeCompare(b.id));
}
