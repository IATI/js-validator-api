const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'sum.json', file: 'bad.xml', expectedResult: false },
    { rule: 'sum.json', file: 'good.xml', expectedResult: true },
    { rule: 'sum_two.json', file: 'two_bad.xml', expectedResult: false },
    { rule: 'sum_two.json', file: 'two_good.xml', expectedResult: true },
];

describe('sum rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
