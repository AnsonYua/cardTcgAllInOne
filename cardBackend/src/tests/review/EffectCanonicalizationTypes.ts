export interface EffectCanonicalizationRule {
    ruleId: string;
    category: string;
    match: {
        file?: string;
        cardId?: string;
        category?: string;
        rulePathIncludes?: string;
    };
    canonicalTemplate: Record<string, unknown>;
    allowlist: string[];
    notes?: string;
}

export interface EffectCanonicalizationManifest {
    canonicalizationRules: EffectCanonicalizationRule[];
    intentionalDivergenceAllowlist: Array<{
        issueId?: string;
        category?: string;
        cardId?: string;
        file?: string;
        rulePathIncludes?: string;
    }>;
}
