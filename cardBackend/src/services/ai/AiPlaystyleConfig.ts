import * as fs from 'fs';
import * as path from 'path';

export type AiPlaystyle = 'balanced' | 'tempo' | 'control' | 'defensive';

type ActionMultiplierOverrides = Partial<Record<string, number>>;

type PlaystyleWeights = {
    thresholdDelta: number;
    defaultMultiplier: number;
    offensiveMultiplier: number;
    defensiveMultiplier: number;
    controlMultiplier: number;
    resourceMultiplier: number;
    utilityMultiplier: number;
    actionOverrides?: ActionMultiplierOverrides;
};

type RuntimeWeightConfig = {
    global?: ActionMultiplierOverrides;
    playstyles?: Partial<Record<AiPlaystyle, ActionMultiplierOverrides>>;
};

const PLAYSTYLE_WEIGHTS: Record<AiPlaystyle, PlaystyleWeights> = {
    balanced: {
        thresholdDelta: 0,
        defaultMultiplier: 1,
        offensiveMultiplier: 1,
        defensiveMultiplier: 1,
        controlMultiplier: 1,
        resourceMultiplier: 1,
        utilityMultiplier: 1
    },
    tempo: {
        thresholdDelta: -2,
        defaultMultiplier: 1,
        offensiveMultiplier: 1.25,
        defensiveMultiplier: 0.8,
        controlMultiplier: 1,
        resourceMultiplier: 1.05,
        utilityMultiplier: 1.1,
        actionOverrides: {
            draw: 1.08,
            addExtraEnergy: 1.1,
            addBasicEnergy: 1.1,
            conditionalTokenDeploy: 1.15
        }
    },
    control: {
        thresholdDelta: 1,
        defaultMultiplier: 1,
        offensiveMultiplier: 0.95,
        defensiveMultiplier: 1.05,
        controlMultiplier: 1.3,
        resourceMultiplier: 1.08,
        utilityMultiplier: 1.08,
        actionOverrides: {
            rest: 1.25,
            destroy: 1.2,
            returnToHand: 1.2,
            modifyAP: 1.2
        }
    },
    defensive: {
        thresholdDelta: 1,
        defaultMultiplier: 1,
        offensiveMultiplier: 0.78,
        defensiveMultiplier: 1.32,
        controlMultiplier: 1.1,
        resourceMultiplier: 1,
        utilityMultiplier: 1,
        actionOverrides: {
            heal: 1.35,
            repair: 1.35,
            modifyHP: 1.28,
            setActive: 1.18,
            prevent_battle_damage: 1.2,
            prevent_shield_damage: 1.2
        }
    }
};

const OFFENSIVE_ACTIONS = new Set([
    'damage',
    'destroy',
    'damageShield',
    'grant_breach',
    'allow_attack_target'
]);

const CONTROL_ACTIONS = new Set([
    'rest',
    'returnToHand',
    'modifyAP',
    'restrict_attack',
    'prevent_set_active_next_turn'
]);

const DEFENSIVE_ACTIONS = new Set([
    'heal',
    'repair',
    'modifyHP',
    'prevent_battle_damage',
    'prevent_shield_damage',
    'setActive'
]);

const RESOURCE_ACTIONS = new Set([
    'draw',
    'addExtraEnergy',
    'addBasicEnergy',
    'scry_top_deck',
    'moveFromTrashToDeck',
    'moveFromHandToDeckBottom'
]);

const UTILITY_ACTIONS = new Set([
    'conditionalTokenDeploy',
    'deploy_from_hand',
    'sequence',
    'grant_keyword'
]);

const normalizePlaystyle = (value: string | undefined): AiPlaystyle => {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'tempo') return 'tempo';
    if (normalized === 'control') return 'control';
    if (normalized === 'defensive') return 'defensive';
    return 'balanced';
};

const PLAYSTYLE_KEYS: AiPlaystyle[] = ['balanced', 'tempo', 'control', 'defensive'];
let cachedRuntimeConfigKey = '';
let cachedRuntimeConfig: RuntimeWeightConfig = {};

const toValidMultiplier = (value: unknown): number | undefined => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    return parsed;
};

const normalizeActionOverrides = (raw: unknown): ActionMultiplierOverrides | undefined => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return undefined;
    }

    const entries = Object.entries(raw as Record<string, unknown>)
        .map(([action, value]) => ({ action: String(action).trim(), multiplier: toValidMultiplier(value) }))
        .filter((entry): entry is { action: string; multiplier: number } => Boolean(entry.action && entry.multiplier !== undefined));

    if (entries.length === 0) {
        return undefined;
    }

    const normalized: ActionMultiplierOverrides = {};
    for (const entry of entries) {
        normalized[entry.action] = entry.multiplier;
    }
    return normalized;
};

const parseRuntimeWeightJson = (rawJson: string): RuntimeWeightConfig => {
    if (!rawJson.trim()) {
        return {};
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawJson);
    } catch (error) {
        console.warn(`⚠️ Failed to parse AI action weights JSON: ${error instanceof Error ? error.message : String(error)}`);
        return {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
    }

    const source = parsed as Record<string, unknown>;
    const global = normalizeActionOverrides(source.global);
    const playstyles: Partial<Record<AiPlaystyle, ActionMultiplierOverrides>> = {};

    const rawPlaystyles = source.playstyles;
    if (rawPlaystyles && typeof rawPlaystyles === 'object' && !Array.isArray(rawPlaystyles)) {
        for (const playstyle of PLAYSTYLE_KEYS) {
            const normalized = normalizeActionOverrides((rawPlaystyles as Record<string, unknown>)[playstyle]);
            if (normalized) {
                playstyles[playstyle] = normalized;
            }
        }
    } else {
        for (const playstyle of PLAYSTYLE_KEYS) {
            const normalized = normalizeActionOverrides(source[playstyle]);
            if (normalized) {
                playstyles[playstyle] = normalized;
            }
        }
    }

    const fallbackGlobal = global || normalizeActionOverrides(source);
    return {
        global: fallbackGlobal,
        playstyles: Object.keys(playstyles).length > 0 ? playstyles : undefined
    };
};

const loadRuntimeWeightConfig = (): RuntimeWeightConfig => {
    const inlineJson = process.env.AI_ACTION_WEIGHTS_JSON || '';
    const filePath = process.env.AI_ACTION_WEIGHTS_FILE || '';
    const cacheKey = `${filePath}::${inlineJson}`;
    if (cacheKey === cachedRuntimeConfigKey) {
        return cachedRuntimeConfig;
    }

    let rawJson = inlineJson;
    if (!rawJson.trim() && filePath.trim()) {
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        try {
            rawJson = fs.readFileSync(resolvedPath, 'utf8');
        } catch (error) {
            console.warn(`⚠️ Failed to read AI action weight file "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`);
            rawJson = '';
        }
    }

    cachedRuntimeConfig = parseRuntimeWeightJson(rawJson);
    cachedRuntimeConfigKey = cacheKey;
    return cachedRuntimeConfig;
};

const getRuntimeActionMultiplier = (playstyle: AiPlaystyle, action: string): number | undefined => {
    const runtime = loadRuntimeWeightConfig();
    const playstyleOverrides = runtime.playstyles?.[playstyle];
    const styleMultiplier = playstyleOverrides?.[action];
    if (typeof styleMultiplier === 'number') {
        return styleMultiplier;
    }

    const globalMultiplier = runtime.global?.[action];
    if (typeof globalMultiplier === 'number') {
        return globalMultiplier;
    }

    return undefined;
};

export const getAiPlaystyle = (): AiPlaystyle =>
    normalizePlaystyle(process.env.AI_PLAYSTYLE);

export const getActionPlaystyleMultiplier = (
    playstyle: AiPlaystyle,
    action: string,
    scope?: unknown
): number => {
    const weights = PLAYSTYLE_WEIGHTS[playstyle] || PLAYSTYLE_WEIGHTS.balanced;
    const normalizedAction = typeof action === 'string' ? action : '';
    const actionOverride = weights.actionOverrides?.[normalizedAction];
    let multiplier = typeof actionOverride === 'number'
        ? actionOverride
        : weights.defaultMultiplier;

    if (typeof actionOverride !== 'number' && normalizedAction === 'modifyAP') {
        const scopeText = typeof scope === 'string' ? scope.toLowerCase() : '';
        if (scopeText.includes('self')) {
            multiplier = playstyle === 'tempo' ? 1.18 : weights.defaultMultiplier;
        } else if (scopeText.includes('opponent') || scopeText.includes('enemy')) {
            multiplier = playstyle === 'control' ? 1.3 : weights.controlMultiplier;
        }
    } else if (typeof actionOverride !== 'number') {
        if (OFFENSIVE_ACTIONS.has(normalizedAction)) multiplier = weights.offensiveMultiplier;
        else if (CONTROL_ACTIONS.has(normalizedAction)) multiplier = weights.controlMultiplier;
        else if (DEFENSIVE_ACTIONS.has(normalizedAction)) multiplier = weights.defensiveMultiplier;
        else if (RESOURCE_ACTIONS.has(normalizedAction)) multiplier = weights.resourceMultiplier;
        else if (UTILITY_ACTIONS.has(normalizedAction)) multiplier = weights.utilityMultiplier;
    }

    const runtimeMultiplier = getRuntimeActionMultiplier(playstyle, normalizedAction);
    if (typeof runtimeMultiplier === 'number') {
        return multiplier * runtimeMultiplier;
    }
    return multiplier;
};

export const adjustDecisionThreshold = (baseThreshold: number, playstyle: AiPlaystyle): number => {
    const weights = PLAYSTYLE_WEIGHTS[playstyle] || PLAYSTYLE_WEIGHTS.balanced;
    return baseThreshold + weights.thresholdDelta;
};
