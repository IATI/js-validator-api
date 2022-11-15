import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { allRulesResult } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    { rule: 'if_then.json', file: 'good.xml', expectedResult: true },
    { rule: 'if_then.json', file: 'bad.xml', expectedResult: false },
    { rule: '102.1.1_dac_rec.json', file: 'good.xml', expectedResult: true },
    { rule: '102.1.1_dac_rec.json', file: 'bad.xml', expectedResult: false },
    { rule: '102.1.1_dac_rec.json', file: 'only_dac_good.xml', expectedResult: true },
    { rule: '102.1.1_dac_rec.json', file: 'only_dac_null_good.xml', expectedResult: true },
    { rule: '102.1.1_dac_rec.json', file: 'only_dac_blank_good.xml', expectedResult: true },
    { rule: '102.1.1_dac_rec.json', file: 'blank_vocab_good.xml', expectedResult: true },
    { rule: '102.1.1_dac_rec.json', file: 'default_vocab_good.xml', expectedResult: true },
    { rule: '102.1.1_dac_rec.json', file: 'real_good.xml', expectedResult: true },
];

describe('ifThen rules', () => {
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
