const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { validateIATI } = require('../../services/rulesValidator');

const rule = 'identifier.json';

describe('dupIdentifier rules', () => {
    it(`Rule ${rule} for file 3act_good.xml should return and empty object`, async () => {
        const ruleSet = JSON.parse(await fs.readFile(`${__dirname}/rules/${rule}`));
        const xml = (await fs.readFile(`${__dirname}/test-files/3act_good.xml`)).toString();

        // file level errors
        expect(Object.keys(await validateIATI(ruleSet, xml)).length).to.eql(0);
    });

    it(`Rule ${rule} for file 3act_bad.xml should return a file level error`, async () => {
        const ruleSet = JSON.parse(await fs.readFile(`${__dirname}/rules/${rule}`));
        const xml = (await fs.readFile(`${__dirname}/test-files/3act_bad.xml`)).toString();

        // file level errors
        expect(await validateIATI(ruleSet, xml)).to.have.property('file');
    });
});
