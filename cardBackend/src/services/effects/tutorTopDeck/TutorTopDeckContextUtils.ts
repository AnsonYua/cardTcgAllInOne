import type { DeckBottomOrder } from '../../zones/DeckZoneManager';

export type TutorRuntimeContext = {
    lookedCarduids: string[];
    restOrder: DeckBottomOrder;
    reveal: boolean;
};

export function parseTutorRestOrder(raw: unknown): DeckBottomOrder {
    return raw === 'random' ? 'random' : 'preserve';
}

export function parseTutorRuntimeContext(raw: unknown): TutorRuntimeContext | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const context = raw as Record<string, unknown>;
    const tutorRaw = context['tutor'];
    if (!tutorRaw || typeof tutorRaw !== 'object') {
        return null;
    }
    const tutor = tutorRaw as Record<string, unknown>;
    const looked = tutor['lookedCarduids'];
    const lookedCarduids = Array.isArray(looked)
        ? looked.filter((c: unknown) => typeof c === 'string')
        : [];
    const restOrder = parseTutorRestOrder(tutor['restOrder']);
    const reveal = tutor['reveal'] === true;
    if (lookedCarduids.length === 0) {
        return null;
    }
    return { lookedCarduids, restOrder, reveal };
}
