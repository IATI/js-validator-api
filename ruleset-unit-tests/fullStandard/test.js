import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { testRuleset } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'standard.json', file: 'iati-act-no-errors.xml', expectedResult: true },
    { rule: 'standard.json', file: 'iati-org-no-errors.xml', expectedResult: true },
];

describe('fullStandard rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return no falses`, async () => {
            const ruleSet = JSON.parse(
                await fs.readFile(new URL(`./rules/${test.rule}`, import.meta.url))
            );
            const xml = (
                await fs.readFile(new URL(`./test-files/${test.file}`, import.meta.url))
            ).toString();

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
