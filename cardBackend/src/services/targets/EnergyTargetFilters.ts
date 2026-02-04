import type { EnergyZoneCard } from '../../models/CardSystem';
import type { TargetFilters } from '../EventQueue/interfaces/GameEvent';

export interface NormalizedEnergyFilters {
    status?: 'rested' | 'active';
    isExtraEnergy?: boolean;
    excludeCarduids: string[];
}

export function normalizeEnergyTargetFilters(filters: TargetFilters | undefined): NormalizedEnergyFilters {
    const normalized: NormalizedEnergyFilters = {
        excludeCarduids: []
    };

    const statusValue = typeof (filters as any)?.status === 'string' ? String((filters as any).status).toLowerCase() : '';
    if (statusValue === 'rested' || statusValue === 'active') {
        normalized.status = statusValue;
    }

    if (typeof (filters as any)?.isExtraEnergy === 'boolean') {
        normalized.isExtraEnergy = (filters as any).isExtraEnergy;
    }

    const excludeCarduids = Array.isArray((filters as any)?.excludeCarduids)
        ? (filters as any).excludeCarduids.filter((id: unknown) => typeof id === 'string')
        : [];
    normalized.excludeCarduids = excludeCarduids;

    return normalized;
}

export function matchesEnergyTargetFilters(energyCard: EnergyZoneCard, filters: NormalizedEnergyFilters): boolean {
    if (filters.excludeCarduids.length > 0 && filters.excludeCarduids.includes(energyCard.carduid)) {
        return false;
    }

    if (filters.status) {
        const cardStatus = energyCard.isRested ? 'rested' : 'active';
        if (cardStatus !== filters.status) {
            return false;
        }
    }

    if (typeof filters.isExtraEnergy === 'boolean') {
        const isExtra = energyCard.isExtraEnergy === true;
        if (isExtra !== filters.isExtraEnergy) {
            return false;
        }
    }

    return true;
}

