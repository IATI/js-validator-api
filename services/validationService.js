const _ = require('underscore');
const { getFileInformation, getRuleset, getSchema, getIdSets } = require('../utils/utils');
const { client, getStartTime, getElapsedTime } = require('../config/appInsights');
const { validateCodelists } = require('./codelistValidator');
const { validateIATI } = require('./rulesValidator');
const config = require('../config/config');

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
    const summary = { critical: 0, error: 0, warning: 0 };
    flatErrors.forEach((error) => {
        summary[error.severity] = (summary[error.severity] || 0) + 1;
    });
    // to match V1 critical is never > 1
    summary.critical = summary.critical >= 1 ? 1 : 0;
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

const createValidationReport = (errors, state, groupResults) => {
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
        summary,
        errors: finalErrors,
    };
};

exports.validate = async (context, req) => {
    let { body } = req;
    const { details, group } = req.query;

    // details - default - false
    const showDetails = details === 'true' || details === 'True';

    // group - default - true
    const groupResults = group !== 'false' && group !== 'False';

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
        schemaTime: '',
        codelistTime: '',
        ruleTime: '',
        exitCategory: '',
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

    try {
        const fileInfoStart = getStartTime();

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

            const validationReport = createValidationReport(errors, state, groupResults);

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

        // IATI Check
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

            const validationReport = createValidationReport(errors, state, groupResults);

            state.exitCategory = 'notIati';

            logValidationSummary(context, state);

            context.res = {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        // Version Check
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

            const validationReport = createValidationReport(errors, state, groupResults);

            state.exitCategory = 'notSupportedVersion';

            logValidationSummary(context, state);

            context.res = {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        // Schema Validation
        const schemaStart = getStartTime();
        let schemaErrors = [];
        if (!xmlDoc.validate(getSchema(state.fileType, state.iatiVersion))) {
            schemaErrors = xmlDoc.validationErrors.reduce((acc, error) => {
                let errContext;
                const { line } = error;
                if (line) {
                    errContext = `At line: ${error.line}`;
                }
                if (!_.has(acc, error.code)) {
                    acc[error.code] = {
                        id: '0.3.1',
                        category: 'schema',
                        severity: 'critical',
                        message: error.message,
                        context: [{ text: errContext }],
                        ...(showDetails && { details: [{ error }] }),
                        identifier: 'file',
                        title: 'File level errors',
                    };
                } else {
                    acc[error.code] = {
                        ...acc[error.code],
                        context: [...acc[error.code].context, { text: errContext }],
                        ...(showDetails && { details: [...acc[error.code].details, { error }] }),
                    };
                }
                return acc;
            }, {});
            schemaErrors = Object.keys(schemaErrors).map((errGroup) => schemaErrors[errGroup]);
        }

        xmlDoc = null;

        state.schemaTime = getElapsedTime(schemaStart);
        context.log({ name: 'Schema Validation Time (s)', value: state.schemaTime });

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
        const ruleset = getRuleset(state.iatiVersion);

        const idSets = await getIdSets();
        const rulesResult = await validateIATI(ruleset, body, idSets, showDetails);

        state.ruleTime = getElapsedTime(ruleStart);
        context.log({ name: 'Ruleset Validate Time (s)', value: state.ruleTime });

        // combine all types of errors
        const combinedErrors = [
            ...schemaErrors,
            ...flattenErrors(codelistResult),
            ...flattenErrors(rulesResult),
        ];

        state.exitCategory = 'fullValidation';

        logValidationSummary(context, state);

        const validationReport = createValidationReport(combinedErrors, state, groupResults);

        context.res = {
            status: schemaErrors.length > 0 ? 422 : 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validationReport),
        };
        body = null;
        return;
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
};
