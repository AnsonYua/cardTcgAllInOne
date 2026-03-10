const readEnvDelayMs = (name: string, fallbackMs: number): number => {
    const raw = process.env[name];
    if (raw === undefined || raw === '') {
        return fallbackMs;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallbackMs;
    }
    return Math.floor(parsed);
};

export const AI_AUTOPLAY_DEFAULT_STEPS = 1;
export const AI_ACTION_DELAY_MS = readEnvDelayMs('AI_ACTION_DELAY_MS', 2000);
export const AI_TURN_START_DELAY_MS = readEnvDelayMs('AI_TURN_START_DELAY_MS', 2000);
