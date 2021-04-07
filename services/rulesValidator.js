const { DOMParser } = require('xmldom');
const xpath = require('xpath');
const _ = require('underscore');

// Helper function: Returns the text of the given element or attribute
const getText = (elementOrAttribute) => {
    if (elementOrAttribute.nodeType) return elementOrAttribute.textContent;
    return elementOrAttribute;
};

class Rules {
    constructor(element, cases) {
        this.element = element;
        if ('paths' in cases) {
            this.nestedMatches = cases.paths.map((path) => xpath.select(path, element));
            this.pathMatches = _.flatten(this.nestedMatches);
            this.pathMatchesText = this.pathMatches.map((match) => getText(match));
        }
    }

    atLeastOne() {
        return this.pathMatches.length >= 1;
    }
}

// Tests a specific rule type for a specific case.
const testRule = (contextXpath, element, rule, oneCase) => {
    let result;
    if ('condition' in oneCase && !xpath.select(oneCase.condition, element)) {
        result = '';
    } else {
        const ruleObject = new Rules(element, oneCase);
        result = ruleObject.atLeastOne(); // python getattr(rules_, rule)(case)
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
        xpath.select(contextXpath, document).forEach((element) => {
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
    return results.every((res) => res.result);
};
