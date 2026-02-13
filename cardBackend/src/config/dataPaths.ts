// src/config/dataPaths.ts
import fs from 'fs';
import path from 'path';

function firstExistingPath(candidates: string[]): string | undefined {
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

export function resolveDataPath(...segments: string[]): string {
    const rel = path.join(...segments);

    const candidates = [
        // Dev / ts-node / full repo checkout
        path.resolve(process.cwd(), 'src', 'data', rel),
        // Prod / compiled output with postbuild copy
        path.resolve(process.cwd(), 'dist', 'data', rel),
        // When imported from src/config (ts-node): __dirname => .../src/config
        path.resolve(__dirname, '..', 'data', rel),
        // When imported from dist/config (tsc): __dirname => .../dist/config
        path.resolve(__dirname, '..', '..', 'data', rel)
    ];

    return firstExistingPath(candidates) ?? candidates[0];
}

export const GCG_DECKS_PATH = resolveDataPath('gcgdecks.json');
