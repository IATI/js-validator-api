const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'no_spaces_act.json', file: '3act_bad.xml', expectedResult: false },
    { rule: 'no_spaces_act.json', file: '3act_good.xml', expectedResult: true },
    { rule: 'no_spaces_org.json', file: 'org_bad.xml', expectedResult: false },
    { rule: 'no_spaces_org.json', file: 'org_good.xml', expectedResult: true },
    { rule: 'no_spaces_attr.json', file: 'act_ref_bad.xml', expectedResult: false },
    { rule: 'no_spaces_attr.json', file: 'act_ref_good.xml', expectedResult: true },
];

describe('Base rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
