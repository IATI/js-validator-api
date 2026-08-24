import fs from 'fs/promises';
import { fileURLToPath } from 'url';
// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { XmlDocument, XsdValidator, XmlValidateError } from 'libxml2-wasm';
import { xmlRegisterFsInputProviders } from 'libxml2-wasm/lib/nodejs.mjs';

import { validateIATI } from '../services/rulesValidator.js';

const { expect } = chai;

/*
 * Schema validation tests.
 *
 * Tests developed to prior to replacing libxmljs2. See issue: Upgrade version
 * of libxmljs2 used to bring in line with Dashboard validation
 * https://github.com/IATI/js-validator-api/issues/574
 *
 * This upgrade is necessary to fix a defect in libxml2's handling of xs:decimal
 * highlighted by the following issues:
 * https://github.com/IATI/validator-web/issues/1002
 * https://github.com/IATI/IATI-Dashboard/issues/845
 *
 * These exercise the XSD schema path. Nothing in ruleset-unit-tests/ does: 20 of its 24
 * suites go through allRulesResult or testRuleset, which never touch a schema at all,
 * and the two that do call validateIATI pass three arguments - leaving its 4th
 * parameter (schema) undefined, so the `if (schema)` guards short-circuit. A schema
 * regression has therefore been invisible to PR CI.
 *
 * Picked up by the `npm run unit:test` glob, so PR CI runs it with everything else.
 *
 * Only 2.03 fixtures are validated, though config.VERSIONS is 2.01, 2.02 and 2.03. The
 * defect is in libxml2's handling of xs:decimal, an XSD built-in type, so it behaves the
 * same whichever IATI schema references it - checked against all three. What does differ
 * between versions is the schema content itself, so the Schema compilation block builds
 * all six rather than assuming 2.03 speaks for the rest.
 */

const DECIMAL_ERROR = "is not a valid value of the atomic type 'xs:decimal'";
const DATETIME_ERROR = "is not a valid value of the atomic type 'xs:dateTime'";

const testMap = [
    {
        file: 'org_value_sign_only.xml',
        fileType: 'iati-organisations',
        what: 'a sign-only decimal "  -  " is rejected (the defect reported in #1002)',
        occurrences: 1,
        message: DECIMAL_ERROR,
    },
    {
        file: 'org_value_plus_only.xml',
        fileType: 'iati-organisations',
        what: 'a sign-only decimal "  +  " is rejected',
        occurrences: 1,
        message: DECIMAL_ERROR,
    },
    {
        file: 'act_value_sign_only.xml',
        fileType: 'iati-activities',
        what: 'a sign-only decimal is rejected in an activity file too',
        occurrences: 1,
        message: DECIMAL_ERROR,
    },
    {
        file: 'org_value_long_decimal.xml',
        fileType: 'iati-organisations',
        what: 'a 30-digit decimal is accepted (the inverse defect - the old parser rejects it)',
        occurrences: 0,
    },
    {
        // Anonymised copy of the real file that triggered #1002. Adds what the minimal
        // fixtures don't: five occurrences of one defect, which validateSchema groups
        // by message into a single error carrying five contexts.
        file: 'org_value_sign_only_multiple.xml',
        fileType: 'iati-organisations',
        what: 'repeated sign-only decimals are all reported, with their line numbers',
        occurrences: 5,
        // One below the file's actual lines (89, 125, 149, 157, 245). validateIATI
        // validates each organisation as its own re-wrapped document and reconstructs
        // line numbers by offset arithmetic, which lands one low for this fixture.
        lines: [88, 124, 148, 156, 244],
        message: DECIMAL_ERROR,
    },
    {
        // The libraries disagree on when a parse failure is fatal: libxmljs2 threw only
        // if no document could be built, libxml2-wasm throws whenever the parser
        // recorded anything at all. An undeclared namespace prefix is not fatal to
        // building a tree, so it must stay a schema error here rather than becoming a
        // file-level parse error. See utils/xmlParse.js, which restores the old rule.
        file: 'org_undeclared_ns_prefix.xml',
        fileType: 'iati-organisations',
        what: 'an undeclared namespace prefix is a schema error, not a parse failure',
        occurrences: 1,
        message: 'This element is not expected',
    },
    {
        // Positive control. Guards against the suite going green by not validating at
        // all - validateIATI silently skips schema work when `schema` is undefined.
        file: 'org_bad_datetime.xml',
        fileType: 'iati-organisations',
        what: 'CONTROL: an invalid xs:dateTime is still caught',
        occurrences: 1,
        message: DATETIME_ERROR,
    },
    {
        // Negative control.
        file: 'org_valid.xml',
        fileType: 'iati-organisations',
        what: 'CONTROL: a valid file reports nothing',
        occurrences: 0,
    },
];

// Lets xsd:include / xsd:import resolve from disk. utils.js registers these too, under a
// comment saying it must happen once per process - which holds because this suite
// deliberately does not import utils.js, that being what keeps it free of Redis. If the
// two are ever loaded together, one of these calls has to go.
xmlRegisterFsInputProviders();

/*
 * Reads an XSD and returns a compiled XsdValidator, mirroring what utils.js getSchema
 * now caches. Unlike libxmljs2, compilation happens here rather than being deferred to
 * validate(), so an unresolvable xsd:include throws at this point.
 */
const loadSchema = async (fileType, version) => {
    const xsdPath = fileURLToPath(
        new URL(`../schemas/${version}/${fileType}-schema.xsd`, import.meta.url),
    );
    const xsdDoc = XmlDocument.fromBuffer(await fs.readFile(xsdPath), { url: xsdPath });
    try {
        return XsdValidator.fromDoc(xsdDoc);
    } finally {
        xsdDoc.dispose();
    }
};

/*
 * Retained from the libxmljs2 version, where loadSchema could return a document whose
 * includes had silently failed to resolve. libxml2-wasm throws during compilation
 * instead, so this is now belt-and-braces - it still fails if a schema builds but
 * cannot validate.
 */
const assertSchemaUsable = (schema, fileType, version) => {
    const probe = XmlDocument.fromString(`<${fileType} version="${version}" />`);
    try {
        expect(() => schema.validate(probe)).to.throw(XmlValidateError);
    } finally {
        probe.dispose();
    }
};

// Rule evaluation is not under test here, so an empty ruleset and empty id sets.
const emptyRuleset = {};
const idSets = { 'ORG-ID': new Set(), 'ORG-ID-PREFIX': new Set() };

const runSchemaValidation = async (file, fileType, version) => {
    const xml = (await fs.readFile(new URL(`./test-files/${file}`, import.meta.url))).toString();
    const schema = await loadSchema(fileType, version);
    const { schemaErrors } = await validateIATI(
        emptyRuleset,
        xml,
        fileType,
        idSets,
        schema,
        false,
        false,
    );
    return schemaErrors;
};

// Errors sharing a message are grouped into one object carrying several contexts,
// so count contexts rather than error objects.
const countOccurrences = (schemaErrors) =>
    schemaErrors.reduce((total, error) => total + error.context.length, 0);

const reportedLines = (schemaErrors) =>
    schemaErrors
        .flatMap((error) => error.context.map((context) => context.text))
        .map((text) => {
            const match = /At line(?: greater than)?: (\d+)/.exec(text);
            return match ? Number(match[1]) : null;
        })
        .filter((line) => line !== null);

describe('Schema compilation', () => {
    // getSchema loads six schemas: three versions times two file types. Each pulls in
    // iati-common.xsd and xml.xsd, resolved relative to the baseUrl given at compile
    // time. The mechanism is identical for all six, but the content is not -
    // iati-common.xsd differs per version - so build every one. A schema that fails to
    // build is not obvious: see assertSchemaUsable.
    ['2.01', '2.02', '2.03'].forEach((version) => {
        ['iati-activities', 'iati-organisations'].forEach((fileType) => {
            it(`${fileType} ${version} compiles, resolving its includes`, async () => {
                const schema = await loadSchema(fileType, version);
                assertSchemaUsable(schema, fileType, version);
            });
        });
    });
});

describe('Schema validation', () => {
    testMap.forEach((test) => {
        it(`${test.file}: ${test.what}`, async () => {
            const schemaErrors = await runSchemaValidation(test.file, test.fileType, '2.03');

            expect(countOccurrences(schemaErrors)).to.equal(test.occurrences);

            schemaErrors.forEach((error) => {
                expect(error.id).to.equal('0.3.1');
                expect(error.severity).to.equal('critical');
                expect(error.category).to.equal('schema');
            });

            if (test.message) {
                schemaErrors.forEach((error) => {
                    expect(error.message).to.contain(test.message);
                });
            }

            if (test.lines) {
                expect(reportedLines(schemaErrors)).to.have.members(test.lines);
            }
        });
    });
});
