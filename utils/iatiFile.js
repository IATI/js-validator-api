import { ParseOption } from 'libxml2-wasm';

import config from '../config/config.js';
import { parseXmlBuffer } from './xmlParse.js';

/*
 * These two are a standalone module rather than part of utils.js so that they can be unit
 * tested: importing utils.js pulls in config/redis.js, which connects at module load, and
 * starts the fire-and-forget loader that fetches from GitHub. Same reason xmlParse.js is
 * separate.
 */

/*
 * Parses the request body into a document for the caller to inspect and then dispose. The
 * caller owns it: documents hold memory outside the JS heap, where libxmljs2's were on it.
 * The library does register a FinalizationRegistry backstop, but its own docs say not to
 * rely on it - so the caller is responsible for freeing deterministically.
 *
 * Throws for a body that genuinely cannot be parsed, which callers report as 0.1.1. The
 * position they need is on `error.details[0]`, not on the error itself as libxmljs2 had it.
 */
const parseFileBody = (body) =>
    body.toString() === `<?xml version="1.0"?>\n`
        ? undefined
        : parseXmlBuffer(Buffer.from(body), ParseOption.XML_PARSE_HUGE);

/*
 * Reports what the validation pipeline needs in order to decide how to proceed: which IATI
 * file type this is, which version it declares, and whether that version is one we support.
 *
 * Reads the document and owns nothing - disposal stays with whoever called parseFileBody.
 * Accepts undefined so the blank-document case needs no special handling at the call site.
 */
const getFileInformation = (xmlDoc) => {
    let fileType = '';
    let version = '';
    let generatedDateTime = '';
    let supportedVersion;
    let isIati;
    if (xmlDoc !== undefined) {
        const root = xmlDoc.root.name;

        isIati = root === 'iati-activities' || root === 'iati-organisations';
        // set fileType to '' for non IATI files
        fileType = isIati ? root : '';

        // `!= null`, not `!== undefined`: libxmljs2 returned undefined for an absent
        // attribute where libxml2-wasm returns null, so the stricter check would fall
        // through to .value and throw.
        const versionAttr = xmlDoc.get(`/${fileType}/@version`);
        if (versionAttr != null) {
            version = versionAttr.value;
        }
        const generatedAttr = xmlDoc.get(`/${fileType}/@generated-datetime`);
        if (generatedAttr != null) {
            generatedDateTime = generatedAttr.value;
        }
        supportedVersion = version && config.VERSIONS.includes(version);
    }
    return {
        fileType,
        version,
        generatedDateTime,
        supportedVersion,
        isIati,
    };
};

export { parseFileBody, getFileInformation };
