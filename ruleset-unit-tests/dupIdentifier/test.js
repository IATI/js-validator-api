import fs from 'fs/promises';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { validateIATI } from '../../services/rulesValidator.js';

const { expect } = chai;

const rule = 'identifier.json';

describe('dupIdentifier rules', () => {
    it(`Rule ${rule} for file 3act_good.xml should return and empty object`, async () => {
        const ruleSet = JSON.parse(await fs.readFile(new URL(`./rules/${rule}`, import.meta.url)));
        const xml = (
            await fs.readFile(new URL(`./test-files/3act_good.xml`, import.meta.url))
        ).toString();

        // file level errors
        expect(
            Object.keys((await validateIATI(ruleSet, xml, 'iati-activities')).ruleErrors).length
        ).to.eql(0);
    });

    it(`Rule ${rule} for file 3act_bad.xml should return a file level error`, async () => {
        const ruleSet = JSON.parse(await fs.readFile(new URL(`./rules/${rule}`, import.meta.url)));
        const xml = (
            await fs.readFile(new URL(`./test-files/3act_bad.xml`, import.meta.url))
        ).toString();

        // file level errors
        expect((await validateIATI(ruleSet, xml, 'iati-activities')).ruleErrors).to.have.property(
            'file'
        );
    });
});
