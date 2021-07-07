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

exports.validate = async (context, req) => {
    let { body } = req;
    let { showDetails } = req.query;

    showDetails = showDetails === 'true' || showDetails === 'True';

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
    const summary = { critical: 0, error: 0, warning: 0 };

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
            summary.critical = (summary.critical || 0) + 1;

            let errContext;
            const { str1, str2, str3, line, level, int1, domain, column } = error;
            if (line) {
                errContext = `At line: ${error.line}`;
            }

            const validationReport = {
                valid: false,
                fileType: state.fileType,
                iatiVersion: state.iatiVersion,
                summary,
                errors: {
                    file: [
                        {
                            id: '0.1.1',
                            severity: 'critical',
                            category: 'iati',
                            message: error.message,
                            context: errContext,
                            details: { str1, str2, str3, line, level, int1, domain, column },
                        },
                    ],
                },
            };
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
            summary.critical = (summary.critical || 0) + 1;

            const validationReport = {
                valid: false,
                fileType: state.fileType,
                iatiVersion: state.iatiVersion,
                summary,
                errors: {
                    file: [
                        {
                            id: '0.2.1',
                            severity: 'critical',
                            category: 'iati',
                            message: 'The file is not an IATI file.',
                            context: '',
                        },
                    ],
                },
            };

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
            summary.critical = (summary.critical || 0) + 1;

            const validationReport = {
                valid: false,
                fileType: state.fileType,
                iatiVersion: state.iatiVersion,
                summary,
                errors: {
                    file: [
                        {
                            id: '0.6.1',
                            severity: 'critical',
                            category: 'documents',
                            message: `Version ${
                                state.iatiVersion
                            } of the IATI Standard is no longer supported. Supported versions: ${config.VERSIONS.join(
                                ', '
                            )}`,
                            context: '',
                        },
                    ],
                },
            };

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
            schemaErrors = xmlDoc.validationErrors.map((error) => {
                let errContext;
                const { line } = error;
                if (line) {
                    errContext = `At line: ${error.line}`;
                }
                return {
                    id: '0.3.1',
                    category: 'schema',
                    severity: 'critical',
                    message: error.message,
                    context: errContext,
                    details: error,
                };
            });
            summary.critical = (summary.critical || 0) + 1;
        }

        xmlDoc = null;

        state.schemaTime = getElapsedTime(schemaStart);
        context.log({ name: 'Schema Validation Time (s)', value: state.schemaTime });

        // Codelist Validation
        const codelistStart = getStartTime();

        const { errors, summary: newSum } = await validateCodelists(
            body,
            state.iatiVersion,
            showDetails
        );

        // Update main summary counts
        _.forEach(summary, (count, severity) => {
            summary[severity] = count + (newSum[severity] || 0);
        });

        state.codelistTime = getElapsedTime(codelistStart);
        context.log({ name: 'Codelist Validate Time (s)', value: state.codelistTime });

        // Ruleset Validation
        const ruleStart = getStartTime();
        const ruleset = getRuleset(state.iatiVersion);

        const idSets = await getIdSets();
        const rulesResult = await validateIATI(ruleset, body, idSets, showDetails);

        state.ruleTime = getElapsedTime(ruleStart);
        context.log({ name: 'Ruleset Validate Time (s)', value: state.ruleTime });

        const combinedErrors = {};
        const combinedKeys = _.union(Object.keys(errors), Object.keys(rulesResult));
        combinedKeys.forEach((key) => {
            combinedErrors[key] = [];
            if (_.has(errors, key)) {
                combinedErrors[key] = combinedErrors[key].concat(errors[key]);
            }
            if (_.has(rulesResult, key)) {
                combinedErrors[key] = combinedErrors[key].concat(rulesResult[key]);
                rulesResult[key].forEach((ruleError) => {
                    if (_.has(ruleError.ruleCase, 'ruleInfo')) {
                        const { severity } = ruleError.ruleCase.ruleInfo;
                        summary[severity] = (summary[severity] || 0) + 1;
                    }
                });
            }
        });

        // add schema errors into combined errors
        if (schemaErrors.length > 0) {
            if ('file' in combinedErrors) {
                combinedErrors.file = [...combinedErrors.file, ...schemaErrors];
            } else {
                combinedErrors.file = [...schemaErrors];
            }
        }

        state.exitCategory = 'fullValidation';

        logValidationSummary(context, state);

        const validationReport = {
            valid: summary.critical === 0,
            fileType: state.fileType,
            iatiVersion: state.iatiVersion,
            summary,
            errors: combinedErrors,
        };

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
