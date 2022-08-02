const xml2js = require('xml2js');
const _ = require('underscore');
const { getVersionCodelistRules } = require('../utils/utils');

const shortenPath = (path) => {
    if (path.includes('/iati-activities')) {
        return path.replace('/iati-activities', '/');
    }
    if (path.includes('/iati-organisations')) {
        return path.replace('/iati-organisations', '/');
    }
    return path;
};

const getActivityTitle = (node) => {
    if (typeof node === 'object' && 'title' in node) {
        const { title } = node;
        if (typeof title[0] === 'object' && 'narrative' in title[0]) {
            const { narrative } = title[0];
            const [activityTitle] = narrative;
            if (typeof activityTitle === 'string') {
                return activityTitle;
            }
            return activityTitle._;
        }
    }
    return 'No Activity Title Found';
};

const getOrgName = (node) => {
    if (typeof node === 'object' && 'name' in node) {
        const { name } = node;
        if (typeof name[0] === 'object' && 'narrative' in name[0]) {
            const { narrative } = name[0];
            const [orgName] = narrative;
            if (typeof orgName === 'string') {
                return orgName;
            }
            return orgName._;
        }
    }
    return 'No Organisation Name Found';
};

exports.validateCodelists = async (body, version, showDetails) => {
    const errors = {};
    let errCache = [];
    const codelistRules = getVersionCodelistRules(version);

    const cacheError = (
        codelistDefinition,
        xpath,
        curValue,
        attribute,
        linkedAttribute,
        linkedAttributeValue
    ) => {
        let path;
        let ruleInfo;
        let errContext;
        let linkedContext;
        if (linkedAttribute) {
            ruleInfo = codelistDefinition[attribute].conditions.mapping[linkedAttributeValue];
        } else {
            ruleInfo = codelistDefinition[attribute];
        }
        const { id, severity, category, message, codelist } = ruleInfo;
        path = shortenPath(xpath);
        if (attribute === 'text()') {
            path += `/text()`;
            errContext = `"${curValue}" is not a valid value for element <${xpath
                .split('/')
                .pop()}>`;
        } else {
            path += `/@${attribute}`;
            errContext = `"${curValue}" is not a valid value for attribute @${attribute}, in element <${xpath
                .split('/')
                .pop()}>`;
        }
        if (linkedAttribute) {
            linkedContext = `@${linkedAttribute} = ${linkedAttributeValue}`;
            errContext += ` and linked ${linkedContext}`;
        }

        errCache.push({
            id,
            category,
            severity,
            message,
            codelist,
            context: [{ text: errContext }],
            ...(showDetails && {
                details: {
                    xpath: path,
                },
            }),
        });
    };
    const dupCounter = {};

    const validator = (xpath, previousValues, newValue) => {
        // if rule exists for xpath
        if (_.has(codelistRules, xpath)) {
            const codelistDefinition = codelistRules[xpath];

            // edge case for crs-add/channel-code
            // Remove in v3.x of standard
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
                        const { linkedAttribute, defaultLink, mapping } =
                            codelistDefinition[attribute].conditions;
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
                        const curValue = newValue.$[attribute].toString();
                        const valid = allowedCodes.includes(curValue);
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
                                const validBudget = allowedBudgetCodes.includes(value.toString());
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
            let identifier;
            const activityTitle = getActivityTitle(newValue);
            if (newValue['iati-identifier']) {
                identifier = newValue['iati-identifier'].join() || 'noIdentifier';
            } else {
                identifier = 'noIdentifier';
            }
            if (_.has(errors, identifier)) {
                dupCounter[identifier] = (dupCounter[identifier] || 1) + 1;
                identifier = `${identifier}(${dupCounter[identifier]})`;
            }
            if (errCache.length > 0) {
                errors[identifier] = { identifier, title: activityTitle, errors: errCache };
            }
            errCache = [];
        }
        // save organisation-level errors to error object
        if (xpath === '/iati-organisations/iati-organisation') {
            let identifier;
            const orgName = getOrgName(newValue);
            if (newValue['organisation-identifier']) {
                identifier = newValue['organisation-identifier'].join() || 'noIdentifier';
            } else {
                identifier = 'noIdentifier';
            }
            if (errCache.length > 0) {
                errors[identifier] = { identifier, title: orgName, errors: errCache };
            }
            errCache = [];
        }

        // save file level errors to error object
        if (xpath === '/iati-activities' || xpath === '/iati-organisations') {
            if (errCache.length > 0) {
                errors.file = { identifier: 'file', title: 'File level errors', errors: errCache };
            }
            errCache = [];
        }

        // we're not modifying anything through the validation because we want the full json out
        return newValue;
    };

    await xml2js.parseStringPromise(body, {
        validator,
        async: true,
    });

    return { errors };
};
