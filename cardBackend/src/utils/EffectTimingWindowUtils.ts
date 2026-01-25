import type { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';
import { GamePhase } from '../models/GameEnums';

export class EffectTimingWindowUtils {
    static normalizeTimingWindows(effect: EffectDefinition | null | undefined): string[] {
        const timingRecord = effect?.timing as Record<string, unknown> | undefined;
        const windows = Array.isArray(timingRecord?.['windows']) ? (timingRecord!['windows'] as unknown[]) : [];
        return windows
            .map(value => (typeof value === 'string' ? value.toUpperCase() : ''))
            .filter(Boolean);
    }

    static phaseToWindow(phase: GamePhase): string {
        if (phase === GamePhase.ACTION_STEP_PHASE) {
            return 'ACTION_STEP';
        }
        return phase.toUpperCase();
    }

    static allowsPhase(
        effect: EffectDefinition | null | undefined,
        phase: GamePhase,
        options: { defaultToMainPhaseWhenMissing?: boolean } = {}
    ): boolean {
        const windows = this.normalizeTimingWindows(effect);
        if (windows.length === 0) {
            return options.defaultToMainPhaseWhenMissing === true ? phase === GamePhase.MAIN_PHASE : false;
        }

        return windows.includes(this.phaseToWindow(phase));
    }

    static includesWindow(effect: EffectDefinition | null | undefined, window: string): boolean {
        const normalized = typeof window === 'string' ? window.toUpperCase() : '';
        if (!normalized) {
            return false;
        }
        return this.normalizeTimingWindows(effect).includes(normalized);
    }
}

