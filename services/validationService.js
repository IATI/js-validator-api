const xml2js = require('xml2js');
const _ = require('underscore');

// Nik Test Husky Upgrade
const codelistRules = require('../codelist_rules.json');
const { client, getStartTime, getElapsedTime } = require('../config/appInsights');

let errCache = [];
let errors = {};

const cacheError = (
    codelistDefinition,
    xpath,
    curValue,
    attribute,
    linkedAttribute,
    linkedAttributeValue
) => {
    const { id, type, priority, valClass, message, codelist } = codelistDefinition[attribute];
    let context;
    if (attribute === 'text()') {
        context = `"${curValue}" is not a valid value for <${xpath.split('/').pop()}>`;
    } else {
        context = `"${curValue}" is not a valid value for attribute @${attribute}`;
    }
    if (linkedAttribute) {
        context += ` and linked @${linkedAttribute}=${linkedAttributeValue}`;
    }
    const validationError = {
        xpath,
        id,
        codelist,
        type,
        priority,
        valClass,
        message,
        context,
    };
    errCache.push(validationError);
};

const validator = (xpath, something, newValue) => {
    // if rule exists for xpath
    if (_.has(codelistRules, xpath)) {
        const codelistDefinition = codelistRules[xpath];

        // edge case for crs-add/channel-code
        if (_.has(codelistDefinition, 'text()')) {
            const { allowedCodes } = codelistDefinition['text()'];
            const valid = allowedCodes.includes(newValue.toString());
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
                    // do stuff

                    const { linkedAttribute, defaultLink, mapping } = codelistDefinition[
                        attribute
                    ].conditions;
                    const curValue = newValue.$[attribute];
                    const linkValue = newValue.$[linkedAttribute] || defaultLink;
                    if (mapping[linkValue]) {
                        const { allowedCodes } = mapping[linkValue];
                        const valid = allowedCodes.includes(curValue.toString());
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
                    const curValue = newValue.$[attribute];
                    const valid = allowedCodes.includes(curValue.toString());
                    if (!valid) cacheError(codelistDefinition, xpath, curValue, attribute);
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

    // we're not modifying anything through the validation
    return newValue;
};

exports.validate = async (context, req) => {
    const { body } = req;
    const state = {
        fileSize: '',
    };
    errors = {};
    errCache = [];

    // Metric: File Size (Mb)
    state.fileSize = Number(Buffer.byteLength(body) / 1000000).toFixed(4);

    client.trackMetric({ name: 'File Size (Mb)', value: state.fileSize });
    context.log({ name: 'File Size (Mb)', value: state.fileSize });

    try {
        const parseStart = getStartTime();
        await xml2js.parseStringPromise(body, {
            attrValueProcessors: [xml2js.processors.parseNumbers],
            validator,
        });

        state.parseTime = getElapsedTime(parseStart);
        context.log({ name: 'Parse Time (s)', value: state.parseTime });

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errors),
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
