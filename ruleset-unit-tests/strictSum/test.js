const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

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
];

describe('strictSum rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
