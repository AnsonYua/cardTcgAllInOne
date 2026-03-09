import type { CompiledEffectNode, EffectDefinition, EffectStructure } from '../EventQueue/interfaces/GameEvent';
import { compileEffectActionNodeFromRule } from './EffectActionCompiler';

type ActionReadable = Pick<EffectDefinition, 'action' | 'compiledEffectNode' | 'metaRef' | 'operation' | 'parameters' | 'playMode' | 'structure'>;

function asRawRule(effect: ActionReadable | null | undefined): Record<string, unknown> {
    if (!effect || typeof effect !== 'object') {
        return {};
    }
    return effect as unknown as Record<string, unknown>;
}

export function getCompiledEffectNode(effect: ActionReadable | null | undefined): CompiledEffectNode {
    if (effect?.compiledEffectNode) {
        return effect.compiledEffectNode;
    }
    return compileEffectActionNodeFromRule(asRawRule(effect));
}

export function getEffectStructure(effect: ActionReadable | null | undefined): EffectStructure {
    return getCompiledEffectNode(effect).structure;
}

export function getEffectOperation(effect: ActionReadable | null | undefined): string | undefined {
    return getCompiledEffectNode(effect).operation;
}

export function getEffectPlayMode(effect: ActionReadable | null | undefined): string | undefined {
    return getCompiledEffectNode(effect).playMode;
}

export function getEffectMetaType(effect: ActionReadable | null | undefined): string | undefined {
    return getCompiledEffectNode(effect).metaRef?.type;
}

export function getLegacyEffectAction(effect: ActionReadable | null | undefined): string | undefined {
    const node = getCompiledEffectNode(effect);
    if (node.structure === 'sequence' || node.structure === 'conditional') {
        return node.structure;
    }
    if (node.playMode) {
        return node.playMode;
    }
    if (node.metaRef?.type) {
        return node.metaRef.type;
    }
    return node.operation;
}

export function hasEffectStrategicTag(effect: ActionReadable | null | undefined, tag: string): boolean {
    const normalized = typeof tag === 'string' ? tag : '';
    if (!normalized) {
        return false;
    }
    return Boolean(getCompiledEffectNode(effect).aiTags?.strategic?.includes(normalized as any));
}
