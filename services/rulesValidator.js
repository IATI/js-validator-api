const { DOMParser } = require('xmldom');
const xpath = require('xpath').useNamespaces({ xml: 'http://www.w3.org/XML/1998/namespace' });
const _ = require('underscore');
const compareAsc = require('date-fns/compareAsc');
const differenceInDays = require('date-fns/differenceInDays');

const dateReg = /(-?[0-9]{4,})-([0-9]{2})-([0-9]{2})/;
// const dateTimeReg = /(-?[0-9]{4,})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})/;

// Helper function: Returns the text of the given element or attribute
const getText = (elementOrAttribute) => {
    if (elementOrAttribute.nodeType) return elementOrAttribute.textContent;
    return elementOrAttribute;
};

class Rules {
    constructor(element, cases) {
        this.element = element;
        if ('paths' in cases) {
            this.nestedMatches = cases.paths.map((path) => xpath(path, element));
            this.pathMatches = _.flatten(this.nestedMatches);
            this.pathMatchesText = this.pathMatches.map((match) => getText(match));
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
                return xpath('transaction', this.element).every((narrative) => {
                    if (xpath('sector', narrative).length === 0) return false;
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
            this.pathMatches
                .map((match) => getText(match))
                .reduce((acc, val) => Number(acc) + Number(val), 0) === Number(oneCase.sum)
        );
    }

    parseDate(dateXpath) {
        if (dateXpath === 'TODAY') {
            return new Date().now();
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

    timeLimit(oneCase) {
        const start = this.parseDate(oneCase.start);
        const end = this.parseDate(oneCase.end);
        if (start === null || end === null) return '';
        return differenceInDays(end, start) <= 365;
    }
}

// Tests a specific rule type for a specific case.
const testRule = (contextXpath, element, rule, oneCase) => {
    let result;
    if ('condition' in oneCase && !xpath(oneCase.condition, element)) {
        result = '';
    } else {
        const ruleObject = new Rules(element, oneCase);
        result = ruleObject[rule](oneCase);
    }

    return {
        result,
        element,
        context: contextXpath,
        rule,
        oneCase,
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
exports.testRuleset = (ruleset, xml) => {
    const document = new DOMParser().parseFromString(xml);
    const result = [];
    Object.keys(ruleset).forEach((contextXpath) => {
        xpath(contextXpath, document).forEach((element) => {
            Object.keys(ruleset[contextXpath]).forEach((rule) => {
                const theCases = ruleset[contextXpath][rule].cases;
                theCases.forEach((oneCase) => {
                    result.push(testRule(contextXpath, element, rule, oneCase));
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
    if (results.every((res) => res.result === '')) {
        return 'No Condition Match';
    }
    // All true = true, any false = false
    return results.every((res) => res.result);
};
