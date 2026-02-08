import type { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';

function stripBracketTags(text: string): string {
    // Removes leading/embedded rule tags like "[During Link][Activate/Main]".
    return text.replace(/\[[^\]]*]/g, '').replace(/\s+/g, ' ').trim();
}

function matchesEffectText(descriptionLine: string, effectText: string): boolean {
    const normalizedLine = stripBracketTags(descriptionLine).toLowerCase();
    const normalizedEffect = stripBracketTags(effectText).toLowerCase();
    if (!normalizedEffect) {
        return false;
    }
    return normalizedLine === normalizedEffect || normalizedLine.includes(normalizedEffect);
}

export function effectRequiresLinkedSource(effect: EffectDefinition, cardData: any): boolean {
    if (effect?.type !== 'activated') {
        return false;
    }

    const descriptionLines: string[] = Array.isArray(cardData?.effects?.description)
        ? cardData.effects.description.filter((line: unknown): line is string => typeof line === 'string')
        : [];

    if (descriptionLines.length === 0) {
        return false;
    }

    const effectText = typeof (effect as any)?.parameters?.text === 'string'
        ? ((effect as any).parameters.text as string)
        : '';

    // Prefer a direct match between a description line and this effect's text.
    const matchedLine = effectText
        ? descriptionLines.find(line => matchesEffectText(line, effectText))
        : undefined;

    if (matchedLine) {
        return /\[\s*During\s*Link\s*]/i.test(matchedLine);
    }

    // Fallback: if the card only has one activated rule and any description line is tagged,
    // assume it applies to that activated rule.
    const rules: unknown[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    const activatedRuleCount = rules.filter(rule => (rule as any)?.type === 'activated').length;
    if (activatedRuleCount === 1) {
        return descriptionLines.some(line => /\[\s*During\s*Link\s*]/i.test(line));
    }

    return false;
}

