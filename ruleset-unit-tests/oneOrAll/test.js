import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';

import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'one_or_all.json', file: 'lang_bad.xml', expectedResult: false },
    { rule: 'one_or_all.json', file: 'lang_good.xml', expectedResult: true },
    { rule: 'one_or_all.json', file: 'lang_bad_all.xml', expectedResult: false },
    { rule: 'one_or_all.json', file: 'lang_good_all.xml', expectedResult: true },
    { rule: 'one_or_all.json', file: 'sector_bad.xml', expectedResult: false },
    { rule: 'one_or_all.json', file: 'sector_good.xml', expectedResult: true },
    { rule: 'one_or_all.json', file: 'sector_all_bad.xml', expectedResult: false },
    { rule: 'one_or_all.json', file: 'sector_all_good.xml', expectedResult: true },
    { rule: 'one_or_all.json', file: 'currency_bad.xml', expectedResult: false },
    { rule: 'one_or_all.json', file: 'currency_good.xml', expectedResult: true },
    { rule: 'one_or_all.json', file: 'currency_all_bad.xml', expectedResult: false },
    { rule: 'one_or_all.json', file: 'currency_all_good.xml', expectedResult: true },
    { rule: 'one_or_all_org.json', file: 'org_currency_bad.xml', expectedResult: false },
    { rule: 'one_or_all_org.json', file: 'org_currency_good.xml', expectedResult: true },
    { rule: 'one_or_all_recipient_loc.json', file: 'recip_loc_good.xml', expectedResult: true },
    { rule: 'one_or_all_recipient_loc.json', file: 'recip_loc_bad.xml', expectedResult: false },
];

describe('oneOrAll rules', () => {
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
