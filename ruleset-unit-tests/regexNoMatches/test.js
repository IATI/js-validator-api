import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';

import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'regex_no_matches.json', file: 'bad.xml', expectedResult: true },
    { rule: 'regex_no_matches.json', file: 'good.xml', expectedResult: false },
];

describe('regexNoMatches rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(
                await fs.readFile(new URL(`./rules/${test.rule}`, import.meta.url))
            );
            const xml = (
                await fs.readFile(new URL(`./test-files/${test.file}`, import.meta.url))
            ).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
