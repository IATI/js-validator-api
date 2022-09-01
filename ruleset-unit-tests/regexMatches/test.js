import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';

import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'regex_matches_element.json', file: 'bad.xml', expectedResult: false },
    { rule: 'regex_matches_element.json', file: 'good.xml', expectedResult: true },
    { rule: 'regex_matches_attribute.json', file: 'bad.xml', expectedResult: false },
    { rule: 'regex_matches_attribute.json', file: 'good.xml', expectedResult: true },
    { rule: 'regex_matches_attribute.json', file: 'emptystring.xml', expectedResult: true },
    { rule: 'regex_matches_element.json', file: 'emptystring.xml', expectedResult: true },
];

describe('regexMatches rules', () => {
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
