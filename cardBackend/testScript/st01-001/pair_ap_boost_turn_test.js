#!/usr/bin/env node
'use strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const SCENARIO_PATH = 'ST01-001/pair_ap_boost_turn';
const PLAYER_A = 'playerId_1';
const PLAYER_B = 'playerId_2';

async function requestJson(method, url, body) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok || payload.error) {
        const error = payload.error || `Request failed with status ${response.status}`;
        throw new Error(`${method} ${url} failed: ${error}`);
    }

    return payload;
}

function pickPilotCarduid(gameEnv, playerId, cardId) {
    const hand = gameEnv.players[playerId]?.deck?.hand || [];
    const card = hand.find((item) => item.cardId === cardId);
    if (!card) {
        throw new Error(`Pilot card ${cardId} not found in ${playerId} hand`);
    }
    return card.carduid;
}

function pickUnitCarduid(gameEnv, playerId, cardId) {
    const zones = gameEnv.players[playerId]?.zones || {};
    const slots = Object.values(zones);
    for (const slot of slots) {
        if (slot?.unit?.cardId === cardId) {
            return slot.unit.carduid;
        }
    }
    throw new Error(`Unit card ${cardId} not found for ${playerId}`);
}

function collectUnits(gameEnv, playerId) {
    const zones = gameEnv.players[playerId]?.zones || {};
    const units = [];

    for (const [zoneName, slot] of Object.entries(zones)) {
        if (slot?.unit) {
            units.push({
                zoneName,
                carduid: slot.unit.carduid,
                cardId: slot.unit.cardId,
                continueModifyAP: slot.unit.continueModifyAP
            });
        }
    }

    return units;
}

function assertPairApBoost(units, expectedBoost, label) {
    if (units.length === 0) {
        throw new Error(`${label}: no units found to validate`);
    }

    const failures = units.filter((unit) => (unit.continueModifyAP ?? 0) !== expectedBoost);
    if (failures.length > 0) {
        const details = failures
            .map((unit) => `${unit.cardId}(${unit.carduid})=${unit.continueModifyAP ?? 0}`)
            .join(', ');
        throw new Error(`${label}: unexpected continueModifyAP values: ${details}`);
    }
}

async function main() {
    const startResponse = await requestJson(
        'POST',
        `${BASE_URL}/api/game/player/startGame`,
        { playerId: PLAYER_A, gameConfig: { playerName: 'Demo Player' } }
    );
    const gameId = startResponse.gameId;

    const scenarioResponse = await requestJson(
        'GET',
        `${BASE_URL}/api/game/test/getTestScenario?scenarioPath=${encodeURIComponent(SCENARIO_PATH)}`
    );
    const scenario = scenarioResponse.scenario;
    const initialGameEnv = scenario.initialGameEnv;

    await requestJson('POST', `${BASE_URL}/api/game/test/injectGameState`, {
        gameId,
        gameEnv: initialGameEnv
    });

    const amuroCarduid = pickPilotCarduid(initialGameEnv, PLAYER_A, 'ST01-010');
    const gundamCarduid = pickUnitCarduid(initialGameEnv, PLAYER_A, 'ST01-001');

    await requestJson('POST', `${BASE_URL}/api/game/player/playCard`, {
        gameId,
        playerId: PLAYER_A,
        action: {
            type: 'PlayCard',
            carduid: amuroCarduid,
            playAs: 'pilot',
            targetUnit: gundamCarduid
        }
    });

    const playerState = await requestJson(
        'GET',
        `${BASE_URL}/api/game/player/${PLAYER_A}?gameId=${encodeURIComponent(gameId)}`
    );
    const gameEnv = playerState.gameEnv;

    const playerAUnits = collectUnits(gameEnv, PLAYER_A);
    const playerBUnits = collectUnits(gameEnv, PLAYER_B);

    assertPairApBoost(playerAUnits, 1, 'Player A units');
    assertPairApBoost(playerBUnits, 0, 'Player B units');

    console.log('✅ Pair AP boost applies on your turn: PASS');
}

main().catch((error) => {
    console.error('❌ Pair AP boost applies on your turn: FAIL');
    console.error(error.message);
    process.exit(1);
});
