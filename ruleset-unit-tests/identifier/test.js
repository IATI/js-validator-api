import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { validateIATI } from '../../services/rulesValidator.js';

const { expect } = chai;

const testMap = [
    {
        rule: 'two_deep.json',
        file: '3act_good.xml',
        expectedResult: [],
        fileType: 'iati-activities',
    },
    {
        rule: 'activity_level.json',
        file: '3act_good.xml',
        expectedResult: [],
        fileType: 'iati-activities',
    },
    {
        rule: 'two_deep.json',
        file: '3act_bad.xml',
        expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'],
        fileType: 'iati-activities',
    },
    {
        rule: 'activity_level.json',
        file: '3act_bad.xml',
        expectedResult: ['ACT-1', 'ACT-2', 'ACT-3'],
        fileType: 'iati-activities',
    },
    {
        rule: 'org_level.json',
        file: 'org_good.xml',
        expectedResult: [],
        fileType: 'iati-organisations',
    },
    {
        rule: 'org_level.json',
        file: 'org_bad.xml',
        expectedResult: ['NP-SWC-1234'],
        fileType: 'iati-organisations',
    },
    {
        rule: 'activity_level.json',
        file: 'act_no_id.xml',
        expectedResult: ['ACT-1', 'noIdentifier', 'ACT-3'],
        fileType: 'iati-activities',
    },
];

describe('identifier rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(
                await fs.readFile(new URL(`./rules/${test.rule}`, import.meta.url))
            );
            const xml = (
                await fs.readFile(new URL(`./test-files/${test.file}`, import.meta.url))
            ).toString();

            expect(Object.keys((await validateIATI(rule, xml, test.fileType)).ruleErrors)).to.eql(
                test.expectedResult
            );
        });
    });
});
