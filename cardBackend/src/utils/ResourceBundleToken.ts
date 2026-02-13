import crypto from 'crypto';

export type ResourceBundleTokenPayloadV1 = {
    v: 1;
    gameId: string;
    playerId: string;
    exp: number; // unix seconds
};

function base64UrlEncode(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Buffer {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Buffer.from(padded, 'base64');
}

function timingSafeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export function signResourceBundleToken(payload: Omit<ResourceBundleTokenPayloadV1, 'v'>, secret: string): string {
    const fullPayload: ResourceBundleTokenPayloadV1 = { v: 1, ...payload };
    const payloadJson = JSON.stringify(fullPayload);
    const payloadPart = base64UrlEncode(Buffer.from(payloadJson, 'utf8'));
    const sigPart = base64UrlEncode(crypto.createHmac('sha256', secret).update(payloadPart).digest());
    return `v1.${payloadPart}.${sigPart}`;
}

export function verifyResourceBundleToken(token: string, secret: string): ResourceBundleTokenPayloadV1 | null {
    if (typeof token !== 'string' || token.length === 0) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [version, payloadPart, sigPart] = parts;
    if (version !== 'v1') return null;
    if (!payloadPart || !sigPart) return null;

    const expectedSig = base64UrlEncode(crypto.createHmac('sha256', secret).update(payloadPart).digest());
    if (!timingSafeEqual(expectedSig, sigPart)) return null;

    let payload: ResourceBundleTokenPayloadV1;
    try {
        payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
    } catch {
        return null;
    }
    if (!payload || payload.v !== 1) return null;
    if (typeof payload.gameId !== 'string' || typeof payload.playerId !== 'string' || typeof payload.exp !== 'number') {
        return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;
    return payload;
}

