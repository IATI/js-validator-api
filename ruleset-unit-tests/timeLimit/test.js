const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'time_limit.json', file: 'bad.xml', expectedResult: false },
    { rule: 'time_limit.json', file: 'good.xml', expectedResult: true },
    { rule: 'time_limit.json', file: 'one_day_bad.xml', expectedResult: false },
    { rule: 'time_limit.json', file: 'one_day_good.xml', expectedResult: true },
    { rule: 'time_limit.json', file: 'one_year_exactly.xml', expectedResult: true },
];

describe('timeLimit rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
