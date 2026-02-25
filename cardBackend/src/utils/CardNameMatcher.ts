type CardNameLike = {
    name?: unknown;
    cardData?: {
        name?: unknown;
    } | null;
    nameAliases?: unknown;
};

function normalizeName(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

function normalizeAliases(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalized: string[] = [];
    for (const entry of value) {
        const alias = normalizeName(entry);
        if (!alias || normalized.includes(alias)) {
            continue;
        }
        normalized.push(alias);
    }
    return normalized;
}

export function getEffectiveCardNames(cardLike: CardNameLike | null | undefined): string[] {
    if (!cardLike || typeof cardLike !== 'object') {
        return [];
    }

    const primaryName = normalizeName(cardLike.cardData?.name ?? cardLike.name);
    const aliases = normalizeAliases(cardLike.nameAliases);

    const names: string[] = [];
    if (primaryName) {
        names.push(primaryName);
    }
    for (const alias of aliases) {
        if (!names.includes(alias)) {
            names.push(alias);
        }
    }
    return names;
}

export function hasNameIncludes(cardLike: CardNameLike | null | undefined, fragment: string): boolean {
    const needle = normalizeName(fragment).toLowerCase();
    if (!needle) {
        return true;
    }
    return getEffectiveCardNames(cardLike).some((name) => name.toLowerCase().includes(needle));
}
