// eslint-disable-next-line import/no-extraneous-dependencies
import chai from 'chai';
import { XmlParseError } from 'libxml2-wasm';

import { parseFileBody, getFileInformation } from '../utils/iatiFile.js';

const { expect } = chai;

/*
 * Tests for the first step of the validation pipeline: parse the body, then read what the
 * pipeline needs off the resulting document.
 *
 * Fixtures are inline rather than in test-files/, unlike the sibling suites: every case
 * here turns on one attribute of the root element, and a one-line string shows that more
 * clearly than a file does.
 *
 */

const testMap = [
    {
        what: 'the blank document xmllint --recover leaves behind yields no document',
        body: '<?xml version="1.0"?>\n',
        expected: {
            fileType: '',
            version: '',
            generatedDateTime: '',
            supportedVersion: undefined,
            isIati: undefined,
        },
        expectDocument: false,
    },
    {
        what: 'an iati-activities file reports its type, version and generated-datetime',
        body: '<iati-activities version="2.03" generated-datetime="2026-01-01T00:00:00Z"></iati-activities>',
        expected: {
            fileType: 'iati-activities',
            version: '2.03',
            generatedDateTime: '2026-01-01T00:00:00Z',
            supportedVersion: true,
            isIati: true,
        },
    },
    {
        what: 'an iati-organisations file is recognised too',
        body: '<iati-organisations version="2.03"></iati-organisations>',
        expected: {
            fileType: 'iati-organisations',
            version: '2.03',
            generatedDateTime: '',
            supportedVersion: true,
            isIati: true,
        },
    },
    {
        what: 'an absent version attribute is reported as empty, not thrown on',
        // The guard behind this is `!= null`, not `!== undefined`: libxmljs2 returned
        // undefined for a missing attribute where libxml2-wasm returns null, so the
        // stricter check would fall through to .value and throw - surfacing as a bogus
        // file-level 0.1.1 "not valid XML" instead of an unsupported-version report.
        body: '<iati-activities></iati-activities>',
        expected: {
            fileType: 'iati-activities',
            version: '',
            generatedDateTime: '',
            supportedVersion: '',
            isIati: true,
        },
    },
    {
        what: 'an absent generated-datetime is reported as empty',
        body: '<iati-activities version="2.03"></iati-activities>',
        expected: {
            fileType: 'iati-activities',
            version: '2.03',
            generatedDateTime: '',
            supportedVersion: true,
            isIati: true,
        },
    },
    {
        what: 'a version outside config.VERSIONS is flagged unsupported, driving error 0.6.1',
        body: '<iati-activities version="1.03"></iati-activities>',
        expected: {
            fileType: 'iati-activities',
            version: '1.03',
            generatedDateTime: '',
            supportedVersion: false,
            isIati: true,
        },
    },
    {
        what: 'a non-IATI root element is not IATI, and reports no file type',
        body: '<foo version="2.03"></foo>',
        expected: {
            fileType: '',
            version: '2.03',
            generatedDateTime: '',
            supportedVersion: true,
            isIati: false,
        },
    },
    {
        what: 'a version attribute on a nested element is picked up the same way',
        body: '<foo><bar version="2.03"/></foo>',
        expected: {
            fileType: '',
            version: '2.03',
            generatedDateTime: '',
            supportedVersion: true,
            isIati: false,
        },
    },
];

describe('parseFileBody / getFileInformation', () => {
    testMap.forEach((test) => {
        it(test.what, () => {
            let xmlDoc;
            try {
                xmlDoc = parseFileBody(test.body);
                if (test.expectDocument === false) {
                    expect(xmlDoc).to.equal(undefined);
                } else {
                    expect(xmlDoc).to.not.equal(undefined);
                }
                expect(getFileInformation(xmlDoc)).to.deep.equal(test.expected);
            } finally {
                xmlDoc?.dispose();
            }
        });
    });

    it('throws on an unparseable body, carrying the position error 0.1.1 reports', () => {
        let thrown;
        try {
            parseFileBody('<iati-activities><unclosed>');
        } catch (error) {
            thrown = error;
        }

        expect(thrown).to.be.instanceOf(XmlParseError);
        expect(thrown.details).to.be.an('array').with.length.greaterThan(0);
        expect(thrown.details[0].line).to.be.a('number');
        expect(thrown.details[0].col).to.be.a('number');
        expect(thrown.message).to.be.a('string').and.not.equal('');
    });

    it('tolerates an undeclared namespace prefix rather than failing to parse', () => {
        // libxml2-wasm throws whenever libxml2 recorded any error, even when a usable
        // document was produced; libxmljs2 threw only when no document could be built.
        // utils/xmlParse.js restores the older rule, and without it this file would be
        // rejected as a file-level 0.1.1 instead of reaching schema validation. The
        // schema-error side of this is covered by schema-unit-tests.
        let xmlDoc;
        try {
            xmlDoc = parseFileBody(
                '<iati-activities version="2.03"><iati-activity me:x="1"/></iati-activities>',
            );
            expect(xmlDoc).to.not.equal(undefined);
            const info = getFileInformation(xmlDoc);
            expect(info.isIati).to.equal(true);
            expect(info.fileType).to.equal('iati-activities');
            expect(info.version).to.equal('2.03');
        } finally {
            xmlDoc?.dispose();
        }
    });
});
