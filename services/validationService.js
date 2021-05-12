const xml2js = require('xml2js');
const _ = require('underscore');
const {
    getFileInformation,
    getVersionCodelistRules,
    getRuleset,
    getSchema,
} = require('../utils/utils');
const { client, getStartTime, getElapsedTime } = require('../config/appInsights');
const { validateIATI } = require('./rulesValidator');
const config = require('../config/config');

exports.validate = async (context, req) => {
    const { body } = req;

    // No body
    if (!body || JSON.stringify(body) === '{}') {
        context.res = {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'No body' },
        };

        return;
    }

    // Body should be a string
    if (typeof body !== 'string') {
        context.res = {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Body must be an application/xml string' },
        };

        return;
    }

    const state = {
        fileSize: '',
        fileType: '',
        version: '',
        generatedDateTime: '',
    };
    const summary = { critical: 0, error: 0, warning: 0 };
    const errors = {};
    let errCache = [];

    const cacheError = (
        codelistDefinition,
        xpath,
        curValue,
        attribute,
        linkedAttribute,
        linkedAttributeValue
    ) => {
        let ruleInfo;
        let errContext;
        if (linkedAttribute) {
            ruleInfo = codelistDefinition[attribute].conditions.mapping[linkedAttributeValue];
        } else {
            ruleInfo = codelistDefinition[attribute];
        }
        const { id, severity, priority, category, message, codelist } = ruleInfo;
        if (attribute === 'text()') {
            errContext = `"${curValue}" is not a valid value for <${xpath.split('/').pop()}>`;
        } else {
            errContext = `"${curValue}" is not a valid value for attribute @${attribute}`;
        }
        if (linkedAttribute) {
            errContext += ` and linked @${linkedAttribute}=${linkedAttributeValue}`;
        }
        const validationError = {
            xpath,
            id,
            codelist,
            severity,
            priority,
            category,
            message,
            errContext,
        };
        // increment summary object
        summary[severity] = (summary[severity] || 0) + 1;
        errCache.push(validationError);
    };

    const validator = (xpath, previousValues, newValue) => {
        const codelistRules = getVersionCodelistRules(state.version);
        // if rule exists for xpath
        if (_.has(codelistRules, xpath)) {
            const codelistDefinition = codelistRules[xpath];

            // edge case for crs-add/channel-code
            // Remove in v3.x of standard
            if (_.has(codelistDefinition, 'text()')) {
                const { allowedCodes } = codelistDefinition['text()'];
                const valid = allowedCodes.has(newValue.toString());
                if (!valid) cacheError(codelistDefinition, xpath, newValue, 'text()');

                // if current element has attributes to check, do the validation
            } else if (_.has(newValue, '$')) {
                // see if the attributes match any rules
                const attrs = Object.keys(newValue.$);
                const ruleAttrs = Object.keys(codelistDefinition);
                const matches = _.intersection(attrs, ruleAttrs);

                // loop on matches to validate
                matches.forEach((attribute) => {
                    // linked code to vocabulary case
                    if (_.has(codelistDefinition[attribute], 'conditions')) {
                        const { linkedAttribute, defaultLink, mapping } =
                            codelistDefinition[attribute].conditions;
                        const curValue = newValue.$[attribute];
                        const linkValue = newValue.$[linkedAttribute] || defaultLink;
                        if (mapping[linkValue]) {
                            const { allowedCodes } = mapping[linkValue];
                            const valid = allowedCodes.has(curValue.toString());
                            if (!valid)
                                cacheError(
                                    codelistDefinition,
                                    xpath,
                                    curValue,
                                    attribute,
                                    linkedAttribute,
                                    linkValue
                                );
                        }
                    } else {
                        const { allowedCodes } = codelistDefinition[attribute];
                        const curValue = newValue.$[attribute].toString();
                        const valid = allowedCodes.has(curValue);
                        if (!valid) cacheError(codelistDefinition, xpath, curValue, attribute);

                        // edge case for country-budget-items/budget-item
                        // Remove in v3.x of standard
                        if (
                            xpath === '/iati-activities/iati-activity/country-budget-items' &&
                            attribute === 'vocabulary' &&
                            curValue === '1'
                        ) {
                            const codelistSubDefinition =
                                codelistRules[
                                    '/iati-activities/iati-activity/country-budget-items/budget-item'
                                ];
                            const allowedBudgetCodes =
                                codelistSubDefinition.code.conditions.mapping['1'].allowedCodes;
                            newValue['budget-item'].forEach((item) => {
                                const value = item.$.code;
                                const validBudget = allowedBudgetCodes.has(value.toString());
                                if (!validBudget)
                                    cacheError(
                                        codelistSubDefinition,
                                        '/iati-activities/iati-activity/country-budget-items/budget-item',
                                        value,
                                        'code',
                                        'vocabulary',
                                        '1'
                                    );
                            });
                        }
                    }
                });
            }
        }

        // save activity-level errors to error object
        if (xpath === '/iati-activities/iati-activity') {
            if (newValue['iati-identifier']) {
                const identifier = newValue['iati-identifier'].join();
                errors[identifier] = errCache;
            } else {
                errors.unidentified = errCache;
            }
            errCache = [];
        }
        // save organisation-level errors to error object
        if (xpath === '/iati-organisations/iati-organisation') {
            if (newValue['organisation-identifier']) {
                const identifier = newValue['organisation-identifier'].join();
                errors[identifier] = errCache;
            } else {
                errors.unidentified = errCache;
            }
            errCache = [];
        }

        // save file level errors to error object
        if (xpath === '/iati-activities' || xpath === '/iati-organisations') {
            errors.file = errCache;
            errCache = [];
        }

        // we're not modifying anything through the validation because we want the full json out
        return newValue;
    };

    // Metric: File Size (Mb)
    state.fileSize = Number(Buffer.byteLength(body) / 1000000).toFixed(4);
    client.trackMetric({ name: 'File Size (Mb)', value: state.fileSize });
    context.log({ name: 'File Size (Mb)', value: state.fileSize });

    try {
        const fileInfoStart = getStartTime();
        let xmlDoc;
        try {
            ({
                fileType: state.fileType,
                version: state.version,
                generatedDateTime: state.generatedDateTime,
                supportedVersion: state.supportedVersion,
                isIati: state.isIati,
                xmlDoc,
            } = getFileInformation(body));
        } catch (error) {
            summary.critical = (summary.critical || 0) + 1;

            const validationReport = {
                valid: false,
                fileType: state.fileType,
                iatiVersion: state.version,
                summary,
                errors: {
                    file: [
                        {
                            id: '0.1.1',
                            severity: 'critical',
                            category: 'iati',
                            message: error.message,
                        },
                    ],
                },
            };
            context.res = {
                status: 422,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }
        state.fileInfoTime = getElapsedTime(fileInfoStart);
        context.log({ name: 'FileInfo Parse Time (s)', value: state.fileInfoTime });

        // Version Check
        if (!state.supportedVersion) {
            const validationReport = {
                valid: true,
                fileType: state.fileType,
                iatiVersion: state.version,
                errors: {
                    file: [
                        {
                            id: '0.6.1',
                            severity: 'error',
                            category: 'documents',
                            message: `${
                                state.version
                            } is not a supported version. Supported versions: ${config.VERSIONS.join(
                                ', '
                            )}`,
                        },
                    ],
                },
            };

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        // Schema Validation
        const schemaStart = getStartTime();

        const xsd = getSchema(state.fileType, state.version);
        // const parsedXML = libxml.parseXml(body);
        if (!xmlDoc.validate(xsd)) {
            const schemaErrors = xmlDoc.validationErrors.map((error) => ({
                id: '0.3.1',
                category: 'schema',
                message: error.message,
                ...error,
            }));
            const validationReport = {
                valid: false,
                fileType: state.fileType,
                iatiVersion: state.version,
                errors: {
                    file: schemaErrors,
                },
            };

            state.schemaTime = getElapsedTime(schemaStart);
            context.log({ name: 'Schema Validate Time (s)', value: state.schemaTime });

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validationReport),
            };
            return;
        }

        state.schemaTime = getElapsedTime(schemaStart);
        context.log({ name: 'Schema Validation Time (s)', value: state.schemaTime });

        // Codelist Validation
        const codelistStart = getStartTime();
        await xml2js.parseStringPromise(body, {
            validator,
            async: true,
        });

        state.codelistTime = getElapsedTime(codelistStart);
        context.log({ name: 'Codelist Validate Time (s)', value: state.codelistTime });

        // Ruleset Validation
        const ruleStart = getStartTime();

        const ruleset = getRuleset(state.version);
        const rulesResult = await validateIATI(ruleset, body);

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

        const validationReport = {
            valid: summary.critical === 0,
            fileType: state.fileType,
            iatiVersion: state.version,
            summary,
            errors: combinedErrors,
        };

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validationReport),
        };
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
