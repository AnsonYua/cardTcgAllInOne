const ts = require('typescript');

module.exports = {
    process(sourceText, sourcePath) {
        if (!sourcePath.endsWith('.ts') && !sourcePath.endsWith('.tsx')) {
            return sourceText;
        }

        const result = ts.transpileModule(sourceText, {
            fileName: sourcePath,
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                esModuleInterop: true,
                sourceMap: true,
                inlineSources: true
            }
        });

        return {
            code: result.outputText,
            map: result.sourceMapText || undefined
        };
    }
};

