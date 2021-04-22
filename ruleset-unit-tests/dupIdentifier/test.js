const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { validateIATI } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'identifier.json', file: '3act_good.xml', expectedResult: [] },
    {
        rule: 'identifier.json',
        file: '3act_bad.xml',
        expectedResult: {
            id: '1.1.2',
            severity: 'error',
            category: 'identifiers',
            message: `The activity identifier must be unique for each activity. Duplicate found for ACT-3`,
        },
    },
];

describe('Duplicate Identifier rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const ruleSet = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            // file level errors
            expect(validateIATI(ruleSet, xml).file).to.deep.include(test.expectedResult);
        });
    });
});
