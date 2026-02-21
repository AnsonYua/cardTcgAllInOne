import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { TargetFilters } from '../../EventQueue/interfaces/GameEvent';

export interface EffectScalingContext {
    gameEnv: GameEnvironment;
    sourcePlayerId: string;
    sourceCarduid?: string;
    effectId?: string;
}

export type SourceApScalingConfig = {
    stat: 'ap';
    scope: 'source';
    per: number;
    rounding?: 'floor' | 'ceil' | 'round';
};

export type CountUnitsInPlayScalingConfig = {
    type: 'COUNT_UNITS_IN_PLAY';
    scope?: string;
    filters?: TargetFilters;
    multiplier?: number;
};

export type CountUniqueCardsInTrashScalingConfig = {
    type: 'COUNT_UNIQUE_CARDS_IN_TRASH';
    scope?: string;
    filters?: TargetFilters & {
        cardTypes?: string[];
    };
    multiplier?: number;
};

export type SupportedScalingConfig =
    | SourceApScalingConfig
    | CountUnitsInPlayScalingConfig
    | CountUniqueCardsInTrashScalingConfig;
