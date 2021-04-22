const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'starts_with.json', file: 'bad.xml', expectedResult: false },
    { rule: 'starts_with.json', file: 'good.xml', expectedResult: true },
    { rule: '1.1.1_identifiers.json', file: 'bad.xml', expectedResult: false },
    { rule: '1.1.1_identifiers.json', file: 'good.xml', expectedResult: true },
    { rule: '1.1.1_identifiers.json', file: 'other_id_good.xml', expectedResult: true },
    { rule: '1.1.1_identifiers.json', file: 'mult_other_id_good.xml', expectedResult: true },
    { rule: '1.1.1_identifiers.json', file: 'mult_other_id_bad.xml', expectedResult: false },
    { rule: '1.1.1_identifiers.json', file: 'other_id_bad.xml', expectedResult: false },
    { rule: '1.1.21_identifiers_separator.json', file: 'good.xml', expectedResult: true },
    {
        rule: '1.1.21_identifiers_separator.json',
        file: 'missing_separator_bad.xml',
        expectedResult: false,
    },
];

describe('startsWith rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
