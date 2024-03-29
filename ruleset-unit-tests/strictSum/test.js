import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'strict_sum.json', file: 'bad.xml', expectedResult: false },
    { rule: 'strict_sum.json', file: 'good.xml', expectedResult: true },
    { rule: 'sector_sum.json', file: 'sector_sum_bad.xml', expectedResult: false },
    { rule: 'sector_sum.json', file: 'sector_sum_good.xml', expectedResult: true },
    {
        rule: 'recipient_sum_cond.json',
        file: 'recipient_loc_country_only_good.xml',
        expectedResult: true,
    },
    {
        rule: 'recipient_sum_cond.json',
        file: 'recipient_loc_country_only_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'recipient_sum_cond.json',
        file: 'recipient_loc_with_region.xml',
        expectedResult: 'No Condition Match',
    },
    {
        rule: 'recipient_country_region.json',
        file: 'good_complex_decimals.xml',
        expectedResult: true,
    },
];

describe('strictSum rules', () => {
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
