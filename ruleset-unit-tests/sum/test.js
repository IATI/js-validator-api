import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'sum.json', file: 'bad.xml', expectedResult: false },
    { rule: 'sum.json', file: 'good.xml', expectedResult: true },
    { rule: 'sum_two.json', file: 'two_bad.xml', expectedResult: false },
    { rule: 'sum_two.json', file: 'two_good.xml', expectedResult: true },
];

describe('sum rules', () => {
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
