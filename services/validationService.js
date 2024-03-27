import _ from 'underscore';
import {
    getFileInformation,
    getRuleset,
    getSchema,
    getIdSets,
    getRulesetCommitSha,
    getVersionCodelistCommitSha,
    getOrgIdPrefixFileName,
    validateXMLrecover,
} from '../utils/utils.js';
import { client, getStartTime, getElapsedTime } from '../config/appInsights.js';
import validateCodelists from './codelistValidator.js';
import { validateIATI } from './rulesValidator.js';
import validateAdvisories from './advisoryValidator.js';
import config from '../config/config.js';

const logValidationSummary = (context, state) => {
    const validationSummary = {
        name: 'Validation Summary',
        properties: {
            ...state,
        },
    };
    client.trackEvent(validationSummary);
    context.log(validationSummary);
};

const flattenErrors = (errObject) => {
    const result = [];
    Object.keys(errObject).forEach((identifier) => {
        errObject[identifier].errors.forEach((error) => {
            result.push({ ...error, identifier, title: errObject[identifier].title });
        });
    });
    return result;
};

const countSeverities = (flatErrors) => {
    const summary = { critical: 0, error: 0, warning: 0, advisory: 0 };
    flatErrors.forEach((error) => {
        summary[error.severity] = (summary[error.severity] || 0) + 1;
    });
    return summary;
};

const groupErrors = (errors, groupKey, additionalKeys) => {
    const grouped = _.groupBy(errors, groupKey);
    return Object.keys(grouped).map((key) => {
        const cleanGroups = grouped[key].map((error) => {
            const cleanError = { ...error };
            additionalKeys.forEach((delKey) => {
                delete cleanError[delKey];
            });
            return cleanError;
        });
        return additionalKeys.reduce(
            (acc, addKey) => ({ ...acc, [addKey]: grouped[key][0][addKey] }),
            {
                errors: cleanGroups,
            }
        );
    });
};

const createValidationReport = async (errors, state, groupResults, elementsMeta) => {
    let finalErrors;
    // make summary count
    const summary = countSeverities(errors);

    // group errors by activity then category
    if (groupResults) {
        finalErrors = groupErrors(errors, 'identifier', ['identifier', 'title']).map((actGroup) => {
            const catGrouped = groupErrors(actGroup.errors, 'category', ['category']);
            return { ...actGroup, errors: catGrouped };
        });
    } else {
        finalErrors = errors;
    }

    return {
        valid: summary.critical === 0,
        fileType: state.fileType,
        iatiVersion: state.iatiVersion,
        rulesetCommitSha: getRulesetCommitSha(state.iatiVersion),
        codelistCommitSha: getVersionCodelistCommitSha(state.iatiVersion),
        orgIdPrefixFileName: state.fileType ? getOrgIdPrefixFileName() : '',
        apiVersion: config.VERSION,
        summary,
        ...elementsMeta,
        errors: finalErrors,
    };
};

export default async function validate(context, req) {
    try {
        let { body } = req;
        let adjustLineCountForMissingXmlTag = false;
        const { details, group, meta } = req.query;

        // details - default - false
        const showDetails = details === 'true' || details === 'True';

        // group - default - true
        const groupResults = group !== 'false' && group !== 'False';

        // meta - default - false
        const showElementMeta = meta === 'true' || meta === 'True';

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

        const state = {
            showDetails,
            fileSize: '',
            fileType: '',
            iatiVersion: '',
            generatedDateTime: '',
            supportedVersion: '',
            isIati: '',
            fileInfoTime: '',
            fileSchemaTime: '',
            codelistTime: '',
            ruleTime: '',
            ruleAndSchemaTime: '',
            exitCategory: '',
            schemaErrorsPresent: '',
            advisoriesTime: '',
        };

        // Metric: File Size (MiB)
        state.fileSize = Number(Buffer.byteLength(body) / (1024 * 1024)).toFixed(4);
        client.trackMetric({ name: 'File Size (MiB)', value: state.fileSize });
        context.log({ name: 'File Size (MiB)', value: state.fileSize });

        if (state.fileSize > config.MAX_FILESIZE) {
            context.res = {
                status: 413,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    error: `Max Filesize of ${config.MAX_FILESIZE} MiB exceeded. File supplied is ${state.fileSize} MiB`,
                },
            };

            return;
        }

        const fileInfoStart = getStartTime();

        try {
            // Clean input with xmllint for future steps, only need to replace body with this if no XML errors.
            const { output, error: xmlError } = await validateXMLrecover(body);

            if (xmlError === undefined || xmlError === null || xmlError === '') {
                adjustLineCountForMissingXmlTag = body.startsWith('<?xml');
                body = output;
            }
        } catch (error) {
            context.log(error);

            context.res = {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    feedback: 'An unexpected server error occurred preprocessing the XML file. Please contact IATI Secretariat Support.',
                    error,
                },
            };
        }

        let xmlDoc;
        try {
            ({
                fileType: state.fileType,
                version: state.iatiVersion,
                generatedDateTime: state.generatedDateTime,
                supportedVersion: state.supportedVersion,
                isIati: state.isIati,
                xmlDoc,
            } = getFileInformation(body));
        } catch (error) {
            let errContext;
            const { str1, str2, str3, line, level, int1, domain, column } = error;
            if (line) {
                errContext = `At line: ${error.line}`;
            }

            const errors = [
                {
                    id: '0.1.1',
                    severity: 'critical',
                    category: 'iati',
                    message: error.message,
                    context: [{ text: errContext }],
                    ...(showDetails && {
                        details: { str1, str2, str3, line, level, int1, domain, column },
                    }),
                    identifier: 'file',
                    title: 'File level errors',
                },
            ];

            const validationReport = await createValidationReport(errors, state, groupResults);

            state.exitCategory = 'xmlError';

            logValidationSummary(context, state);

            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        state.fileInfoTime = getElapsedTime(fileInfoStart);
        context.log({ name: 'FileInfo Parse Time (s)', value: state.fileInfoTime });

        // Check the XML file root element is <iati-activities> or <iati-organisation>
        // (it doesn't do anything more than that)
        if (!state.isIati) {
            const errors = [
                {
                    id: '0.2.1',
                    severity: 'critical',
                    category: 'iati',
                    message: 'The file is not an IATI file.',
                    context: [{ text: '' }],
                    identifier: 'file',
                    title: 'File level errors',
                },
            ];

            const validationReport = await createValidationReport(errors, state, groupResults);

            state.exitCategory = 'notIati';

            logValidationSummary(context, state);

            context.res = {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        // Check that the version is latest IATI version
        if (!state.supportedVersion) {
            const errors = [
                {
                    id: '0.6.1',
                    severity: 'critical',
                    category: 'documents',
                    message: `Version ${
                        state.iatiVersion
                    } of the IATI Standard is no longer supported. Supported versions: ${config.VERSIONS.join(
                        ', '
                    )}`,
                    context: [{ text: '' }],
                    identifier: 'file',
                    title: 'File level errors',
                },
            ];

            const validationReport = await createValidationReport(errors, state, groupResults);

            state.exitCategory = 'notSupportedVersion';

            logValidationSummary(context, state);

            context.res = {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        // Check the file validates against the IATI schema
        const fileSchemaStart = getStartTime();
        state.schemaErrorsPresent = !xmlDoc.validate(getSchema(state.fileType, state.iatiVersion));
        xmlDoc = null;
        state.fileSchemaTime = getElapsedTime(fileSchemaStart);

        // Codelist Validation
        const codelistStart = getStartTime();

        const { errors: codelistResult } = await validateCodelists(
            body,
            state.iatiVersion,
            showDetails
        );

        state.codelistTime = getElapsedTime(codelistStart);
        context.log({ name: 'Codelist Validate Time (s)', value: state.codelistTime });

        // Ruleset Validation
        const ruleStart = getStartTime();

        const idSets = await getIdSets();
        const { ruleErrors, schemaErrors, elementsMeta } = await validateIATI(
            getRuleset(state.iatiVersion),
            body,
            state.fileType,
            idSets,
            state.schemaErrorsPresent ? getSchema(state.fileType, state.iatiVersion) : '',
            showDetails,
            showElementMeta
        );

        if (state.schemaErrorsPresent) {
            state.ruleAndSchemaTime = getElapsedTime(ruleStart);
        } else {
            state.ruleTime = getElapsedTime(ruleStart);
        }
        context.log({
            name: `Ruleset ${state.schemaErrorsPresent ? 'and Schema ' : ''}Validate Time (s)`,
            value: state.schemaErrorsPresent ? state.ruleAndSchemaTime : state.ruleTime,
        });

        // Advisory Validation
        const advisoriesStart = getStartTime();
        const advisories = await validateAdvisories(state.iatiVersion, body, adjustLineCountForMissingXmlTag, showDetails);
        state.advisoriesTime = getElapsedTime(advisoriesStart);
        context.log({ name: 'Advisory Validate Time (s)', value: state.advisoriesTime });

        // combine all types of errors
        const combinedErrors = [
            ...schemaErrors,
            ...flattenErrors(codelistResult),
            ...flattenErrors(ruleErrors),
            ...advisories           
        ];

        state.exitCategory = 'fullValidation';

        logValidationSummary(context, state);

        const validationReport = await createValidationReport(
            combinedErrors,
            state,
            groupResults,
            elementsMeta
        );

        context.res = {
            status: schemaErrors.length > 0 ? 422 : 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validationReport),
        };
        body = null;
    } catch (error) {
        context.log(error);

        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                feedback: 'An unexpected server error occurred running validations. Please contact IATI Secretariat Support.',
                error,
            },
        };
    }
}
