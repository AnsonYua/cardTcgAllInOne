export class ContinuousScopeUtils {
    static normalizeScope(scope: unknown): string {
        return typeof scope === 'string' ? scope.toLowerCase() : '';
    }

    static isBattleScope(scope: unknown): boolean {
        return this.normalizeScope(scope).startsWith('battle_');
    }
}

