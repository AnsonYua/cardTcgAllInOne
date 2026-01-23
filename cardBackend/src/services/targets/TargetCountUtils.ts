// src/services/targets/TargetCountUtils.ts
// Centralizes parsing and validation for target.count configurations (number vs {min,max}).

export type TargetCountRange = {
    min: number;
    max: number;
};

export class TargetCountUtils {
    static parseRange(rawCount: unknown, defaults: TargetCountRange = { min: 1, max: 1 }): TargetCountRange {
        if (typeof rawCount === 'number') {
            const value = Math.max(0, rawCount);
            return { min: value, max: value };
        }

        if (rawCount && typeof rawCount === 'object') {
            const minRaw = (rawCount as any).min;
            const maxRaw = (rawCount as any).max;
            const min = typeof minRaw === 'number' ? Math.max(0, minRaw) : defaults.min;
            const max = typeof maxRaw === 'number' ? Math.max(0, maxRaw) : defaults.max;
            return { min, max: Math.max(min, max) };
        }

        return defaults;
    }

    static resolveMaxCount(rawCount: unknown, defaultCount: number): number {
        const range = this.parseRange(rawCount, { min: defaultCount, max: defaultCount });
        return range.max > 0 ? range.max : defaultCount;
    }

    static validateSelectedCount(
        selectedCount: number,
        rawCount: unknown
    ): { ok: true } | { ok: false; error: string } {
        const range = this.parseRange(rawCount, { min: 1, max: 1 });
        const min = range.min;
        const max = range.max;

        if (selectedCount < min) {
            return { ok: false, error: `Must select at least ${min} target(s)` };
        }
        if (selectedCount > max) {
            return { ok: false, error: `Must select at most ${max} target(s)` };
        }
        return { ok: true };
    }

    static hasMeaningfulChoice(
        availableCount: number,
        rawCount: unknown,
        optional: boolean
    ): boolean {
        if (availableCount <= 0) {
            return false;
        }

        const range = this.parseRange(rawCount, { min: 1, max: 1 });
        const min = range.min;
        const max = range.max;

        if (max <= 0) {
            return false;
        }

        if (optional) {
            return true; // choose vs decline is meaningful when any targets exist
        }

        if (availableCount < min) {
            return false;
        }

        const maxSelectable = Math.min(max, availableCount);

        if (min === maxSelectable) {
            return availableCount > min;
        }

        return availableCount > min;
    }
}

