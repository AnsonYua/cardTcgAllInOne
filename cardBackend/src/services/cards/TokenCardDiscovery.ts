export function collectTokenCardIdsFromCardData(cardData: any): Set<string> {
    const result = new Set<string>();
    const visited = new Set<any>();

    const visit = (value: any): void => {
        if (!value) {
            return;
        }

        if (typeof value === 'string') {
            if (/^T-\d+$/i.test(value)) {
                result.add(value);
            }
            return;
        }

        if (typeof value !== 'object') {
            return;
        }

        if (visited.has(value)) {
            return;
        }
        visited.add(value);

        if (Array.isArray(value)) {
            value.forEach((entry) => visit(entry));
            return;
        }

        // Heuristic: if we see a token-like structure, capture it.
        // Common shapes: { token: { cardId: "T-001" } }, { cardId: "T-001" }, { id: "T-001" }
        const maybeCardId = (value as any).cardId;
        const maybeId = (value as any).id;
        if (typeof maybeCardId === 'string' && /^T-\d+$/i.test(maybeCardId)) {
            result.add(maybeCardId);
        }
        if (typeof maybeId === 'string' && /^T-\d+$/i.test(maybeId)) {
            result.add(maybeId);
        }

        for (const childValue of Object.values(value)) {
            visit(childValue);
        }
    };

    visit(cardData);
    return result;
}
