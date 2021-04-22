const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'if_then.json', file: 'good.xml', expectedResult: true },
    { rule: 'if_then.json', file: 'bad.xml', expectedResult: false },
    { rule: 'dac_rec.json', file: 'good.xml', expectedResult: true },
    { rule: 'dac_rec.json', file: 'bad.xml', expectedResult: false },
    { rule: 'dac_rec.json', file: 'only_dac_good.xml', expectedResult: true },
    { rule: 'dac_rec.json', file: 'only_dac_null_good.xml', expectedResult: true },
    { rule: 'dac_rec.json', file: 'only_dac_blank_good.xml', expectedResult: true },
    { rule: 'dac_rec.json', file: 'blank_vocab_good.xml', expectedResult: true },
    { rule: 'dac_rec.json', file: 'default_vocab_good.xml', expectedResult: true },
    { rule: 'dac_rec.json', file: 'real_good.xml', expectedResult: true },
];

describe('ifThen rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
