export function getAvailableEnergyCount(playerView: any): number {
    const energyArea = Array.isArray(playerView?.zones?.energyArea) ? playerView.zones.energyArea : [];
    return energyArea.filter((energy: any) => !energy?.isRested).length;
}

export function getTotalEnergyCount(playerView: any): number {
    const energyArea = Array.isArray(playerView?.zones?.energyArea) ? playerView.zones.energyArea : [];
    return energyArea.length;
}
