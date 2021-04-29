const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: '3.6.2_recipient_loc.json', file: 'activity_only_good.xml', expectedResult: true },
    { rule: '3.6.2_recipient_loc.json', file: 'activity_and_trans_bad.xml', expectedResult: false },
    { rule: '3.6.2_recipient_loc.json', file: 'one_trans_good.xml', expectedResult: true },
    { rule: '3.6.2_recipient_loc.json', file: 'two_trans_bad.xml', expectedResult: true },
    { rule: '3.6.2_recipient_loc.json', file: 'two_trans_both_good.xml', expectedResult: true },
    { rule: '3.6.2_recipient_loc.json', file: 'two_trans_country_good.xml', expectedResult: true },
    { rule: '3.7.1_recipient_loc.json', file: 'activity_only_good.xml', expectedResult: true },
    { rule: '3.7.1_recipient_loc.json', file: 'activity_and_trans_bad.xml', expectedResult: true },
    { rule: '3.7.1_recipient_loc.json', file: 'one_trans_good.xml', expectedResult: true },
    { rule: '3.7.1_recipient_loc.json', file: 'two_trans_bad.xml', expectedResult: true },
    { rule: '3.7.1_recipient_loc.json', file: 'two_trans_both_good.xml', expectedResult: true },
    { rule: '3.7.1_recipient_loc.json', file: 'two_trans_country_good.xml', expectedResult: true },
    { rule: '3.7.2_recipient_loc.json', file: 'activity_only_good.xml', expectedResult: true },
    { rule: '3.7.2_recipient_loc.json', file: 'activity_and_trans_bad.xml', expectedResult: true },
    { rule: '3.7.2_recipient_loc.json', file: 'one_trans_good.xml', expectedResult: true },
    { rule: '3.7.2_recipient_loc.json', file: 'two_trans_bad.xml', expectedResult: false },
    { rule: '3.7.2_recipient_loc.json', file: 'two_trans_both_good.xml', expectedResult: true },
    { rule: '3.7.2_recipient_loc.json', file: 'two_trans_country_good.xml', expectedResult: true },
];

describe('onlyOneOf rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
