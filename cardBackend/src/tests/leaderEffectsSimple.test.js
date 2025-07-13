const { loadTestScenario, injectGameState, performPlayerAction } = require('./testHelpers');

describe('Leader Card Effects - Comprehensive', () => {
    let gameId;

    beforeEach(() => {
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        process.env.NODE_ENV = 'development';
    });

    describe('Leader Effects Integration Tests', () => {
        it('should apply Trump leader effects correctly', async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);
            gameId = result.gameId;

            // Verify Trump leader is properly set up
            expect(result.gameEnv.playerId_1.Field.leader.name).toBe('特朗普');
            expect(result.gameEnv.playerId_1.Field.leader.initialPoint).toBe(110);
            
            // Verify zone compatibility
            expect(result.gameEnv.playerId_1.Field.leader.zoneCompatibility.top).toContain('右翼');
            expect(result.gameEnv.playerId_1.Field.leader.zoneCompatibility.left).toContain('愛國者');
        });

        it('should apply Biden leader effects correctly', async () => {
            const scenario = await loadTestScenario('leaderEffect_Biden');
            const result = await injectGameState(scenario);

            // Verify Biden leader setup
            expect(result.gameEnv.playerId_1.Field.leader.name).toBe('拜登');
            expect(result.gameEnv.playerId_1.Field.leader.initialPoint).toBe(100);
            
            // Biden accepts all card types in all zones
            expect(result.gameEnv.playerId_1.Field.leader.zoneCompatibility.top).toContain('all');
        });

        it('should apply Musk leader effects correctly', async () => {
            const scenario = await loadTestScenario('leaderEffect_Musk');
            const result = await injectGameState(scenario);

            // Verify Musk leader setup
            expect(result.gameEnv.playerId_1.Field.leader.name).toBe('馬斯克');
            expect(result.gameEnv.playerId_1.Field.leader.initialPoint).toBe(91);
            
            // Musk has specific zone compatibility
            expect(result.gameEnv.playerId_1.Field.leader.zoneCompatibility.top).toContain('自由');
            expect(result.gameEnv.playerId_1.Field.leader.zoneCompatibility.left).toContain('自由');
        });

        it('should apply Harris leader effects correctly', async () => {
            const scenario = await loadTestScenario('leaderEffect_Harris');
            const result = await injectGameState(scenario);

            // Verify Harris leader setup
            expect(result.gameEnv.playerId_1.Field.leader.name).toBe('賀錦麗');
            expect(result.gameEnv.playerId_1.Field.leader.initialPoint).toBe(69);
            
            // Check opponent is Trump (for conditional effects)
            expect(result.gameEnv.playerId_2.Field.leader.name).toBe('特朗普');
        });

        it('should handle Trump vs Powell scenario correctly', async () => {
            const scenario = await loadTestScenario('leaderEffect_TrumpVsPowell');
            const result = await injectGameState(scenario);

            // Verify the matchup
            expect(result.gameEnv.playerId_1.Field.leader.name).toBe('特朗普');
            expect(result.gameEnv.playerId_2.Field.leader.name).toBe('鮑威爾');
            
            // This scenario should trigger Trump's anti-Powell effect
            expect(result.gameEnv.playerId_1.Field.leader.effects.rules.length).toBeGreaterThan(1);
        });

        it('should maintain leader priority ordering', async () => {
            // Test leader initial points for SP phase priority
            const priorities = [];
            
            const trumpScenario = await loadTestScenario('leaderEffect_Trump');
            const trumpResult = await injectGameState(trumpScenario);
            priorities.push({
                name: trumpResult.gameEnv.playerId_1.Field.leader.name,
                priority: trumpResult.gameEnv.playerId_1.Field.leader.initialPoint
            });

            const bidenScenario = await loadTestScenario('leaderEffect_Biden');
            const bidenResult = await injectGameState(bidenScenario);
            priorities.push({
                name: bidenResult.gameEnv.playerId_1.Field.leader.name,
                priority: bidenResult.gameEnv.playerId_1.Field.leader.initialPoint
            });

            const muskScenario = await loadTestScenario('leaderEffect_Musk');
            const muskResult = await injectGameState(muskScenario);
            priorities.push({
                name: muskResult.gameEnv.playerId_1.Field.leader.name,
                priority: muskResult.gameEnv.playerId_1.Field.leader.initialPoint
            });

            const harrisScenario = await loadTestScenario('leaderEffect_Harris');
            const harrisResult = await injectGameState(harrisScenario);
            priorities.push({
                name: harrisResult.gameEnv.playerId_1.Field.leader.name,
                priority: harrisResult.gameEnv.playerId_1.Field.leader.initialPoint
            });

            // Sort by priority (highest first)
            priorities.sort((a, b) => b.priority - a.priority);

            // Verify correct order: Trump (110) > Biden (100) > Musk (91) > Harris (69)
            expect(priorities[0].name).toBe('特朗普');
            expect(priorities[0].priority).toBe(110);
            
            expect(priorities[1].name).toBe('拜登');
            expect(priorities[1].priority).toBe(100);
            
            expect(priorities[2].name).toBe('馬斯克');
            expect(priorities[2].priority).toBe(91);
            
            expect(priorities[3].name).toBe('賀錦麗');
            expect(priorities[3].priority).toBe(69);
        });

        it('should have proper leader effect rules structure', async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);

            const leader = result.gameEnv.playerId_1.Field.leader;
            
            // Verify leader has effects
            expect(leader.effects).toBeDefined();
            expect(leader.effects.rules).toBeDefined();
            expect(leader.effects.rules.length).toBeGreaterThan(0);
            
            // Verify rule structure
            const rule = leader.effects.rules[0];
            expect(rule.id).toBeDefined();
            expect(rule.type).toBe('continuous');
            expect(rule.trigger).toBeDefined();
            expect(rule.target).toBeDefined();
            expect(rule.effect).toBeDefined();
            
            // Verify target structure
            expect(rule.target.owner).toBe('self');
            expect(rule.target.zones).toContain('top');
            expect(rule.target.filters).toBeDefined();
            
            // Verify effect structure
            expect(rule.effect.type).toBe('modifyPower');
            expect(rule.effect.operation).toBe('add');
            expect(rule.effect.value).toBe(45);
        });

        it('should verify all leaders have zone compatibility', async () => {
            const scenarios = [
                'leaderEffect_Trump',
                'leaderEffect_Biden',
                'leaderEffect_Musk',
                'leaderEffect_Harris',
                'leaderEffect_Powell'
            ];

            for (const scenarioName of scenarios) {
                const scenario = await loadTestScenario(scenarioName);
                const result = await injectGameState(scenario);
                const leader = result.gameEnv.playerId_1.Field.leader;

                expect(leader.zoneCompatibility).toBeDefined();
                expect(leader.zoneCompatibility.top).toBeDefined();
                expect(leader.zoneCompatibility.left).toBeDefined();
                expect(leader.zoneCompatibility.right).toBeDefined();

                // Each zone should have at least one allowed type
                expect(leader.zoneCompatibility.top.length).toBeGreaterThan(0);
                expect(leader.zoneCompatibility.left.length).toBeGreaterThan(0);
                expect(leader.zoneCompatibility.right.length).toBeGreaterThan(0);
            }
        });

        it('should verify leader effect descriptions', async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);
            const leader = result.gameEnv.playerId_1.Field.leader;

            expect(leader.effects.description).toBeDefined();
            expect(Array.isArray(leader.effects.description)).toBe(true);
            expect(leader.effects.description.length).toBeGreaterThan(0);
            
            // Trump should have description about boosting right-wing/patriot
            expect(leader.effects.description[0]).toContain('右翼');
        });
    });

    describe('Card Playing Validation', () => {
        it('should validate game environment structure', async () => {
            const scenario = await loadTestScenario('leaderEffect_Trump');
            const result = await injectGameState(scenario);

            // Verify basic game structure
            expect(result.gameEnv).toBeDefined();
            expect(result.gameEnv.playerId_1).toBeDefined();
            expect(result.gameEnv.playerId_2).toBeDefined();
            expect(result.gameEnv.phase).toBe('MAIN_PHASE');
            expect(result.gameEnv.currentPlayer).toBe('playerId_1');

            // Verify player structures
            expect(result.gameEnv.playerId_1.deck).toBeDefined();
            expect(result.gameEnv.playerId_1.Field).toBeDefined();
            expect(result.gameEnv.playerId_1.Field.leader).toBeDefined();

            // Verify field zones
            expect(result.gameEnv.playerId_1.Field.top).toBeDefined();
            expect(result.gameEnv.playerId_1.Field.left).toBeDefined();
            expect(result.gameEnv.playerId_1.Field.right).toBeDefined();
            expect(result.gameEnv.playerId_1.Field.help).toBeDefined();
            expect(result.gameEnv.playerId_1.Field.sp).toBeDefined();
        });
    });
});