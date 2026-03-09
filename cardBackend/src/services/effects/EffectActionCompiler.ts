import type {
    CompiledAiEffectTags,
    CompiledEffectNode,
    CompiledEffectTiming,
    CompiledMetaEffectRef,
    EffectStructure
} from '../EventQueue/interfaces/GameEvent';

type RawRule = Record<string, unknown>;

type StrategicTag = CompiledAiEffectTags['strategic'][number];
type MechanicalTag = CompiledAiEffectTags['mechanical'][number];

const STRUCTURE_ACTIONS = new Set(['sequence', 'conditional']);
const PLAY_MODE_ACTIONS = new Set(['designate_pilot']);
const META_ACTIONS = new Set(['activate_ability']);

const OPERATION_TAGS: Record<string, StrategicTag[]> = {
    damage: ['removal'],
    destroy: ['removal'],
    returnToHand: ['removal', 'tempo'],
    rest: ['removal', 'tempo', 'combat_trick'],
    modifyAP: ['combat_trick', 'tempo'],
    modifyHP: ['combat_trick', 'resilience'],
    grant_keyword: ['combat_trick', 'tempo'],
    grant_breach: ['shield_pressure', 'combat_trick'],
    damageShield: ['shield_pressure'],
    allow_attack_target: ['combat_trick', 'shield_pressure'],
    prevent_battle_damage: ['resilience', 'recovery'],
    prevent_damage: ['resilience', 'recovery'],
    prevent_shield_damage: ['resilience'],
    heal: ['recovery', 'resilience'],
    repair: ['recovery', 'resilience'],
    deploy: ['tempo'],
    deploy_from_hand: ['tempo'],
    conditionalTokenDeploy: ['tempo'],
    addToHand: ['tempo', 'resource_gain'],
    draw: ['resource_gain'],
    addExtraEnergy: ['resource_gain', 'tempo'],
    addBasicEnergy: ['resource_gain', 'tempo'],
    setActive: ['tempo'],
    setActive_then_restrict_attack: ['tempo', 'combat_trick'],
    pair_from_hand: ['pair_payoff', 'tempo'],
    pair_from_trash: ['pair_payoff', 'recovery'],
    select_from_top_deck: ['resource_gain'],
    scry_top_deck: ['resource_gain'],
    redirect_attack: ['combat_trick', 'resilience'],
    prevent_set_active_next_turn: ['resilience']
};

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function dedupe<T extends string>(values: T[]): T[] {
    return Array.from(new Set(values));
}

function getRawAction(rule: RawRule): string | undefined {
    const direct = asString(rule.action);
    if (direct) {
        return direct;
    }
    const operation = asString(rule.operation) || asString(rule.effectAction);
    if (operation) {
        return operation;
    }
    const nestedEffect = rule.effect;
    if (nestedEffect && typeof nestedEffect === 'object' && !Array.isArray(nestedEffect)) {
        const nested = getRawAction(nestedEffect as RawRule);
        if (nested) {
            return nested;
        }
    }
    const parameters = rule.parameters;
    if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
        const parameterAction = asString((parameters as RawRule).action) || asString((parameters as RawRule).operation);
        if (parameterAction) {
            return parameterAction;
        }
    }
    return undefined;
}

function resolveStructure(rule: RawRule, rawAction: string | undefined): EffectStructure {
    const explicit = asString(rule.structure);
    if (explicit === 'sequence' || explicit === 'conditional' || explicit === 'primitive') {
        return explicit;
    }
    if (rawAction && STRUCTURE_ACTIONS.has(rawAction)) {
        return rawAction as EffectStructure;
    }
    return 'primitive';
}

function resolveMetaRef(rule: RawRule, rawAction: string | undefined): CompiledMetaEffectRef | undefined {
    const rawMeta = rule.metaRef;
    if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
        const type = asString((rawMeta as RawRule).type);
        if (!type) {
            return undefined;
        }
        const abilityType = asString((rawMeta as RawRule).abilityType) || asString((rawMeta as RawRule).ability);
        return {
            type,
            ...(abilityType ? { abilityType } : {})
        };
    }

    if (rawAction && META_ACTIONS.has(rawAction)) {
        const abilityType = asString((rule.parameters as RawRule | undefined)?.abilityType) || 'main';
        return {
            type: rawAction,
            abilityType
        };
    }

    return undefined;
}

function resolvePlayMode(rule: RawRule, rawAction: string | undefined): string | undefined {
    const explicit = asString(rule.playMode);
    if (explicit) {
        return explicit;
    }
    if (rawAction && PLAY_MODE_ACTIONS.has(rawAction)) {
        return rawAction;
    }
    return undefined;
}

function resolveOperation(
    rule: RawRule,
    structure: EffectStructure,
    rawAction: string | undefined,
    playMode: string | undefined,
    metaRef: CompiledMetaEffectRef | undefined
): string | undefined {
    const explicit = asString(rule.operation);
    if (explicit) {
        return explicit;
    }
    if (structure !== 'primitive') {
        return undefined;
    }
    if (playMode || metaRef) {
        return undefined;
    }
    return rawAction;
}

function deriveMechanicalTags(
    node: Pick<CompiledEffectNode, 'structure'>,
    compiledTiming?: CompiledEffectTiming,
    rule?: RawRule
): MechanicalTag[] {
    const tags: MechanicalTag[] = [];

    if (compiledTiming?.timingClass === 'event_triggered') {
        tags.push('triggered');
    }
    if (compiledTiming?.timingClass === 'player_activated') {
        tags.push('activated');
    }
    if (compiledTiming?.timingClass === 'continuous_passive') {
        tags.push('continuous');
    }
    if (compiledTiming?.eventTrigger === 'BURST_CONDITION') {
        tags.push('burst_triggered');
    }
    if (node.structure === 'sequence') {
        tags.push('sequence');
    }
    if (node.structure === 'conditional') {
        tags.push('conditional');
    }

    const target = rule?.target;
    const count = target && typeof target === 'object' ? (target as RawRule).count : undefined;
    const selection = target && typeof target === 'object' ? (target as RawRule).selection : undefined;
    const optional = rule?.optional === true;
    if (selection || typeof count === 'object' || (typeof count === 'number' && count > 1) || optional) {
        tags.push('choice_required');
    }

    return dedupe(tags);
}

function deriveStrategicTags(
    operation: string | undefined,
    playMode: string | undefined,
    metaRef: CompiledMetaEffectRef | undefined
): StrategicTag[] {
    const tags: StrategicTag[] = [];

    if (operation && OPERATION_TAGS[operation]) {
        tags.push(...OPERATION_TAGS[operation]);
    }
    if (playMode === 'designate_pilot') {
        tags.push('pair_payoff', 'tempo');
    }
    if (metaRef?.type === 'activate_ability') {
        tags.push('tempo');
    }

    return dedupe(tags);
}

export function compileEffectActionNodeFromRule(
    rule: RawRule,
    compiledTiming?: CompiledEffectTiming
): CompiledEffectNode {
    const rawAction = getRawAction(rule);
    const structure = resolveStructure(rule, rawAction);
    const playMode = resolvePlayMode(rule, rawAction);
    const metaRef = resolveMetaRef(rule, rawAction);
    const operation = resolveOperation(rule, structure, rawAction, playMode, metaRef);
    const aiTags: CompiledAiEffectTags = {
        mechanical: deriveMechanicalTags({ structure }, compiledTiming, rule),
        strategic: deriveStrategicTags(operation, playMode, metaRef)
    };

    return {
        structure,
        ...(operation ? { operation } : {}),
        ...(playMode ? { playMode } : {}),
        ...(metaRef ? { metaRef } : {}),
        aiTags
    };
}
