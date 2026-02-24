const fs = require('fs');
const path = require('path');

function readFrontendFile(relativeParts) {
    const filePath = path.resolve(__dirname, '..', '..', '..', 'cardFrontend', 'src', ...relativeParts);
    return fs.readFileSync(filePath, 'utf8');
}

describe('Frontend TARGET_CHOICE pilot render regression guard', () => {
    test('DialogManager maps TARGET_CHOICE availableTargets to exact carduid entries', () => {
        const source = readFrontendFile(['managers', 'DialogManager.js']);

        expect(source).toMatch(/const eligibleCards = availableTargets\.map\(target => \(\{/);
        expect(source).toMatch(/dialogDisplayType:\s*'carduid'/);
        expect(source).toMatch(/type:\s*'carduid'/);
        expect(source).toMatch(/carduid:\s*target\.carduid/);
        expect(source).toMatch(/cardData:\s*target\.cardData/);
    });

    test('DialogUIManager bypasses slot reconstruction for exact carduid targets', () => {
        const source = readFrontendFile(['managers', 'DialogUIManager.js']);

        expect(source).toMatch(/const isExactCardTarget\s*=\s*[\s\S]*dialogDisplayType === 'carduid'[\s\S]*type === 'carduid'/);
        expect(source).toMatch(/if \(!isExactCardTarget\)\s*\{/);
        expect(source).toMatch(/SlotAreaManager\.getSlotFromCarduid\(scene\.gameStateManager,\s*originalCard\.carduid\)/);
        expect(source).toMatch(/const fallbackZone = isExactCardTarget \? 'hand' :/);
        expect(source).toMatch(/const showTotals = !isExactCardTarget/);
    });
});
