const { validateXMLrecover } = require('../utils/utils');
const { getFileInformation, getSchema } = require('../utils/utils');

// pvt-validate-schema-post
// Expecting a single activity wrapped in <iati-activities> element
// Remove after ALV Phase II go-live
exports.schemaValidate = async (context, req) => {
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
        let xmlDoc = '';
        let isIati = '';
        let supportedVersion = '';

        // Parse file and get metadata for further checks
        try {
            ({ fileType, version, supportedVersion, xmlDoc, isIati } = getFileInformation(body));
        } catch (error) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: 'Not Parsable as XML, this file should not be sent to the schema-validator',
                },
            };
            return;
        }

        // IATI Check
        if (!isIati) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: 'Not Parsable as IATI XML, this file should not be sent to the schema-validator',
                },
            };
            return;
        }

        // Version Check
        if (!supportedVersion) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: 'Not a supported IATI version, this file should not be sent to the schema-validator',
                },
            };
            return;
        }

        // FileType Check
        if (fileType !== 'iati-activities') {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: 'Not an iati-activities file, this file should not be sent to the schema-validator',
                },
            };
            return;
        }

        if (!xmlDoc.validate(getSchema(fileType, version))) {
            context.res = {
                headers: { 'Content-Type': 'application/json' },
                body: { valid: false },
            };
            return;
        }
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

// pvt-schema-validate-file-post
// Schema Check on full file, happens before full validation to enable the safety valve functionality in unified platform
exports.schemaValidateFile = async (context, req) => {
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
        let xmlDoc = '';
        let isIati = '';
        let supportedVersion = '';

        // Parse file and get metadata for further checks
        try {
            ({ fileType, version, supportedVersion, xmlDoc, isIati } = getFileInformation(body));
        } catch (error) {
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    valid: false,
                },
            };
            return;
        }

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

        if (!xmlDoc.validate(getSchema(fileType, version))) {
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
