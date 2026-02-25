export type AliasCarrierLike = {
    nameAliases?: unknown;
};

export function normalizeAliasName(value: unknown): string {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

export function normalizeAliasList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalized: string[] = [];
    for (const entry of value) {
        const alias = normalizeAliasName(entry);
        if (!alias || normalized.includes(alias)) {
            continue;
        }
        normalized.push(alias);
    }
    return normalized;
}

export function mergeAliasLists(base: string[], incoming: string[]): string[] {
    const merged = [...base];
    for (const alias of incoming) {
        if (!merged.includes(alias)) {
            merged.push(alias);
        }
    }
    return merged;
}

export function copyNameAliases(source: AliasCarrierLike | null | undefined, destination: AliasCarrierLike | null | undefined): void {
    if (!source || !destination) {
        return;
    }
    const aliases = normalizeAliasList(source.nameAliases);
    if (aliases.length === 0) {
        return;
    }
    destination.nameAliases = [...aliases];
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
        const aliases = normalizeAliasList((typed.parameters as Record<string, unknown>).alsoTreatedAs);
        const merged = mergeAliasLists(out, aliases);
        out.splice(0, out.length, ...merged);
    }

    for (const value of Object.values(typed)) {
        collectAliasesFromNode(value, out);
    }
}

export function extractNameAliasesFromRules(rules: unknown): string[] {
    if (!Array.isArray(rules) || rules.length === 0) {
        return [];
    }
    const aliases: string[] = [];
    collectAliasesFromNode(rules, aliases);
    return aliases;
}
