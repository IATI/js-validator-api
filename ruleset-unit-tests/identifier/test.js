const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { testRuleset } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'two_deep.json', file: 'two_deep.xml', expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'] },
];

describe('Base rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(testRuleset(rule, xml).map((res) => res.identifier)).to.eql(test.expectedResult);
        });
    });
});
