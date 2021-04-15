const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { testRuleset } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'standard.json', file: 'iati-act-no-errors.xml', expectedResult: true },
    { rule: 'standard.json', file: 'iati-org-no-errors.xml', expectedResult: true },
];

describe('fullStandard rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return no falses`, async () => {
            const ruleSet = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            // no falses === passed
            const counts = {};

            testRuleset(ruleSet, xml).forEach((result) => {
                counts[result.result] = (counts[result.result] || 0) + 1;
            });
            // No falses
            expect(!Object.keys(counts).includes('false')).to.equal(test.expectedResult);
        });
    });
});
