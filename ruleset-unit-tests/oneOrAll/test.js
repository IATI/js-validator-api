const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

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
];

describe('oneOrAll rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
