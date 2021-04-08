const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'no_more_than_one_title.json', file: 'title.xml', expectedResult: true },
    { rule: 'no_more_than_one_title.json', file: 'empty_activity.xml', expectedResult: true },
    { rule: 'no_more_than_one_title.json', file: 'title_twice.xml', expectedResult: false },
    { rule: 'results_references.json', file: 'results_refs_good.xml', expectedResult: true },
    { rule: 'results_references.json', file: 'results_refs_bad.xml', expectedResult: false },
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
