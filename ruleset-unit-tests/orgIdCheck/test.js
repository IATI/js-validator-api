const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { validateIATI } = require('../../services/rulesValidator');

const testMap = [
    {
        rule: 'X.X.8_org_id.json',
        file: 'org_id_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'X.X.8_org_id.json',
        file: 'org_id_good.xml',
        expectedResult: true,
    },
];

describe('orgIdCheck rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            const results = await validateIATI(rule, xml);

            expect(
                Object.keys(results).every((identifier) =>
                    results[identifier].every((val) => val.result)
                )
            ).to.eql(test.expectedResult);
        });
    });
});
