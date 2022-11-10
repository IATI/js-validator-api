import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';

import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'only_one_of.json', file: 'only_one_of_activity_bad.xml', expectedResult: false },
    { rule: 'only_one_of.json', file: 'only_one_of_activity_good.xml', expectedResult: true },
    { rule: 'only_one_of.json', file: 'only_one_of_transaction_bad.xml', expectedResult: false },
    { rule: 'only_one_of.json', file: 'only_one_of_transaction_good.xml', expectedResult: true },
];

describe('onlyOneOf rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(
                await fs.readFile(new URL(`./rules/${test.rule}`, import.meta.url))
            );
            const xml = (
                await fs.readFile(new URL(`./test-files/${test.file}`, import.meta.url))
            ).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
