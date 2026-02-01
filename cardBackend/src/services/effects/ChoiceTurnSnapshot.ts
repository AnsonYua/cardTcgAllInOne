import { GameEnvironment } from '../../models/GameEnvironment';

export type ChoiceTurnSnapshotData = {
    previousPlayerId?: string | null;
    turnPlayerId?: string | null;
};

export class ChoiceTurnSnapshot {
    static attach(gameEnv: GameEnvironment, data: ChoiceTurnSnapshotData): void {
        const turnPlayerId = gameEnv.currentPlayer ?? null;
        data.turnPlayerId = turnPlayerId;
        data.previousPlayerId = turnPlayerId;
    }
}

