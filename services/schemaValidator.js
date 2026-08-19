import { XmlValidateError } from 'libxml2-wasm';
import { validateXMLrecover, getSchema } from '../utils/utils.js';
import { parseFileBody, getFileInformation } from '../utils/iatiFile.js';

// pvt-schema-validate-file-post
// Schema Check on full file, happens before full validation to enable the safety valve functionality in unified platform
const schemaValidateFile = async (context, req) => {
    try {
        let { body } = req;
        // No body
        if (!body || JSON.stringify(body) === '{}') {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'No body' },
            };

            return;
        }

        // Body should be a string
        if (typeof body !== 'string') {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Body must be an application/xml string' },
            };

            return;
        }

        try {
            // Clean input with xmllint for future steps, only need to replace body with this if no XML errors.
            const { output, error: xmlError } = await validateXMLrecover(body);

            if (!xmlError) {
                body = output;
            }
        } catch (error) {
            context.log(error);

            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    feedback: 'unhandled server error please contact the iati technical team',
                    error,
                },
            };
        }
        let fileType = '';
        let version = '';
        let isIati = '';
        let supportedVersion = '';
        // Undefined rather than '', so the xmlDoc?.dispose() below is a genuine no-op when
        // no document was produced. `''?.dispose()` would be a TypeError.
        let xmlDoc;

        // Parse file and get metadata for further checks
        try {
            xmlDoc = parseFileBody(body);
            ({ fileType, version, supportedVersion, isIati } = getFileInformation(xmlDoc));
        } catch (error) {
            // The parse may have succeeded and the inspection failed, so this path can own a
            // document. Unparseable input is simply not valid here, hence 200 either way.
            xmlDoc?.dispose();

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    valid: false,
                },
            };
            return;
        }

        // This scope owns xmlDoc from here: off-heap memory, so the finally below covers the
        // two early returns as well as the schema check. See validationService for why that
        // is deterministic rather than left to the library's FinalizationRegistry backstop.
        let schemaValid;
        try {
            // IATI Check
            if (!isIati) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        valid: false,
                    },
                };
                return;
            }

            // Version Check
            if (!supportedVersion) {
                context.res = {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        valid: false,
                    },
                };
                return;
            }

            try {
                getSchema(fileType, version).validate(xmlDoc);
                schemaValid = true;
            } catch (error) {
                if (!(error instanceof XmlValidateError)) throw error;
                schemaValid = false;
            }
        } finally {
            xmlDoc?.dispose();
        }

        if (!schemaValid) {
            context.res = {
                headers: { 'Content-Type': 'application/json' },
                body: { valid: false },
            };
            return;
        }
        // Valid
        context.res = {
            headers: { 'Content-Type': 'application/json' },
            body: { valid: true },
        };
    } catch (error) {
        context.log(error);

        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                feedback: 'unhandled server error please contact the iati technical team',
                error: error.message,
            },
        };
    }
};

export default schemaValidateFile;
