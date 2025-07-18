# Testing Guide - Running Individual Test Cases

This guide shows you how to run test cases one by one for the backend leader effects.

## Quick Start

### 1. List Available Test Cases
```bash
npm run test:simple list
```

### 2. Validate Test Scenarios (Recommended - Works without backend)
```bash
npm run test:simple validate leader_s-1_trump_boost.json --verbose
```

### 3. Run Interactive Test Runner (Requires backend)
```bash
npm run test:interactive
```

### 4. Run All Test Cases (Requires backend)
```bash
npm run test:all
```

### 5. Run Single Test Case (Requires backend)
```bash
npm run test:run leader_s-1_trump_boost.json
```

## Available Test Cases

### Trump (s-1) Tests
1. **`leader_s-1_trump_boost.json`**
   - **Effect**: Right-Wing and Patriot cards get +45 power
   - **Expected**: c-1 (Patriot) = 155 power, c-2 (Right-Wing) = 145 power

2. **`leader_s-1_trump_vs_powell_nerf.json`**
   - **Effect**: Against Powell, Economy cards set to 0 power
   - **Expected**: c-13 (Economy) = 0 power

### Biden (s-2) Tests
3. **`leader_s-2_biden_boost.json`**
   - **Effect**: All cards get +40 power
   - **Expected**: Universal +40 boost to all cards

### Musk (s-3) Tests
4. **`leader_s-3_musk_freedom_boost.json`**
   - **Effect**: Freedom cards get +50 power
   - **Expected**: Freedom cards get +50 boost

5. **`leader_s-3_musk_doge_boost.json`**
   - **Effect**: Cards with "Doge" in name get additional +20 power
   - **Expected**: Doge cards get both Freedom (+50) and Doge (+20) boosts

### Harris (s-4) Tests
6. **`leader_s-4_harris_leftwing_boost.json`**
   - **Effect**: Left-Wing cards get +40 power
   - **Expected**: Left-Wing cards get +40 boost

7. **`leader_s-4_harris_economy_boost.json`**
   - **Effect**: Economy cards get +20 power
   - **Expected**: Economy cards get +20 boost

8. **`leader_s-4_harris_vs_trump_nerf.json`**
   - **Effect**: Against Trump, right zone cards set to 0 power
   - **Expected**: Right zone cards = 0 power

### Vance (s-5) Tests
9. **`leader_s-5_vance_boosts.json`**
   - **Effect**: Multiple boosts - Right-Wing +40, Freedom +20, Economy +10
   - **Expected**: Different cards get different boosts based on type

### Powell (s-6) Tests
10. **`leader_s-6_powell_boost.json`**
    - **Effect**: Freedom and Economy cards get +30 power
    - **Expected**: Freedom/Economy cards get +30 boost

11. **`leader_s-6_powell_vs_trump_boost.json`**
    - **Effect**: Against Trump, Economy cards get additional +20 power
    - **Expected**: Economy cards get +50 total (+30 base + 20 conditional)

12. **`leader_s-6_powell_vs_trump_restriction.json`**
    - **Effect**: Against Trump, cannot summon Right-Wing cards
    - **Expected**: Right-Wing summon restriction active

## Command Reference

### Simple Test Runner (Recommended - No backend required)
```bash
npm run test:simple list                                      # List all scenarios
npm run test:simple validate <filename>                       # Validate scenario structure
npm run test:simple validate <filename> --verbose             # Validate with details

# Examples:
npm run test:simple validate leader_s-1_trump_boost.json
npm run test:simple validate leader_s-1_trump_boost.json --verbose
```

### Interactive Mode (Requires backend)
```bash
npm run test:interactive
```
- Shows a menu with all test cases
- Select by number
- Choose verbose output
- Easy to use interface

### List All Available Tests
```bash
npm run test:list
```

### Run All Tests (Requires backend)
```bash
npm run test:all              # Run all tests
npm run test:all --verbose    # Run all tests with detailed output
```

### Run Single Test (Requires backend)
```bash
npm run test:run <filename>
npm run test:run <filename> --verbose

# Examples:
npm run test:run leader_s-1_trump_boost.json
npm run test:run leader_s-1_trump_boost.json --verbose
```

### Direct Node Commands
```bash
# Using node directly
node src/tests/runSingleTest.js list
node src/tests/runSingleTest.js run leader_s-1_trump_boost.json
node src/tests/runSingleTest.js all --verbose
```

## Understanding Test Output

### Successful Test Output
```
🧪 Running: leader_s-1_trump_boost.json
==================================================

📊 Validation Results:
✅ Validate power of c-1 (Patriot) with Trump's boost
   Card: c-1, Expected: 155, Actual: 155
✅ Validate power of c-2 (Right-Wing) with Trump's boost
   Card: c-2, Expected: 145, Actual: 145

📈 Summary: 2 passed, 0 failed (1250ms)
```

### Failed Test Output
```
🧪 Running: leader_s-1_trump_boost.json
==================================================

📊 Validation Results:
❌ Validate power of c-1 (Patriot) with Trump's boost
   Card: c-1, Expected: 155, Actual: 100
✅ Validate power of c-2 (Right-Wing) with Trump's boost
   Card: c-2, Expected: 145, Actual: 145

📈 Summary: 1 passed, 1 failed (1250ms)
```

### Verbose Output
When using `--verbose`, you'll see additional information:
- Leader names for both players
- Current game phase
- Detailed scenario information

## Troubleshooting

### Common Issues

1. **"Connection refused" or server errors**
   - Make sure no other process is using port 8080
   - The test runner automatically starts/stops the server

2. **"File not found" errors**
   - Make sure you're running from the cardBackend directory
   - Check that the scenario file exists in `shared/testScenarios/gameStates/`

3. **Test validation failures**
   - Check that the backend logic matches the expected behavior
   - Verify the test scenario data is correct

### Debug Commands
```bash
# Validate test setup
npm run test:validate

# Run with verbose output for debugging
npm run test:run <filename> --verbose

# Check available scenarios
npm run test:list
```

## Testing Workflow

1. **Start with interactive mode** to get familiar with the tests:
   ```bash
   npm run test:interactive
   ```

2. **Run specific failing tests** to debug issues:
   ```bash
   npm run test:run leader_s-1_trump_boost.json --verbose
   ```

3. **Run all tests** to validate overall functionality:
   ```bash
   npm run test:all
   ```

4. **Use Jest for unit testing**:
   ```bash
   npm test
   ```

The individual test runner is perfect for debugging specific leader effects and understanding how the power calculations work!