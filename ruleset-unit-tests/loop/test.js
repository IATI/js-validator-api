const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'forloop.json', file: 'bad.xml', expectedResult: false },
    { rule: 'forloop.json', file: 'good.xml', expectedResult: true },
    { rule: 'forloop_recipient_loc.json', file: 'recipient_loc_good.xml', expectedResult: true },
    { rule: 'forloop_recipient_loc.json', file: 'recipient_loc_bad.xml', expectedResult: false },
    { rule: 'forloop_if_then.json', file: 'if_then_bad.xml', expectedResult: false },
    { rule: 'forloop_if_then.json', file: 'if_then_good.xml', expectedResult: true },
    { rule: 'forloop_condition.json', file: 'condition_good.xml', expectedResult: true },
    { rule: 'forloop_condition.json', file: 'condition_bad.xml', expectedResult: false },
    {
        rule: 'forloop_condition.json',
        file: 'condition_no_match.xml',
        expectedResult: 'No Condition Match',
    },
];

describe('loop rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
