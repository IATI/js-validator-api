const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'only_one_of.json', file: 'only_one_of_activity_bad.xml', expectedResult: false },
    { rule: 'only_one_of.json', file: 'only_one_of_activity_good.xml', expectedResult: true },
    { rule: 'only_one_of.json', file: 'only_one_of_transaction_bad.xml', expectedResult: false },
    { rule: 'only_one_of.json', file: 'only_one_of_transaction_good.xml', expectedResult: true },
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
