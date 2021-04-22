const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'unique.json', file: 'bad.xml', expectedResult: false },
    { rule: 'unique.json', file: 'good.xml', expectedResult: true },
    { rule: 'unique_title_description.json', file: 'title_description.xml', expectedResult: false },
    {
        rule: 'unique_title_description.json',
        file: 'title_description_content.xml',
        expectedResult: true,
    },
    {
        rule: '1.1.3_unique_identifier.json',
        file: 'identifier_good.xml',
        expectedResult: true,
    },
    {
        rule: '1.1.3_unique_identifier.json',
        file: 'identifier_bad.xml',
        expectedResult: false,
    },
];

describe('unique rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
