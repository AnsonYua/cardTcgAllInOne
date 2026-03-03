import { GameEnvironment } from '../models/GameEnvironment';
import { BaseCard } from '../models/CardSystem';
import { PlayerCardManager } from './PlayerCardManager';
import { EffectExecutor } from './effects/EffectExecutor';
import { DestroyedTriggeredEffectManager } from './effects/DestroyedTriggeredEffectManager';

export class BaseLifecycleManager {
    static destroyBase(gameEnv: GameEnvironment, playerId: string, baseCard: BaseCard): void {
        console.log(`🏰 Base destroyed: ${baseCard.carduid}`);
        const player = gameEnv.getPlayer(playerId);
        if (player?.zones?.base) {
            player.zones.base = player.zones.base.filter((card: any) => card.carduid !== baseCard.carduid);
        }
        // Ordering rule: the destroyed base should already be in trash when DESTROYED effects resolve.
        // This keeps trash sequencing deterministic for effects like GD02-127 destroyed mill.
        PlayerCardManager.moveCardToTrash(gameEnv, playerId, baseCard.carduid, baseCard.cardId, baseCard.cardData);
        DestroyedTriggeredEffectManager.processDestroyedCard(gameEnv, playerId, baseCard);
        EffectExecutor.removeTemporaryEffectsFromSource(gameEnv, baseCard.carduid);
    }

    static replaceExistingBase(gameEnv: GameEnvironment, playerId: string, existingBase: BaseCard): void {
        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) {
            return;
        }

        console.log(`🏗️ Existing base found: ${existingBase.carduid}, moving to trash`);
        if (!player.zones.trashArea) {
            player.zones.trashArea = [];
        }
        player.zones.trashArea.push(existingBase);
        EffectExecutor.removeTemporaryEffectsFromSource(gameEnv, existingBase.carduid);
        player.zones.base = [];
        console.log(`🗑️ Moved existing base ${existingBase.carduid} to trash`);
    }
}
