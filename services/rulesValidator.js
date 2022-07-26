const { DOMParser } = require('@xmldom/xmldom');
const xpath = require('xpath').useNamespaces({ xml: 'http://www.w3.org/XML/1998/namespace' });
const _ = require('underscore');
const compareAsc = require('date-fns/compareAsc');
const differenceInDays = require('date-fns/differenceInDays');
const libxml = require('libxmljs2');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const ruleNameObj = require('./ruleNameMap.json');

const ruleNameMap = new Map(ruleNameObj);

const transactionTypes = {
    1: 'incoming funds',
    2: '(outgoing) commitment',
    3: 'disbursement',
    4: 'expenditure',
    11: 'incoming commitment',
};

// Helper function: Returns the text of the given element or attribute
const getText = (elementOrAttribute) => {
    if (elementOrAttribute.nodeType) return elementOrAttribute.textContent;
    return elementOrAttribute;
};

const getAttributes = (node) => {
    if (_.has(node, 'attributes') && node.attributes.length > 0) {
        return Array.from(node.attributes).map((attr) => ({
            name: attr.name,
            value: attr.value,
        }));
    }
    return [];
};

const getParentNode = (elementOrAttribute) => {
    if ('parentNode' in elementOrAttribute && elementOrAttribute.parentNode !== null)
        return elementOrAttribute.parentNode;
    if ('ownerElement' in elementOrAttribute && elementOrAttribute.ownerElement !== null)
        return elementOrAttribute.ownerElement.parentNode;
    return null;
};

const getObjVal = (obj, key, def) => {
    if (_.has(obj, key)) return obj[key];
    return def;
};

const getRuleMethodName = (ruleName) => {
    const name = ruleNameMap.get(ruleName);
    if (name === undefined)
        throw new Error(`No rule name map between python and js for ${ruleName}`);
    return name;
};

class Rules {
    constructor(element, oneCase, idSets) {
        this.element = element;
        this.idSets = idSets;
        this.failContext = [];
        this.caseContext = {};
        if ('paths' in oneCase) {
            this.nestedMatches = oneCase.paths.map((path) => xpath(path, element));
            this.pathMatches = _.flatten(this.nestedMatches);
            this.pathMatchesText = this.pathMatches.map((match) => getText(match));
            this.caseContext.paths = _.flatten(
                this.nestedMatches.map((pathMatch, i) =>
                    pathMatch.map((path) => {
                        let text;
                        let parentNodeName;
                        if (_.has(path.parentNode, 'nodeName')) {
                            parentNodeName = path.parentNode.nodeName;
                        }
                        const attributes = getAttributes(path);
                        if (path.nodeName === 'reference') {
                            text = `For the ${parentNodeName} "${xpath(
                                'string(../title/narrative)',
                                path
                            )}"`;
                        } else if (parentNodeName === 'transaction') {
                            const transactionType =
                                transactionTypes[xpath('string(../transaction-type/@code)', path)];

                            text = `For the ${transactionType || parentNodeName} of ${xpath(
                                'string(../transaction-date/@iso-date)',
                                path
                            )} with value ${xpath('string(../value/@currency)', path)}${xpath(
                                'string(../value)',
                                path
                            )}`;
                        }
                        return {
                            xpath: oneCase.paths[i],
                            attributes,
                            name: path.nodeName,
                            value: getText(path),
                            lineNumber: path.lineNumber,
                            columnNumber: path.columnNumber,
                            text,
                        };
                    })
                )
            );
        }
        if ('prefix' in oneCase) {
            this.caseContext.prefix = _.flatten(
                oneCase.prefix.map((path) => {
                    if (path !== 'ORG-ID-PREFIX') {
                        return xpath(path, element).map((node) => ({
                            xpath: path,
                            attributes: getAttributes(node),
                            name: node.nodeName,
                            value: getText(node),
                            lineNumber: node.lineNumber,
                            columnNumber: node.columnNumber,
                        }));
                    }
                    return {};
                })
            );
        }
        ['less', 'more', 'start', 'date', 'end'].forEach((timeCase) => {
            if (timeCase in oneCase) {
                this[timeCase] = this.parseDate(oneCase[timeCase]);
                this.caseContext[timeCase] = this[timeCase];
            }
        });
        if ('idCondition' in oneCase) {
            if (oneCase.idCondition === 'NOT_EXISTING_ORG_ID') {
                this.idCondition = this.pathMatchesText.every(
                    (pathText) => !idSets['ORG-ID'].has(pathText)
                );
            }
            if (oneCase.idCondition === 'NOT_EXISTING_ORG_ID_PREFIX') {
                this.idCondition = this.pathMatchesText.every(
                    (pathText) =>
                        !Array.from(idSets['ORG-ID']).some((orgId) =>
                            pathText.startsWith(`${orgId}-`)
                        )
                );
            }
        }
    }

    addFailureContext(node) {
        let text;
        const parentNode = getParentNode(node);
        const parentNodeName = parentNode.nodeName;
        const { nodeName: element, lineNumber, columnNumber } = node;
        const value = getText(node);
        if (['budget', 'planned-disbursement'].includes(parentNodeName)) {
            const startDate = xpath('string(period-start/@iso-date)', parentNode);
            const endDate = xpath('string(period-end/@iso-date)', parentNode);
            text = `In the ${parentNodeName} of ${startDate} to ${endDate}`;
        } else if (['transaction'].includes(parentNodeName)) {
            const transDate = xpath('string(transaction-date/@iso-date)', parentNode);
            text = `In the transaction of ${transDate}`;
        } else if (['transaction'].includes(element)) {
            const transDate = xpath('string(transaction-date/@iso-date)', node);
            text = `In the transaction of ${transDate}`;
        } else if (['budget-line'].includes(parentNodeName)) {
            const grandParent = getParentNode(parentNode);
            const startDate = xpath('string(period-start/@iso-date)', grandParent);
            const endDate = xpath('string(period-end/@iso-date)', grandParent);
            const narrative = xpath('string(narrative)', parentNode);
            text = `In the ${parentNode.nodeName} '${narrative}' of ${grandParent.nodeName} of ${startDate} to ${endDate}`;
        } else {
            text = `For <${element}> '${value}' at line: ${lineNumber}, column: ${columnNumber}`;
        }
        this.failContext.push({
            text,
            parent: parentNodeName,
            element,
            value,
            lineNumber,
            columnNumber,
        });
    }

    noMoreThanOne() {
        return this.pathMatches.length <= 1;
    }

    atLeastOne() {
        return this.pathMatches.length >= 1;
    }

    onlyOneOf(oneCase) {
        return oneCase.excluded.every((excluded) => {
            // no elements from group A can be present
            // if group B exists
            if (xpath(excluded, this.element).length !== 0) {
                return this.pathMatches.length === 0;
            }
            // if no element from group B exists
            // then at least one and no more than one element
            // from group A can exist
            if (this.pathMatches.length === 1) {
                return true;
            }
            return false;
        });
    }

    oneOrAll(oneCase) {
        if (xpath(oneCase.one, this.element).length > 0) {
            return true;
        }
        const currencyPaths = ['value', 'forecast', 'loan-status'];
        let result = true;
        switch (oneCase.all) {
            case 'lang':
                xpath('descendant::narrative', this.element).forEach((narrative) => {
                    if (xpath('@xml:lang', narrative).length === 0) {
                        this.addFailureContext(narrative);
                        result = false;
                    }
                });
                return result;
            case 'sector':
                xpath('transaction', this.element).forEach((transaction) => {
                    if (xpath('sector', transaction).length === 0) {
                        this.addFailureContext(transaction);
                        result = false;
                    }
                });
                return result;
            case 'recipient-country|recipient-region':
                return xpath('transaction', this.element).every((transaction) => {
                    if (xpath('recipient-country|recipient-region', transaction).length === 0) {
                        this.addFailureContext(transaction);
                        return false;
                    }
                    return true;
                });
            case 'currency':
                currencyPaths.forEach((cpath) =>
                    xpath(`descendant::${cpath}`, this.element).forEach((currency) => {
                        if (xpath('@currency', currency).length === 0) {
                            this.addFailureContext(currency);
                            result = false;
                        }
                    })
                );
                return result;
            default:
                return true;
        }
    }

    unique() {
        // Set removes duplicates, so it must be equal or less than len
        return this.pathMatchesText.length <= [...new Set(this.pathMatchesText)].length;
    }

    sum(oneCase) {
        return this.pathMatches.length === 0 || this.strictSum(oneCase);
    }

    strictSum(oneCase) {
        const computedSum = Number(
            this.pathMatchesText.reduce((acc, val) => Number(acc) + Number(val), 0).toFixed(4)
        );
        const limitSum = Number(oneCase.sum);
        if (computedSum !== limitSum) {
            const elements = Array.from(
                new Set(this.pathMatches.map((path) => path.ownerElement.nodeName))
            ).join(', ');
            const vocabularies = Array.from(
                new Set(
                    this.pathMatches.map((path) =>
                        xpath('string(@vocabulary | ../@vocabulary)', path.ownerElement)
                    )
                )
            ).join(', ');
            const text = `The sum is ${computedSum} for ${elements} in vocabulary ${vocabularies}`;
            this.failContext.push({
                text,
            });
        }
        return computedSum === limitSum;
    }

    parseDate(dateXpath) {
        if (dateXpath === 'NOW') {
            return { parsedDate: new Date() };
        }
        const dateElements = xpath(dateXpath, this.element);
        if (dateElements.length < 1) return null;
        const dateText = dateElements[0].value;
        if (dateText !== '') {
            const parsedDate = new Date(dateText);
            if (parsedDate.toString() !== 'Invalid Date')
                return {
                    parsedDate,
                    lineNumber: dateElements[0].lineNumber,
                    columnNumber: dateElements[0].columnNumber,
                };
        }
        return null;
    }

    dateOrder() {
        if (this.less === null || this.more === null) return '';
        return compareAsc(this.less.parsedDate, this.more.parsedDate) <= 0;
    }

    dateNow() {
        if (this.date === null) return '';
        return compareAsc(this.date.parsedDate, new Date()) <= 0;
    }

    betweenDates(oneCase) {
        if (this.date !== null) {
            if ('date' in oneCase) {
                this.addFailureContext(xpath(oneCase.date, this.element)[0]);
            }
            return (
                compareAsc(this.start.parsedDate, this.date.parsedDate) <= 0 &&
                compareAsc(this.date.parsedDate, this.end.parsedDate) <= 0
            );
        }
        return '';
    }

    timeLimit() {
        if (this.start === null || this.end === null) return '';
        return differenceInDays(this.end.parsedDate, this.start.parsedDate) <= 365;
    }

    // note if pathMatch === '' we consider it passed for regex, follows V1.
    regex(oneCase, allMatches) {
        const regEx = new RegExp(oneCase.regex);
        return this.pathMatchesText.every(
            (pathMatchText) => pathMatchText === '' || regEx.test(pathMatchText) === allMatches
        );
    }

    regexMatches(oneCase) {
        return this.regex(oneCase, true);
    }

    regexNoMatches(oneCase) {
        return this.regex(oneCase, false);
    }

    startsWith(oneCase) {
        // ORG ID Prefix case
        if (
            oneCase.prefix === 'ORG-ID-PREFIX' ||
            (oneCase.prefix.length === 1 && oneCase.prefix[0] === 'ORG-ID-PREFIX')
        ) {
            return this.pathMatchesText.every((pathMatchText) => {
                // Get prefix as everything left of the 2nd "-"
                const split = pathMatchText.split('-');
                const prefix = `${split[0]}-${split[1]}`;
                return this.idSets['ORG-ID-PREFIX'].has(prefix);
            });
        }
        // get text matches for start into Array
        const startMatchesText = _.flatten(
            oneCase.prefix.map((path) => xpath(path, this.element))
        ).map((match) => getText(match));

        // every path match (e.g. iati-identifier), must start with at least one (some) start match (e.g. reporting-org/@ref)
        return this.pathMatchesText.every((pathMatchText) =>
            startMatchesText.some((startText) => {
                const separator = _.has(oneCase, 'separator') ? oneCase.separator : '';
                const textWithSep = startText + separator;
                return pathMatchText.startsWith(textWithSep);
            })
        );
    }

    ifThen(oneCase) {
        if (xpath(oneCase.if, this.element)) {
            return xpath(oneCase.then, this.element);
        }
        return true;
    }

    range(oneCase) {
        // if min/max are missing, we use val as the sentinel
        // so we can check also that val is at_least_value or no_more_than_value
        return this.pathMatchesText.every((value) => {
            const min = Number(getObjVal(oneCase, 'min', value));
            const max = Number(getObjVal(oneCase, 'max', value));
            return min <= Number(value) && Number(value) <= max;
        });
    }

    noSpaces() {
        return this.pathMatchesText.every(
            (pathMatchText) => pathMatchText === pathMatchText.trim()
        );
    }
}

// Tests a specific rule type for a specific case.
const testRule = (contextXpath, element, rule, oneCase, idSets) => {
    let result;
    let caseContext;
    let failContext;
    let ruleName;
    // if there is a condition, but not match, don't evalute the rule
    if ('condition' in oneCase && !xpath(oneCase.condition, element)) {
        result = 'No Condition Match';
    } else {
        let ruleObject = new Rules(element, oneCase, idSets);
        if (ruleObject.idCondition === false) {
            result = 'No ID Condition Match';
        } else {
            if (rule in ruleObject) {
                result = ruleObject[rule](oneCase);
            } else {
                ruleName = getRuleMethodName(rule);
                result = ruleObject[ruleName](oneCase);
            }
            ({ caseContext, failContext } = ruleObject);
        }
        ruleObject = null;
    }

    return {
        result,
        xpathContext: {
            xpath: contextXpath,
            lineNumber: element.lineNumber,
            columnNumber: element.columnNumber,
        },
        ruleName: ruleName || rule,
        ruleCase: oneCase,
        caseContext,
        failContext,
    };
};

const testRuleLoop = (contextXpath, element, oneCase, idSets) => {
    const results = [];
    _.forEach(oneCase.do, (subCases, subRule) => {
        _.forEach(subCases.cases, (subCase) => {
            const subs = {};
            _.forEach(oneCase.subs, (sub) => {
                subs[sub] = subCase[sub];
            });
            const groups = [
                ...new Set(xpath(oneCase.foreach, element).map((res) => res.nodeValue)),
            ];
            _.forEach(groups, (val) => {
                const subCaseTest = { ...subCase };
                _.forEach(subs, (v, k) => {
                    if (typeof v === 'string') {
                        subCaseTest[k] = v.replace(/\$1/g, val);
                    } else {
                        subCaseTest[k] = v.map((vi) => vi.replace(/\$1/g, val));
                    }
                });
                results.push(testRule(contextXpath, element, subRule, subCaseTest, idSets));
            });
        });
    });
    return results;
};

/*
 Test a full ruleset against a document
 ruleset - JSON Object of rules
 xml - string representation of the xml to check rules against

 returns
 Object per ___
    {
        result,
        element,
        context: contextXpath,
        rule,
        oneCase,
    }
*/
const testRuleset = (ruleset, xml, idSets) => {
    let document;
    if (typeof xml === 'string') {
        document = new DOMParser().parseFromString(xml);
    } else {
        document = xml;
    }
    let result = [];
    Object.keys(ruleset).forEach((contextXpath) => {
        xpath(contextXpath, document).forEach((element) => {
            Object.keys(ruleset[contextXpath]).forEach((rule) => {
                const theCases = ruleset[contextXpath][rule].cases;
                theCases.forEach((oneCase) => {
                    if (rule === 'loop') {
                        result = result.concat(
                            testRuleLoop(contextXpath, element, oneCase, idSets)
                        );
                    } else {
                        result.push(testRule(contextXpath, element, rule, oneCase, idSets));
                    }
                });
            });
        });
    });
    return result;
};

// Return true if all results are true, return false if any are false
const allRulesResult = (ruleset, xml) => {
    const results = testRuleset(ruleset, xml);
    if (results.length === 0) {
        return 'No Rule Match';
    }
    if (results.every((res) => res.result === '' || res.result === 'No Condition Match')) {
        return 'No Condition Match';
    }
    // All true = true, any false = false
    return results.every((res) => res.result);
};

const createPathsContext = (caseContext, xpathContext, concatenate) => {
    if ('paths' in caseContext && caseContext.paths.length > 0) {
        if (concatenate) {
            const text = caseContext.paths.reduce(
                (acc, path, i) =>
                    `${acc}${i === 0 ? 'For ' : ' and '}${xpathContext.xpath}/${path.xpath} = '${
                        path.value
                    }' at line: ${path.lineNumber}, column: ${path.columnNumber}`,
                ''
            );
            return [{ text }];
        }
        return caseContext.paths.map((path) => ({
            text: `For ${xpathContext.xpath}/${path.xpath} = '${path.value}' at line: ${path.lineNumber}, column: ${path.columnNumber}`,
        }));
    }
    return [];
};

const standardiseResultFormat = (result, showDetails) => {
    let context = [];
    let id;
    let severity;
    let category;
    let message;
    const { xpathContext, ruleName, ruleCase, caseContext, failContext } = result;
    if ('ruleInfo' in ruleCase) {
        ({ id, severity, category, message } = ruleCase.ruleInfo);
    }
    switch (ruleName) {
        case 'atLeastOne':
            context.push({
                text: `For <${xpathContext.xpath.split('/').pop()}> at line: ${
                    xpathContext.lineNumber
                }, column: ${xpathContext.columnNumber}`,
            });
            break;
        case 'dateNow':
            if (caseContext && 'date' in caseContext) {
                context.push({
                    text: `For date ${caseContext.date.parsedDate.toISOString()} at line: ${
                        caseContext.date.lineNumber
                    }, column: ${caseContext.date.columnNumber}`,
                });
            }
            break;
        case 'dateOrder':
            if (caseContext && 'less' in caseContext && 'more' in caseContext) {
                let text = `${
                    ruleCase.less
                } = '${caseContext.less.parsedDate.toISOString()}' at line: ${
                    caseContext.less.lineNumber
                }, column: ${caseContext.less.columnNumber} is later than ${
                    ruleCase.more
                } = '${caseContext.more.parsedDate.toISOString()}'`;
                if ('lineNumber' in caseContext.more && 'columnNumber' in caseContext.more) {
                    text += ` at line: ${caseContext.more.lineNumber}, column: ${caseContext.more.columnNumber}`;
                }
                context.push({
                    text,
                });
            }
            break;
        case 'timeLimit':
            if (caseContext && 'start' in caseContext && 'end' in caseContext) {
                let text = `${
                    ruleCase.end
                } = '${caseContext.end.parsedDate.toISOString()}' at line: ${
                    caseContext.end.lineNumber
                }, column: ${caseContext.end.columnNumber} is more than a year later than ${
                    ruleCase.start
                } = '${caseContext.start.parsedDate.toISOString()}'`;
                if ('lineNumber' in caseContext.start && 'columnNumber' in caseContext.start) {
                    text += ` at line: ${caseContext.start.lineNumber}, column: ${caseContext.start.columnNumber}`;
                }
                context.push({
                    text,
                });
            }
            break;
        case 'oneOrAll':
            if (failContext.length > 0) {
                context = failContext.map((val) => ({ text: val.text }));
            }
            break;
        case 'regexMatches':
            context = createPathsContext(caseContext, xpathContext, false);
            break;
        case 'noSpaces':
            context = createPathsContext(caseContext, xpathContext, false);
            break;
        case 'unique':
            context = createPathsContext(caseContext, xpathContext, true);
            break;
        case 'range':
            context = createPathsContext(caseContext, xpathContext, false);
            break;
        case 'ifThen':
            context = createPathsContext(caseContext, xpathContext, true);
            break;
        case 'noMoreThanOne':
            context = createPathsContext(caseContext, xpathContext, true);
            break;
        case 'startsWith':
            if (
                ruleCase.prefix === 'ORG-ID-PREFIX' ||
                (ruleCase.prefix.length === 1 && ruleCase.prefix[0] === 'ORG-ID-PREFIX')
            ) {
                context = createPathsContext(caseContext, xpathContext, true);
            } else {
                context = _.flatten(
                    caseContext.prefix.map((prefixPath) =>
                        caseContext.paths.map((casePath) => ({
                            text: `For prefix: ${xpathContext.xpath}/${prefixPath.xpath} = '${prefixPath.value}' at line: ${prefixPath.lineNumber}, column: ${prefixPath.columnNumber} and ${xpathContext.xpath}/${casePath.xpath} = '${casePath.value}' at line: ${casePath.lineNumber}, column: ${casePath.columnNumber}`,
                        }))
                    )
                );
            }
            break;
        case 'strictSum':
            if (failContext.length > 0) {
                context = failContext.map((val) => ({ text: val.text }));
            }
            break;
        case 'betweenDates':
            if (failContext.length > 0) {
                context = failContext.map((val) => ({ text: val.text }));
            }
            break;
        default:
            break;
    }

    return {
        id,
        severity,
        category,
        message,
        context,
        ...(showDetails && {
            details: {
                ruleName,
                ruleCase,
                xpathContext,
                caseContext,
                failContext,
            },
        }),
    };
};

const validateSchema = (xmlString, schema, identifier, title, showDetails, lineOffset = 0) => {
    const xmlDoc = libxml.parseXml(xmlString);

    if (!xmlDoc.validate(schema)) {
        const curSchemaErrors = xmlDoc.validationErrors.reduce((acc, error) => {
            let errContext;
            const errorDetail = error;
            if ('line' in errorDetail) {
                errorDetail.line += lineOffset;
                errContext = `At line: ${errorDetail.line}`;
            }
            if (!_.has(acc, error.message)) {
                acc[error.message] = {
                    id: '0.3.1',
                    category: 'schema',
                    severity: 'critical',
                    message: error.message,
                    context: [{ text: errContext }],
                    ...(showDetails && { details: [{ error: errorDetail }] }),
                    identifier,
                    title,
                };
            } else {
                acc[error.message] = {
                    ...acc[error.message],
                    context: [...acc[error.message].context, { text: errContext }],
                    ...(showDetails && {
                        details: [...acc[error.message].details, { error: errorDetail }],
                    }),
                };
            }
            return acc;
        }, {});
        return Object.keys(curSchemaErrors).map((errGroup) => curSchemaErrors[errGroup]);
    }
    return [];
};

const fileDefinition = {
    'iati-activities': {
        subRoot: 'iati-activity',
        identifier: 'iati-identifier',
        titleLocation: 'title/narrative',
    },
    'iati-organisations': {
        subRoot: 'iati-organisation',
        identifier: 'organisation-identifier',
        titleLocation: 'name/narrative',
    },
};

const splitXMLTransform = (root, elementName) => {
    let rootOpen = '';
    const rootClose = `</${root}>`;
    const open = `<${elementName}`;
    const close = `</${elementName}>`;
    let doc = '';
    return new Transform({
        transform(chunk, enc, next) {
            doc += chunk.toString();
            if (rootOpen === '') {
                const rootOpenIndex = doc.indexOf(`<${root}`);
                const rootCloseIndex = doc.indexOf(`>`, rootOpenIndex);
                if (rootOpenIndex === -1 || rootCloseIndex === -1) {
                    next();
                    return;
                }
                rootOpen = doc.slice(rootOpenIndex, rootCloseIndex + 1);
                doc = doc.slice(rootCloseIndex + 1);
            }

            let openIndex = doc.indexOf(open);
            let closeIndex = doc.indexOf(close);
            while (openIndex !== -1 && closeIndex !== -1) {
                // trim before <elementName
                doc = doc.slice(openIndex);

                // adjust indexes
                closeIndex -= openIndex;
                openIndex = 0;

                // push single activity, wrapped in root
                this.push(`${rootOpen}${doc.slice(0, closeIndex + close.length)}${rootClose}`);

                // remove activity that's been pushed
                doc = doc.slice(closeIndex + close.length);

                // adjust indexes
                openIndex = doc.indexOf(open);
                closeIndex = doc.indexOf(close);
            }
            next();
        },
    });
};

// get line number of starting <iati-activity or <iati-organisation element
const getLineStart = (xml, subElement) => {
    const chunk = Buffer.from(xml.slice(0, xml.indexOf(`<${subElement}`)));
    let idx = -1;
    let lineCount = -1; // Because the loop will run once for idx=-1
    do {
        idx = chunk.indexOf(10, idx + 1);
        lineCount += 1;
    } while (idx !== -1);
    return lineCount;
};

const validateIATI = async (
    ruleset,
    xml,
    fileType,
    idSets,
    schema,
    showDetails = false,
    showElementMeta = false
) => {
    let schemaErrors = [];
    const ruleErrors = {};
    let index = 0;
    let lineCount = getLineStart(xml, fileDefinition[fileType].subRoot);
    console.log(`Start lineCount: ${lineCount}`);
    const idTracker = new Map();

    const elementsMeta = showElementMeta ? { [fileType]: [] } : {};

    const processActivity = () =>
        new Transform({
            transform(chunk, enc, next) {
                const offsetBuff = Buffer.concat([Buffer.alloc(lineCount, 10), chunk]);
                let newSchemaErrors = [];
                const docString = chunk.toString();
                const docStringOffset = offsetBuff.toString();

                // build single activity or org document
                const singleElementDoc = new DOMParser().parseFromString(
                    docStringOffset,
                    'text/xml'
                );

                // parse identifier and title
                let identifier =
                    xpath(
                        `string(/${fileType}/${fileDefinition[fileType].subRoot}/${fileDefinition[fileType].identifier})`,
                        singleElementDoc
                    ) || 'noIdentifier';
                const title =
                    xpath(
                        `string(/${fileType}/${fileDefinition[fileType].subRoot}/${fileDefinition[fileType].titleLocation})`,
                        singleElementDoc
                    ) || '';

                // track and duplicate check identifier
                idTracker.set(identifier, (idTracker.get(identifier) || 0) + 1);
                if (idTracker.get(identifier) > 1) {
                    // duplicate identifier, drop a file level error
                    ruleErrors.file = {
                        identifier: 'file',
                        title: 'File level errors',
                        errors: [
                            {
                                id: '1.1.2',
                                severity: 'error',
                                category: 'identifiers',
                                message: `The activity identifier must be unique for each activity.`,
                                context: [
                                    {
                                        text: `Duplicate found for ${fileDefinition[fileType].identifier} = '${identifier}'`,
                                    },
                                ],
                            },
                        ],
                    };
                    identifier = `${identifier}(${idTracker.get(identifier)})`;
                    idTracker.set(identifier, idTracker.get(identifier) + 1);
                }

                // validate against iati schema
                if (schema) {
                    newSchemaErrors = validateSchema(
                        docString,
                        schema,
                        identifier,
                        title,
                        showDetails,
                        lineCount
                    );
                    schemaErrors = [...schemaErrors, ...newSchemaErrors];
                }

                // add element metadata
                if (showElementMeta) {
                    elementsMeta[fileType].push({
                        identifier,
                        valid: newSchemaErrors.length === 0,
                        index,
                    });
                }

                // validate against ruleset
                // TODO: needs to take offset for lineNumber, to get lineNumber correct in errors...
                const errors = testRuleset(ruleset, singleElementDoc, idSets).reduce(
                    (acc, result) => {
                        if (result.result === false) {
                            acc.push(standardiseResultFormat(result, showDetails));
                        }
                        return acc;
                    },
                    []
                );

                if (errors.length > 0) {
                    ruleErrors[identifier] = { identifier, title, errors };
                }
                // increment index and line count
                index += 1;
                let idx = -1;
                do {
                    idx = chunk.indexOf(10, idx + 1);
                    lineCount += 1;
                } while (idx !== -1);

                next();
            },
        });

    await pipeline(
        Readable.from(xml),
        splitXMLTransform(fileType, fileDefinition[fileType].subRoot),
        processActivity()
    );

    // if no iati child elements found, evaluate schema errors at file level
    if (schema && index === 0) {
        schemaErrors = [
            ...schemaErrors,
            ...validateSchema(xml, schema, 'file', 'File level errors', showDetails),
        ];
    }

    return { ruleErrors, schemaErrors, elementsMeta };
};

module.exports = { validateIATI, testRuleset, allRulesResult };
