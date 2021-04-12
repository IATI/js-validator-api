const fs = require('fs/promises');
// eslint-disable-next-line import/no-extraneous-dependencies
const chai = require('chai');

const { expect } = chai;

const { allRulesResult } = require('../../services/rulesValidator');

const testMap = [
    { rule: 'title_exists.json', file: 'empty.xml', expectedResult: 'No Rule Match' },
    { rule: 'title_exists.json', file: 'empty_activity.xml', expectedResult: false },
    { rule: 'title_exists.json', file: 'title.xml', expectedResult: true },
    { rule: 'title_text_exists.json', file: 'title.xml', expectedResult: false },
    { rule: 'title_text_exists.json', file: 'title_text.xml', expectedResult: true },
    { rule: 'no_paths.json', file: 'empty.xml', expectedResult: 'No Rule Match' },
    { rule: 'no_paths.json', file: 'empty_activity.xml', expectedResult: false },
    { rule: 'at_least_one.json', file: 'bad.xml', expectedResult: false },
    { rule: 'at_least_one.json', file: 'ref.xml', expectedResult: true },
    { rule: 'at_least_one.json', file: 'narrative.xml', expectedResult: true },
    { rule: 'at_least_one.json', file: 'no_element_good.xml', expectedResult: 'No Rule Match' },
    { rule: 'condition.json', file: 'empty_activity.xml', expectedResult: 'No Condition Match' },
    { rule: 'condition.json', file: 'activity_status_2.xml', expectedResult: 'No Condition Match' },
    { rule: 'condition.json', file: 'activity_status_3.xml', expectedResult: false },
    {
        rule: 'result_indicator_baseline_selector_with_conditions.json',
        file: 'results_indicator_baseline_value_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'result_indicator_baseline_selector_with_conditions.json',
        file: 'results_indicator_baseline_value_good.xml',
        expectedResult: true,
    },
    {
        rule: 'result_indicator_baseline_selector_with_conditions.json',
        file: 'results_indicator_baseline_value_not_relevant.xml',
        expectedResult: 'No Rule Match',
    },
    {
        rule: 'result_indicator_period_target_selector_with_conditions.json',
        file: 'results_indicator_period_target_value_good.xml',
        expectedResult: true,
    },
    {
        rule: 'result_indicator_period_target_selector_with_conditions.json',
        file: 'results_indicator_period_target_value_bad.xml',
        expectedResult: false,
    },
    {
        rule: 'result_indicator_period_target_selector_with_conditions.json',
        file: 'results_indicator_period_target_value_not_relevant.xml',
        expectedResult: 'No Rule Match',
    },
];

describe('atLeastOne rules', () => {
    testMap.forEach((test) => {
        it(`Rule ${test.rule} for file ${test.file} should return ${test.expectedResult}`, async () => {
            const rule = JSON.parse(await fs.readFile(`${__dirname}/rules/${test.rule}`));
            const xml = (await fs.readFile(`${__dirname}/test-files/${test.file}`)).toString();

            expect(allRulesResult(rule, xml)).to.equal(test.expectedResult);
        });
    });
});
