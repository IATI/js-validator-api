const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'title_exists.json', file: 'empty.xml', expectedResult: true },
    { rule: 'title_exists.json', file: 'title.xml', expectedResult: true },
    { rule: 'title_text_exists.json', file: 'title.xml', expectedResult: false },
    { rule: 'title_text_exists.json', file: 'title_text.xml', expectedResult: true },
];

describe('atLeastOne rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
