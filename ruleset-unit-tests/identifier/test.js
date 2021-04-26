const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { validateIATI } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'two_deep.json', file: '3act_good.xml', expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'] },
    {
        rule: 'activity_level.json',
        file: '3act_good.xml',
        expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'],
    },
    { rule: 'two_deep.json', file: '3act_bad.xml', expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'] },
    {
        rule: 'activity_level.json',
        file: '3act_bad.xml',
        expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'],
    },
    {
        rule: 'org_level.json',
        file: 'org_good.xml',
        expectedResult: ['NP-SWC-1234'],
    },
    {
        rule: 'org_level.json',
        file: 'org_bad.xml',
        expectedResult: ['NP-SWC-1234'],
    },
    {
        rule: 'activity_level.json',
        file: 'act_no_id.xml',
        expectedResult: ['ACT-1', 'noIdentifier', 'ACT-3'],
    },
];

describe('identifier rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(Object.keys(await validateIATI(rule, xml))).to.eql(test.expectedResult);
        });
    });
});
