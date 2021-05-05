const { DOMParser } = require('xmldom');
const xpath = require('xpath').useNamespaces({ xml: 'http://www.w3.org/XML/1998/namespace' });
const _ = require('underscore');
const compareAsc = require('date-fns/compareAsc');
const differenceInDays = require('date-fns/differenceInDays');
const { getOrgIdPrefixes, getOrgIds } = require('../identifiers/fetchIdenitifiers');

const ruleNameMap = require('../ruleNameMap.json');

const dateReg = /(-?[0-9]{4,})-([0-9]{2})-([0-9]{2})/;
const dateTimeReg = /(-?[0-9]{4,})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})/;

// Helper function: Returns the text of the given element or attribute
const getText = (elementOrAttribute) => {
    if (elementOrAttribute.nodeType) return elementOrAttribute.textContent;
    return elementOrAttribute;
};

const getObjVal = (obj, key, def) => {
    if (_.has(obj, key)) return obj[key];
    return def;
};

const getRuleMethodName = (ruleName) => {
    let name = '';
    name = ruleNameMap
        .map((rule) => {
            if (rule.python === ruleName) return rule.js;
            if (rule.js === ruleName) return ruleName;
            return '';
        })
        .join('');
    if (name === '') throw new Error(`No rule name map between python and js for ${ruleName}`);
    return name;
};

class Rules {
    constructor(element, oneCase, idSets) {
        this.element = element;
        this.idSets = idSets;
        if ('paths' in oneCase) {
            this.nestedMatches = oneCase.paths.map((path) => xpath(path, element));
            this.pathMatches = _.flatten(this.nestedMatches);
            this.pathMatchesText = this.pathMatches.map((match) => getText(match));
        }
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
        switch (oneCase.all) {
            case 'lang':
                return xpath('descendant::narrative', this.element).every((narrative) => {
                    if (xpath('@xml:lang', narrative).length === 0) return false;
                    return true;
                });
            case 'sector':
                return xpath('transaction', this.element).every((transaction) => {
                    if (xpath('sector', transaction).length === 0) return false;
                    return true;
                });
            case 'recipient-country|recipient-region':
                return xpath('transaction', this.element).every((transaction) => {
                    if (xpath('recipient-country|recipient-region', transaction).length === 0)
                        return false;
                    return true;
                });
            case 'currency':
                return currencyPaths.every((cpath) =>
                    xpath(`descendant::${cpath}`, this.element).every((currency) => {
                        if (xpath('@currency', currency).length === 0) return false;
                        return true;
                    })
                );
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
        return (
            this.pathMatchesText.reduce((acc, val) => Number(acc) + Number(val), 0) ===
            Number(oneCase.sum)
        );
    }

    parseDate(dateXpath) {
        if (dateXpath === 'NOW') {
            return new Date();
        }
        const dateElements = xpath(dateXpath, this.element);
        if (dateElements.length < 1) return null;
        const dateText = dateElements[0].value;
        if (dateText !== '') {
            if (dateReg.test(dateText)) return new Date(dateText);
        }
        return null;
    }

    dateOrder(oneCase) {
        const less = this.parseDate(oneCase.less);
        const more = this.parseDate(oneCase.more);
        if (less === null || more === null) return '';
        return compareAsc(less, more) <= 0;
    }

    dateNow(oneCase) {
        const datetimeElement = xpath(oneCase.date, this.element);
        if (datetimeElement.length > 0 && dateTimeReg.test(datetimeElement[0].nodeValue)) {
            const selectedDatetime = new Date(datetimeElement[0].nodeValue);
            const now = new Date();
            return compareAsc(selectedDatetime, now) <= 0;
        }
        return '';
    }

    betweenDates(oneCase) {
        if (xpath(oneCase.date, this.element).length > 0) {
            const start = this.parseDate(oneCase.start);
            const date = this.parseDate(oneCase.date);
            const end = this.parseDate(oneCase.end);
            return compareAsc(start, date) <= 0 && compareAsc(date, end) <= 0;
        }
        return '';
    }

    timeLimit(oneCase) {
        const start = this.parseDate(oneCase.start);
        const end = this.parseDate(oneCase.end);
        if (start === null || end === null) return '';
        return differenceInDays(end, start) <= 365;
    }

    regex(oneCase, allMatches) {
        const regEx = new RegExp(oneCase.regex);
        return this.pathMatchesText.every(
            (pathMatchText) => regEx.test(pathMatchText) === allMatches
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
        if (oneCase.prefix === 'ORG-ID-PREFIX') {
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

    loop(oneCase) {
        const results = [];
        _.forEach(oneCase.do, (subCases, rule) => {
            _.forEach(subCases.cases, (subCase) => {
                const subs = {};
                _.forEach(oneCase.subs, (sub) => {
                    subs[sub] = subCase[sub];
                });
                _.forEach([...new Set(xpath(oneCase.foreach, this.element))], (val) => {
                    const subCaseTest = { ...subCase };
                    _.forEach(subs, (v, k) => {
                        if (typeof v === 'string') {
                            subCaseTest[k] = v.replace(/\$1/g, val.nodeValue);
                        } else {
                            subCaseTest[k] = v.map((vi) => vi.replace(/\$1/g, val.nodeValue));
                        }
                    });
                    if ('condition' in subCaseTest && !xpath(subCaseTest.condition, this.element)) {
                        results.push('No Condition Match');
                    } else {
                        const subRule = new Rules(this.element, subCaseTest);
                        const ruleName = getRuleMethodName(rule);
                        const loopResult = subRule[ruleName](subCaseTest);
                        results.push(loopResult);
                    }
                });
            });
        });
        if (results.length === 0) return [];
        return results.every((val) => val);
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
    const ruleName = getRuleMethodName(rule);
    // if there is a condition, but not match, don't evalute the rule
    if ('condition' in oneCase && !xpath(oneCase.condition, element)) {
        result = 'No Condition Match';
    } else {
        const ruleObject = new Rules(element, oneCase, idSets);
        if (ruleObject.idCondition === false) {
            result = 'No ID Condition Match';
        } else {
            result = ruleObject[ruleName](oneCase);
        }
    }

    return {
        result,
        context: contextXpath,
        lineNumber: element.lineNumber,
        rule: ruleName,
        oneCase,
        // element,
    };
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
exports.testRuleset = (ruleset, xml, idSets) => {
    let document;
    if (typeof xml === 'string') {
        document = new DOMParser().parseFromString(xml);
    } else {
        document = xml;
    }
    const result = [];
    Object.keys(ruleset).forEach((contextXpath) => {
        xpath(contextXpath, document).forEach((element) => {
            Object.keys(ruleset[contextXpath]).forEach((rule) => {
                const theCases = ruleset[contextXpath][rule].cases;
                theCases.forEach((oneCase) => {
                    result.push(testRule(contextXpath, element, rule, oneCase, idSets));
                });
            });
        });
    });
    return result;
};

// Return true if all results are true, return false if any are false
exports.allRulesResult = (ruleset, xml) => {
    const results = this.testRuleset(ruleset, xml);
    if (results.length === 0) {
        return 'No Rule Match';
    }
    if (results.every((res) => res.result === '' || res.result === 'No Condition Match')) {
        return 'No Condition Match';
    }
    // All true = true, any false = false
    return results.every((res) => res.result);
};

exports.validateIATI = async (ruleset, xml) => {
    const document = new DOMParser().parseFromString(xml);
    const isActivity = xpath('//iati-activities', document).length > 0;
    const fileType = isActivity ? 'iati-activity' : 'iati-organisation';
    const identifierElement = isActivity ? 'iati-identifier' : 'organisation-identifier';
    const elements = xpath(`//${fileType}`, document);
    const results = {};
    const orgIdPrefixes = await getOrgIdPrefixes();
    const orgIds = await getOrgIds();
    const idSets = { 'ORG-ID-PREFIX': orgIdPrefixes, 'ORG-ID': orgIds };
    elements.forEach((element) => {
        const singleElementDoc = new DOMParser().parseFromString('<fakeroot></fakeroot>');
        singleElementDoc.firstChild.appendChild(element);
        const identifier = xpath(`string(${identifierElement})`, element) || 'noIdentifier';
        if (isActivity && _.has(results, identifier)) {
            // duplicate identifier, drop a file level error
            results.file = [
                {
                    id: '1.1.2',
                    severity: 'error',
                    category: 'identifiers',
                    message: `The activity identifier must be unique for each activity. Duplicate found for ${identifier}`,
                },
            ];
        } else {
            results[identifier] = [];
        }
        this.testRuleset(ruleset, singleElementDoc, idSets).forEach((result) => {
            if (result.result === false) {
                results[identifier].push(result);
            }
        });
    });
    return results;
};
