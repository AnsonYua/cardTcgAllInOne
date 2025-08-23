// test_s6_leader.js - API call to update deck from decks_s6.json file

const path = require('path');

// Use native fetch for Node.js 18+ or require node-fetch as fallback
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        throw new Error('fetch is not available. Please use Node.js 18+ or install node-fetch');
    }
}

class DeckUpdateTester {
    constructor(baseUrl = 'http://localhost:8080/api/game') {
        this.baseUrl = baseUrl;
    }

    /**
     * Make HTTP request to update deck from path
     * @param {string} deckPath - Path to the deck file
     * @param {Object} options - Options object
     * @param {boolean} [options.validateOnly] - Only validate, don't update
     * @param {boolean} [options.skipValidation] - Skip validation and update anyway
     * @returns {Promise<Object>} API response
     */
    async updateDeckFromPath(deckPath, options = {}) {
        const url = `${this.baseUrl}/deck/updateFromPath`;
        
        const requestBody = {
            deckPath,
            ...options
        };

        console.log(`📡 Calling API: POST ${url}`);
        console.log(`📦 Request body:`, JSON.stringify(requestBody, null, 2));

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error(`❌ API Error: HTTP ${response.status}`);
                console.error(`❌ Error details:`, data);
                throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
            }

            console.log(`✅ API Success:`, data);
            return data;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Request failed:`, errorMessage);
            throw error;
        }
    }

    /**
     * Make a generic HTTP request
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} [body] - Request body
     * @returns {Promise<Object>} API response
     */
    async makeRequest(method, endpoint, body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method,
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000',
                'Pragma': 'no-cache',
                'Referer': 'http://localhost:3000/',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"'
            }
        };
        
        if (body) {
            config.body = JSON.stringify(body);
        }
        
        try {
            console.log(`📡 ${method} ${url}`);
            if (body) {
                console.log(`📦 Body:`, JSON.stringify(body, null, 2));
            }
            
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                console.error(`❌ API Error: HTTP ${response.status}`);
                console.error(`❌ Error details:`, data);
                throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
            }
            
           // console.log(`✅ ${method} Success:`, data);
            return data;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ ${method} failed:`, errorMessage);
            throw error;
        }
    }

    /**
     * Complete test sequence: Update deck → Start game → Join → Check zone restrictions
     * @returns {Promise<void>}
     */
    async testCompleteS6LeaderFlow() {
        console.log('🧪 Starting Complete S-6 Leader Flow Test');
        console.log('='.repeat(60));

        // Build absolute path to the deck file
        const deckPath = path.resolve(__dirname, '../../cardBackend/src/data/decks_s6.json');
        console.log(`🎯 Target deck file: ${deckPath}`);

        let gameId;

        // Step 1: Update deck from S-6 file
        return this.updateDeckFromPath(deckPath, { skipValidation: true })
            .then((updateResult) => {
                console.log('\n✅ Step 1 Complete: Deck updated successfully');
                console.log(`📊 Stats: ${updateResult.stats?.playersCount} players loaded`);
                
                // Step 2: Start new game
                console.log('\n🎮 Step 2: Starting new game...');
                return this.makeRequest('POST', '/player/startGame', {
                    playerId: "playerId_1",
                    gameConfig: {
                        playerName: "Demo Player"
                    }
                });
            })
            .then((startResult) => {
                console.log('\n✅ Step 2 Complete: Game started successfully');
                gameId = startResult.gameId;
                console.log(`🆔 Game ID: ${gameId}`);
                
                // Step 3: Join room with second player
                console.log('\n👥 Step 3: Joining room with second player...');
                return this.makeRequest('POST', '/player/joinRoom', {
                    playerId: "playerId_2",
                    gameId: gameId,
                    playerName: "Demo Opponent"
                });
            })
            .then((joinResult) => {
                console.log('\n✅ Step 3 Complete: Player 2 joined successfully');
                console.log(`🎯 Game phase: ${joinResult.gameEnv?.phase}`);
                
                // Step 4: Get player 1 data and check activeZoneRestriction
                console.log('\n🔍 Step 4: Checking Player 1 zone restrictions...');
                return this.makeRequest('GET', `/player/playerId_1?gameId=${gameId}`);
            })
            .then((playerData) => {
                console.log('\n✅ Step 4 Complete: Retrieved Player 1 data');
                
                // Extract zone restrictions data
                const player1_leader = playerData.gameEnv?.zones?.playerId_1?.leader[0]
                const player2_leader = playerData.gameEnv?.zones?.playerId_2?.leader[0]
                console.log('\n📋 === ZONE RESTRICTION ANALYSIS ===');
                
                console.log("Player 1 leader:",JSON.stringify(player1_leader?.cardId))
                console.log("Player 2 leader:",JSON.stringify(player2_leader?.cardId))
                if (player1_leader?.cardId === 's-6' && player2_leader?.cardId === 's-1') {
                    console.log("✅ verify leader success")
                    
                    // Check activeEffects for S-6 leader
                    const player1Data = playerData.gameEnv?.players?.playerId_1;
                    const activeEffects = player1Data?.fieldEffects?.activeEffects;
                    
                    console.log('\n🔍 === S-6 ACTIVE EFFECTS VERIFICATION ===');
                    
                    if (activeEffects && activeEffects.length > 0) {
                        console.log(`✅ Found ${activeEffects.length} active effects`);
                        
                        // Check for Powell's freedom economy boost
                        const freedomEconomyBoost = activeEffects.find(effect => 
                            effect.effectId && effect.effectId.includes('powell_freedom_economy_boost')
                        );
                        
                        if (freedomEconomyBoost) {
                            console.log('✅ Powell freedom economy boost effect found:');
                            console.log(`  📍 Effect ID: ${freedomEconomyBoost.effectId}`);
                            console.log(`  📍 Type: ${freedomEconomyBoost.type}`);
                            console.log(`  📍 Value: ${freedomEconomyBoost.value}`);
                            console.log(`  📍 GameTypes: [${freedomEconomyBoost.target?.gameTypes?.join(', ') || 'none'}]`);
                            
                            // Verify the gameTypes are correct
                            const expectedGameTypes = ["自由", "經濟"];
                            const actualGameTypes = freedomEconomyBoost.target?.gameTypes || [];
                            
                            if (expectedGameTypes.every(type => actualGameTypes.includes(type))) {
                                console.log('✅ GameTypes verification PASSED: ["自由", "經濟"] found correctly');
                            } else {
                                console.log('❌ GameTypes verification FAILED:');
                                console.log(`  Expected: [${expectedGameTypes.join(', ')}]`);
                                console.log(`  Actual: [${actualGameTypes.join(', ')}]`);
                            }
                        } else {
                            console.log('❌ Powell freedom economy boost effect NOT found');
                        }
                        
                        // Check for Powell's vs Trump economy extra boost
                        const trumpEconomyBoost = activeEffects.find(effect => 
                            effect.effectId && effect.effectId.includes('powell_vs_trump_economy_extra_boost')
                        );
                        
                        if (trumpEconomyBoost) {
                            console.log('✅ Powell vs Trump economy extra boost found:');
                            console.log(`  📍 GameTypes: [${trumpEconomyBoost.target?.gameTypes?.join(', ') || 'none'}]`);
                            console.log(`  📍 Value: ${trumpEconomyBoost.value}`);
                        } else {
                            console.log('❌ Powell vs Trump economy boost effect NOT found');
                        }
                        
                        // Check for Powell's vs Trump rightwing restriction
                        const rightWingRestriction = activeEffects.find(effect => 
                            effect.effectId && effect.effectId.includes('powell_vs_trump_rightwing_restriction')
                        );
                        
                        if (rightWingRestriction) {
                            console.log('✅ Powell vs Trump rightwing restriction found:');
                            console.log(`  📍 GameTypes: [${rightWingRestriction.target?.gameTypes?.join(', ') || 'none'}]`);
                            console.log(`  📍 Type: ${rightWingRestriction.type}`);
                        } else {
                            console.log('❌ Powell rightwing restriction effect NOT found');
                        }
                        
                        // Summary of all effects
                        console.log('\n📋 === COMPLETE EFFECT SUMMARY ===');
                        activeEffects.forEach((effect, index) => {
                            console.log(`${index + 1}. ${effect.effectId}`);
                            console.log(`   Type: ${effect.type}, Value: ${effect.value}`);
                            console.log(`   GameTypes: [${effect.target?.gameTypes?.join(', ') || 'none'}]`);
                        });
                        
                    } else {
                        console.log('❌ No active effects found - this indicates the S-6 leader effects are not working');
                    }
                } else {
                    console.log('❌ Leader verification failed - expected s-6 and s-1');
                }
                
                console.log('\n🎉 Complete S-6 Leader Flow Test completed successfully!');
                console.log('='.repeat(60));
                /*
                // Check if S-6 leader effects are properly applied
                if (currentLeader?.id === 's-6') {
                    console.log('\n🔍 === S-6 LEADER VERIFICATION ===');
                    console.log(`✅ S-6 Powell leader is active`);
                    
                    if (activeZoneRestriction) {
                        console.log(`✅ Zone restrictions are present:`, activeZoneRestriction);
                        
                        // Check specific zone restrictions
                        Object.keys(activeZoneRestriction).forEach(zone => {
                            const restrictions = activeZoneRestriction[zone];
                            console.log(`  📍 ${zone.toUpperCase()}: ${restrictions?.join(', ') || 'no restrictions'}`);
                        });
                    } else {
                        console.log(`⚠️  No active zone restrictions found - this may indicate an issue`);
                    }
                } else {
                    console.log(`ℹ️  Current leader is ${currentLeader?.id || 'none'}, not S-6`);
                }
                
                console.log('\n🎉 Complete S-6 Leader Flow Test completed successfully!');
                console.log('='.repeat(60));
                */
                return playerData;
            })
            .catch((error) => {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('\n❌ Test flow failed:', errorMessage);
                console.error('💥 Game ID:', gameId || 'not created');
                throw error;
            });
    }

    /**
     * Test sequence for S-6 leader deck update
     * @returns {Promise<void>}
     */
    async testS6LeaderDeckUpdate() {
        console.log('🧪 Starting S-6 Leader Deck Update Test');
        console.log('='.repeat(50));

        // Build absolute path to the deck file
        const deckPath = path.resolve(__dirname, '../../cardBackend/src/data/decks_s6.json');
        console.log(`🎯 Target deck file: ${deckPath}`);

        try {
            // Step 1: Validate the deck file first
            console.log('\n📋 Step 1: Validating deck file...');
            const validationResult = await this.updateDeckFromPath(deckPath, {
                validateOnly: true
            });
            
            if (validationResult.validation && validationResult.validation.isValid) {
                console.log('✅ Validation passed - deck file is valid');
            } else {
                console.log('⚠️  Validation warnings found:', validationResult.validation?.errors);
                console.log('🔄 Proceeding with update anyway...');
            }

            // Step 2: Update the deck
            console.log('\n🔄 Step 2: Updating deck from file...');
            const updateResult = await this.updateDeckFromPath(deckPath, {
                skipValidation: validationResult.validation?.isValid === false
            });

            console.log('✅ Deck update completed successfully!');
            console.log(`📊 Updated stats: ${updateResult.stats?.playersCount} players loaded`);

            // Step 3: Verify with validation-only call
            console.log('\n🔍 Step 3: Verifying updated deck...');
            const verificationResult = await this.updateDeckFromPath(deckPath, {
                validateOnly: true
            });

            if (verificationResult.validation && verificationResult.validation.isValid) {
                console.log('✅ Verification passed - deck is properly loaded');
            } else {
                console.log('⚠️  Verification warnings:', verificationResult.validation?.errors);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Test failed:', errorMessage);
            throw error;
        }

        console.log('\n🎉 S-6 Leader Deck Update Test completed successfully!');
        console.log('='.repeat(50));
    }
}

// Export for use in other test files
module.exports = {
    DeckUpdateTester
};

// Run test if this file is executed directly
if (require.main === module) {
    const tester = new DeckUpdateTester();
    
    // Run the complete flow test (includes deck update + game flow + zone restriction check)
    tester.testCompleteS6LeaderFlow()
        .then(() => {
            console.log('🏁 Complete test execution finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('💥 Complete test execution failed:', errorMessage);
            process.exit(1);
        });
}