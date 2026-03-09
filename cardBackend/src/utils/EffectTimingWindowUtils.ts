import type { EffectDefinition } from '../services/EventQueue/interfaces/GameEvent';
import { GamePhase } from '../models/GameEnums';
import {
    getEffectActivationWindows,
    getEffectDuration,
    getEffectEventTrigger,
    hasEffectActivationWindow,
    isContinuousEffectTiming
} from '../services/effects/timing/EffectTimingAccess';

export class EffectTimingWindowUtils {
    static getEventTrigger(effect: EffectDefinition | null | undefined): string | undefined {
        return getEffectEventTrigger(effect);
    }

    static getActivationWindows(effect: EffectDefinition | null | undefined): string[] {
        return getEffectActivationWindows(effect);
    }

    static getDuration(effect: EffectDefinition | null | undefined): string | undefined {
        return getEffectDuration(effect);
    }

    static isContinuousEffect(effect: EffectDefinition | null | undefined): boolean {
        return isContinuousEffectTiming(effect);
    }

    static normalizeTimingWindows(effect: EffectDefinition | null | undefined): string[] {
        return this.getActivationWindows(effect);
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
        const windows = this.getActivationWindows(effect);
        if (windows.length === 0) {
            return options.defaultToMainPhaseWhenMissing === true ? phase === GamePhase.MAIN_PHASE : false;
        }

        return windows.includes(this.phaseToWindow(phase));
    }

    static includesWindow(effect: EffectDefinition | null | undefined, window: string): boolean {
        return hasEffectActivationWindow(effect, window);
    }
}
