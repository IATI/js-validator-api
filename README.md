# azure-function-node-microservice-template

## Prerequisities

-   nvm - [nvm](https://github.com/nvm-sh/nvm) - Node version manager
-   Node v12 LTS (lts/erbium)
    -   once you've installed nvm run `nvm use` which will look at `.nvmrc` for the node version, if it's not installed then it will prompt you to install it with `nvm install <version>`
-   [Azure Functions Core Tools v3](https://github.com/Azure/azure-functions-core-tools)
-   [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) version 2.4 or later.

## Getting Started

1. Create a new repository from the template
1. Follow instructions for nvm/node prerequisties above
1. Update package.json with application name, repository, etc.
1. Run `npm i`
1. Run `npm start` to run the function locally using the Azure Functions Core Tools

## Environment Variables

### Set Up

`cp .env.example .env`

### Description

APPINSIGHTS_INSTRUMENTATIONKEY=

-   Needs to be set for running locally, but will not actually report telemetry to the AppInsights instance in my experience

### Adding New

Add in:

1. .env.example
1. .env
1. `/config/config.js`

Import

```
const config = require("./config");

let myEnvVariable = config.ENV_VAR
```

## Linting and Code Formatting

### Prerequisities

-   To show linting inline install [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) for VSCode

### Info

-   This is done with eslint following the airbnb-base style and using [Prettier](https://prettier.io). Implemented with [this](https://sourcelevel.io/blog/how-to-setup-eslint-and-prettier-on-node) guide.
-   If you use VSCode the formatting will happen automagically on save due to the `.vscode/settings.json` > `"editor.formatOnSave": true` setting

## Endpoints /api

### `GET /pvt?name=Name`

-   Returns

```
Private API.
Version <0.0.0>
Hello, <Name>. This HTTP triggered function executed successfully.
```

### `GET /pub?name=Name`

-   Returns

```
Public API.
Version <0.0.0>
Hello, <Name>. This HTTP triggered function executed successfully.
```

## Creating a new route

`func new --name <routename> --template "HTTP trigger" --authlevel "anonymous"`

## AppInsights SDK

-   An example of using the `config/appInsights.js` utility is available in the `pvt-get/index.js` where execution time of the function is measured and then logged in 2 ways to the AppInsights Telemetry.

## Filesystem

-   Provided in `config/fileSystem.js` which can be imported to get the promisified versions of common `fs` functions since we're stuck with Node v12 for now (these are standard in Node v14)

## Integration Tests

### Running

-   Install newman globally `npm i -g newman`
-   Start function `npm start`
-   Run Tests `npm test`

### Modifying/Adding

Integration tests are written in Postman v2.1 format and run with newman
Import the `integrations-tests/azure-function-node-microservice-template.postman_collection.json` into Postman and write additional tests there

## Deployment

-   Update relevant items in `.github/workflows/develop-func-deploy.yml` (see comments inline)
-   Create a [Service Principal](https://github.com/IATI/IATI-Internal-Wiki/blob/main/IATI-Unified-Infra/ServicePrincipals.md) and set the DEV_AZURE_CREDENTIALS GitHub Secret

## Rulesets Unit Tests

`npm run rules:test`

## Tests checklist

-   [x] test empty empty True
-   [x] test title_exists empty True
-   [x] test title_exists empty_activity False
-   [x] test title_exists title True
-   [x] test title_text_exists title False
-   [x] test title_text_exists title_text True
-   [x] test no_paths empty True
-   [x] test no_paths empty_activity False

-   [x] test no_more_than_one_title title True
-   [x] test no_more_than_one_title empty_activity True
-   [x] test no_more_than_one_title title_twice False

-   [x] test results_references results_refs_good True
-   [x] test results_references results_refs_bad False

-   [N/A] test dependent_title_description empty_activity True
-   [N/A] test dependent_title_description title False
-   [N/A] test dependent_title_description description False
-   [N/A] test dependent_title_description title_description True

-   [x] test sum sum_good True
-   [x] test sum sum_bad False

-   [x] test sum_two sum_two_good True
-   [x] test sum_two sum_two_bad False

-   [x] test date_order empty_activity True
-   [x] test date_order date_good True
-   [x] test date_order date_bad False

-   [x] test regex_matches regex_good True
-   [x] test regex_matches regex_bad False
-   [x] test regex_no_matches regex_bad True
-   [x] test regex_no_matches regex_good False

-   [x] test starts_with identifiers True
-   [x] test starts_with identifiers_bad False

-   [x] test unique unique_good True
-   [x] test unique unique_bad False
-   [x] test unique_title_description title_description False # FIXME
-   [x] test unique_title_description title_description_content True

-   [ ] test if_then if_then_good True
-   [ ] test if_then if_then_bad False

### test conditions

-   [x] test condition empty_activity True
-   [x] test condition activity_status_2 True
-   [x] test condition activity_status_3 False

-   [ ] test result_indicator_baseline_selector_with_conditions results_indicator_baseline_value_good True
-   [ ] test result_indicator_baseline_selector_with_conditions results_indicator_baseline_value_bad False
-   [ ] test result_indicator_baseline_selector_with_conditions results_indicator_baseline_value_not_relevant True

-   [ ] test result_indicator_period_target_selector_with_conditions results_indicator_period_target_value_good True
-   [ ] test result_indicator_period_target_selector_with_conditions results_indicator_period_target_value_bad False
-   [ ] test result_indicator_period_target_selector_with_conditions results_indicator_period_target_value_not_relevant True

-   [ ] test result_indicator_period_actual_selector_with_conditions results_indicator_period_actual_value_good True
-   [ ] test result_indicator_period_actual_selector_with_conditions results_indicator_period_actual_value_bad False
-   [ ] test result_indicator_period_actual_selector_with_conditions results_indicator_period_actual_value_not_relevant True

-   [x] test only_one_of only_one_of_activity_bad False
-   [x] test only_one_of only_one_of_activity_good True
-   [x] test only_one_of only_one_of_transaction_bad False
-   [x] test only_one_of only_one_of_transaction_good True

-   [ ] test period_time period_time_good True
-   [ ] test period_time period_time_bad False
-   [x] test time_limit time_limit_good True
-   [x] test time_limit time_limit_bad False

-   [ ] test date_now date_now_good True
-   [ ] test date_now date_now_bad False

-   [x] test at_least_one at_least_one_bad False
-   [x] test at_least_one at_least_one_ref True
-   [x] test at_least_one at_least_one_narrative True
-   [x] test at_least_one at_least_one_no_element_good True

-   [x] test one_or_all one_or_all_lang_bad False
-   [x] test one_or_all one_or_all_lang_good True
-   [x] test one_or_all one_or_all_lang_bad_all False
-   [x] test one_or_all one_or_all_lang_good_all True
-   [x] test one_or_all one_or_all_sector_bad False
-   [x] test one_or_all one_or_all_sector_good True
-   [x] test one_or_all one_or_all_sector_all_good True
-   [x] test one_or_all one_or_all_sector_all_bad False
-   [x] test one_or_all one_or_all_currency_bad False
-   [x] test one_or_all one_or_all_currency_good True
-   [x] test one_or_all one_or_all_currency_all_bad False
-   [x] test one_or_all one_or_all_currency_all_good True
-   [x] test one_or_all_org one_or_all_org_currency_good True
-   [x] test one_or_all_org one_or_all_org_currency_bad False

-   [ ] test between_dates between_dates_good True
-   [ ] test between_dates between_dates_bad False

-   [ ] test recipient_region_budget recipient_region_budget_good True
-   [ ] test recipient_region_budget recipient_region_budget_bad False

-   [ ] test total_expenditure total_expenditure_good True
-   [ ] test total_expenditure total_expenditure_bad False

-   [ ] test range range_good True
-   [ ] test range range_bad False
