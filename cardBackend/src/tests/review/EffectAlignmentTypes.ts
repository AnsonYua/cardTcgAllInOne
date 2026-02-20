export type EffectAlignmentSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface EffectAlignmentIssue {
    issueId: string;
    severity: EffectAlignmentSeverity;
    confidence: number;
    category: string;
    cardId: string;
    file: string;
    rulePath: string;
    currentSchema: unknown;
    expectedCanonicalSchema: unknown;
    behavioralRisk: string;
    recommendedFix: string;
}

export interface EffectAlignmentClusterMemberRef {
    file: string;
    cardId: string;
    cardName: string;
    rulePath: string;
    effectId: string;
}

export interface EffectAlignmentCluster {
    clusterId: string;
    memberCount: number;
    variantCount: number;
    canonicalVariantKey: string;
    memberRefs: EffectAlignmentClusterMemberRef[];
}

export interface EffectAlignmentReport {
    generatedAt: string;
    filesScanned: string[];
    cardsScanned: number;
    rulesScanned: number;
    clusters: EffectAlignmentCluster[];
    issues: EffectAlignmentIssue[];
    summaryByCategory: Record<string, number>;
    summaryBySeverity: Record<string, number>;
}
