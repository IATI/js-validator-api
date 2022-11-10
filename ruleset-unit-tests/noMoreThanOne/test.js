import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';

import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'no_more_than_one_title.json', file: 'title.xml', expectedResult: true },
    { rule: 'no_more_than_one_title.json', file: 'empty_activity.xml', expectedResult: true },
    { rule: 'no_more_than_one_title.json', file: 'title_twice.xml', expectedResult: false },
    { rule: 'results_references.json', file: 'results_refs_good.xml', expectedResult: true },
    { rule: 'results_references.json', file: 'results_refs_bad.xml', expectedResult: false },
];

describe('noMoreThanOne rules', () => {
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
