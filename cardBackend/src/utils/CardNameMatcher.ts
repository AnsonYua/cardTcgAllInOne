import { extractNameAliasesFromRules, mergeAliasLists, normalizeAliasList, normalizeAliasName } from './NameAliasUtils';

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

export function getEffectiveCardNames(cardLike: CardNameLike | null | undefined): string[] {
    if (!cardLike || typeof cardLike !== 'object') {
        return [];
    }

    const primaryName = normalizeAliasName(cardLike.cardData?.name ?? cardLike.name);
    const aliases = normalizeAliasList(cardLike.nameAliases);
    const staticAliases = extractNameAliasesFromRules(cardLike.cardData?.effects?.rules);

    const names: string[] = [];
    if (primaryName) {
        names.push(primaryName);
    }
    return mergeAliasLists(mergeAliasLists(names, aliases), staticAliases);
}

export function hasNameIncludes(cardLike: CardNameLike | null | undefined, fragment: string): boolean {
    const needle = normalizeAliasName(fragment).toLowerCase();
    if (!needle) {
        return true;
    }
    return getEffectiveCardNames(cardLike).some((name) => name.toLowerCase().includes(needle));
}
