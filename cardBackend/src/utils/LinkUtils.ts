// src/utils/LinkUtils.ts
// Shared helpers for determining whether a Unit+Pilot pair is linked.

import type { PilotZoneCard, UnitZoneCard } from '../models/CardSystem';
import { getEffectPlayMode } from '../services/effects/EffectActionAccess';

export class LinkUtils {
    static isLinkedPair(unit: UnitZoneCard | undefined | null, pilot: PilotZoneCard | undefined | null): boolean {
        if (!unit?.cardData?.link || !pilot?.cardData) {
            return false;
        }

        const unitLink = unit.cardData.link;
        if (!Array.isArray(unitLink) || unitLink.length === 0) {
            return false;
        }

        const pilotIdentity = this.resolvePilotIdentityForLink(pilot);
        if (pilotIdentity.name && unitLink.includes(pilotIdentity.name)) {
            return true;
        }

        if (pilotIdentity.traits.length > 0) {
            return unitLink.some((linkValue: string) => pilotIdentity.traits.includes(linkValue));
        }

        return false;
    }

    private static resolvePilotIdentityForLink(pilot: PilotZoneCard): { name: string | null; traits: string[] } {
        if (pilot.cardData?.cardType === 'command') {
            const designatePilotEffect = pilot.cardData?.effects?.rules?.find((rule: any) =>
                getEffectPlayMode(rule) === 'designate_pilot'
            );
            if (designatePilotEffect?.parameters?.pilotName) {
                return { name: designatePilotEffect.parameters.pilotName as string, traits: [] };
            }
        }

        return {
            name: pilot.cardData?.name || null,
            traits: Array.isArray(pilot.cardData?.traits) ? pilot.cardData.traits : []
        };
    }
}
