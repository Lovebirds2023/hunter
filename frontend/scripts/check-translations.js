#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');
const translationsRoot = path.join(srcRoot, 'translations');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json']);

const mojibakePatterns = [
    {
        name: 'possible UTF-8 mojibake',
        regex: /(?:Ã[\u0080-\u00BF]|Â[\u0080-\u00BF]|â[^\x00-\x7F]|ð[^\x00-\x7F]|Ø[^\x00-\x7F]|Ù[^\x00-\x7F]|à[\u0080-\u00BF]|ä[\u0080-\u00BF]|æ[^\x00-\x7F])/gu,
    },
    {
        name: 'Unicode replacement character',
        regex: /\uFFFD/gu,
    },
];

const suspiciousTranslationPatterns = [
    {
        name: 'question mark at the beginning of a word',
        regex: /(^|[^A-Za-zÀ-ÖØ-öø-ÿ])\?[A-Za-zÀ-ÖØ-öø-ÿ]/gu,
    },
    {
        name: 'question mark inside a word',
        regex: /[A-Za-zÀ-ÖØ-öø-ÿ]\?[A-Za-zÀ-ÖØ-öø-ÿ]/gu,
    },
    {
        name: 'question mark after a hyphen in a word',
        regex: /[A-Za-zÀ-ÖØ-öø-ÿ]-\?[A-Za-zÀ-ÖØ-öø-ÿ]/gu,
    },
    {
        name: 'question mark used like a lowercase word',
        regex: /(^|[\s"':])\? [a-zà-öø-ÿ]/gu,
    },
];

function collectFiles(dir) {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectFiles(fullPath);
        return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
    });
}

function lineAndColumn(text, index) {
    const before = text.slice(0, index);
    const lines = before.split(/\r?\n/);
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
    };
}

function snippet(value) {
    return value.replace(/\s+/g, ' ').slice(0, 80);
}

function scanText(filePath, text, patterns, failures) {
    for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
            const position = lineAndColumn(text, match.index);
            failures.push({
                filePath,
                line: position.line,
                column: position.column,
                issue: pattern.name,
                value: snippet(match[0]),
            });
        }
    }
}

const failures = [];
const sourceFiles = collectFiles(srcRoot);
const translationFiles = collectFiles(translationsRoot).filter((file) => path.extname(file) === '.json');

for (const filePath of sourceFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    scanText(filePath, text, mojibakePatterns, failures);
}

for (const filePath of translationFiles) {
    const text = fs.readFileSync(filePath, 'utf8');
    try {
        JSON.parse(text);
    } catch (error) {
        failures.push({
            filePath,
            line: 1,
            column: 1,
            issue: `invalid JSON: ${error.message}`,
            value: '',
        });
    }
    scanText(filePath, text, suspiciousTranslationPatterns, failures);
}

if (failures.length > 0) {
    console.error('Translation/source character check failed:');
    for (const failure of failures) {
        const relativePath = path.relative(projectRoot, failure.filePath);
        console.error(
            `- ${relativePath}:${failure.line}:${failure.column} ${failure.issue}` +
            (failure.value ? ` (${failure.value})` : '')
        );
    }
    process.exit(1);
}

console.log('Translation/source character check passed.');
