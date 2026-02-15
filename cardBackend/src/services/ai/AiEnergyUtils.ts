import type { AiPlayerView } from './AiViewTypes';

export function getAvailableEnergyCount(playerView: AiPlayerView | undefined): number {
    const energyArea = Array.isArray(playerView?.zones?.energyArea) ? playerView.zones.energyArea : [];
    return energyArea.filter((energy) => !energy?.isRested).length;
}

export function getTotalEnergyCount(playerView: AiPlayerView | undefined): number {
    const energyArea = Array.isArray(playerView?.zones?.energyArea) ? playerView.zones.energyArea : [];
    return energyArea.length;
}
