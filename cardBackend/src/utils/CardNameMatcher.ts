type CardNameLike = {
    name?: unknown;
    cardData?: {
        name?: unknown;
        effects?: {
            rules?: unknown[];
        } | null;
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

function collectAliasesFromNode(node: unknown, out: string[]): void {
    if (Array.isArray(node)) {
        for (const entry of node) {
            collectAliasesFromNode(entry, out);
        }
        return;
    }

    if (!node || typeof node !== 'object') {
        return;
    }

    const typed = node as Record<string, unknown>;
    if (typed.action === 'set_name_alias' && typed.parameters && typeof typed.parameters === 'object') {
        const aliases = normalizeAliases((typed.parameters as Record<string, unknown>).alsoTreatedAs);
        for (const alias of aliases) {
            if (!out.includes(alias)) {
                out.push(alias);
            }
        }
    }

    for (const value of Object.values(typed)) {
        collectAliasesFromNode(value, out);
    }
}

function getStaticAliasesFromCardData(cardLike: CardNameLike): string[] {
    const rules = cardLike.cardData?.effects?.rules;
    if (!Array.isArray(rules) || rules.length === 0) {
        return [];
    }
    const aliases: string[] = [];
    collectAliasesFromNode(rules, aliases);
    return aliases;
}

export function getEffectiveCardNames(cardLike: CardNameLike | null | undefined): string[] {
    if (!cardLike || typeof cardLike !== 'object') {
        return [];
    }

    const primaryName = normalizeName(cardLike.cardData?.name ?? cardLike.name);
    const aliases = normalizeAliases(cardLike.nameAliases);
    const staticAliases = getStaticAliasesFromCardData(cardLike);

    const names: string[] = [];
    if (primaryName) {
        names.push(primaryName);
    }
    for (const alias of aliases) {
        if (!names.includes(alias)) {
            names.push(alias);
        }
    }
    for (const alias of staticAliases) {
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
