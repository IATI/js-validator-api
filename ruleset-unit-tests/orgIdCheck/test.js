import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { testRuleset } from '../../services/rulesValidator.js';

const { expect } = chai;

const idSets = {
    'ORG-ID': new Set(['US-EIN-941655673', '44000', 'CA_ON-ONT-1597880']),
    'ORG-ID-PREFIX': new Set(['GB-GOV', 'XM-DAC']),
};

const testMap = [
    {
        rule: 'X.X.13_org_id.json',
        file: 'X.X.13_org_id_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'X.X.13_org_id.json',
        file: 'X.X.13_org_id_good.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.13_org_id.json',
        file: 'X.X.13_org_id_existing.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.8_org_id.json',
        file: 'X.X.8_org_id_good.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.8_org_id.json',
        file: 'X.X.8_org_id_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'X.X.8_org_id.json',
        file: 'X.X.8_org_id_existing.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.13_act_id.json',
        file: 'X.X.13_act_id_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'X.X.13_act_id.json',
        file: 'X.X.13_act_id_good.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.13_act_id.json',
        file: 'X.X.13_act_id_existing_pre.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.8_act_id.json',
        file: 'X.X.8_act_id_good.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.8_act_id.json',
        file: 'X.X.8_act_id_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'X.X.8_act_id.json',
        file: 'X.X.8_act_id_existing_pre.xml',
        expectedResult: true,
    },
    {
        rule: 'X.X.8_act_id.json',
        file: 'X.X.8_act_id_existing_pre_2.xml',
        expectedResult: true,
    },
];

describe('orgIdCheck rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(
                await fs.readFile(new URL(`./rules/${test.rule}`, import.meta.url))
            );
            const xml = (
                await fs.readFile(new URL(`./test-files/${test.file}`, import.meta.url))
            ).toString();

            const results = testRuleset(rule, xml, idSets);

            expect(results.every((result) => result.result)).to.equal(test.expectedResult);
        });
    });
});
