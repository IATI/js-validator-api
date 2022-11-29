# IATI JavaScript Validator API

[![Deploy_To_Dev_Function_On_Push](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml/badge.svg)](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml)

## Endpoints

See OpenAPI specification `postman/schemas/index.yaml`. To view locally in Swagger UI, you can use the `42crunch.vscode-openapi` VSCode extension.

## Prerequisities

-   nvm - [nvm](https://github.com/nvm-sh/nvm) - Node version manager
-   Node LTS
    -   once you've installed nvm run `nvm use` which will look at `.nvmrc` for the node version, if it's not installed then it will prompt you to install it with `nvm install <version>`
-   [Azure Functions Core Tools v3](https://github.com/Azure/azure-functions-core-tools)
-   [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) version 2.4 or later.
-   [Docker Engine](https://docs.docker.com/engine/install/#server)
-   [Docker Compose](https://docs.docker.com/compose/install/)

## Getting Started

1. Clone this repository
1. Follow instructions for nvm/node prerequisties above
1. Run `npm i` to install dependencies
1. Run `npm start` to run the Function locally using the Azure Functions Core Tools
1. Run `npm run docker:start` to run the Function inside a Docker container using docker-compose.yml to create a Redis instance.

## Environment Variables

### Set Up

`cp .env.example .env`

### Description

APPLICATIONINSIGHTS_CONNECTION_STRING

-   Needs to be set for running locally, but will not actually report telemetry to the AppInsights instance in my experience

BASIC_GITHUB_TOKEN

-   GitHub PAT token to authenticate to the GitHub API to pull in some external resources from GitHub

REDIS_CACHE_SEC=60
REDIS_PORT=6379
REDIS_KEY=
REDIS_HOSTNAME=

-   Redis connection, leaving the default will connect to a locally installed instance if you have one.

VALIDATOR_SERVICES_URL=https://dev-func-validator-services.azurewebsites.net/api
VALIDATOR_SERVICES_KEY_NAME=x-functions-key
VALIDATOR_SERVICES_KEY_VALUE=

-   URL and API Key for Validator Services, used to get list of Publisher Identifiers

### config defaults

```
   `APP_NAME`: IATI Validator API
   `VERSION`: process.env.npm_package_version
   `NODE_ENV`: process.env.NODE_ENV
   `APPLICATIONINSIGHTS_CONNECTION_STRING`: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
   `NS_PER_SEC`: 1e9
   `VERSIONS`: process.env.VERSIONS || ['2.01', '2.02', '2.03']
   `MAX_FILESIZE`: process.env.MAX_FILESIZE || 60
```

### Adding New

Add in:

1. .env.example
1. .env
1. `/config/config.js`

Import

```
import config from "./config.js";

let myEnvVariable = config.ENV_VAR
```

## Linting and Code Formatting

### Prerequisities

-   To show linting inline install [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) for VSCode

### Info

-   This is done with eslint following the airbnb-base style and using [Prettier](https://prettier.io). Implemented with [this](https://sourcelevel.io/blog/how-to-setup-eslint-and-prettier-on-node) guide.
-   If you use VSCode the formatting will happen automagically on save due to the `.vscode/settings.json` > `"editor.formatOnSave": true` setting

## Creating a new route

`func new --name <routename> --template "HTTP trigger" --authlevel "Function"`

## AppInsights SDK

-   An example of using the `config/appInsights.js` utility is available in the `pvt-get/index.js` where execution time of the function is measured and then logged in 2 ways to the AppInsights Telemetry.

## Unit Tests

-   `npm run rules:test`

There is a large set of Mocha unit tests for the Rulesets logic in `ruleset-unit-tests`.

## Integration Tests

### Running

Locally

-   Install newman globally `npm i -g newman`
-   Start function `npm start`
-   Run Tests `npm int:test`

In Docker container

-   Install newman globally `npm i -g newman`
-   Edit `function.json` files to set `"authLevel": "anonymous"`, don't forget to change back!
-   Start function `npm run docker:start`
-   Run Tests `npm docker:int:test`

### Modifying/Adding

Integration tests are written in Postman v2.1 format and run with newman
Import the `integration-tests/dev-func-validator.postman_collection.json` into Postman and write additional tests there
Then once you are happy, export the collection and overwrite the file, then check into git.

Using files:

-   You must reference the file in the Postman file directory when working in the Postman GUI e.g. `~/Postman/files`
-   When ready to export tests to the repo don't forget to copy file to `integration-tests/test-files`
-   `--working-dir` cli parameter tells `newman` where to look

## Deployment / Release / Version Management

https://github.com/IATI/IATI-Internal-Wiki#development-process

## Customised Dependencies

### xpath

-   Fork [IATI/xpath](https://github.com/iati/xpath)
    -   Sent a performance improvement PR that hasn't been merged into the original project: https://github.com/goto100/xpath/pull/107
    -   If that is ever merged, then we could get rid of this custom dependency.
    -   Also merged this performance PR to our fork: https://github.com/goto100/xpath/pull/108

## IATI Resource Dependencies

### Schemas

Schemas are stored statically in the application source code as they are versioned and rarely change.

`./schemas/2.0X/*`

The source is [IATI-Schemas](https://github.com/IATI/IATI-Schemas)

### Codelists

-   [IATI-Validator-Codelists](https://github.com/IATI/IATI-Validator-Codelists)

This repo provides the "Codelist Rules" for evaluating whether the codelists used by an IATI file being validated are correct. This application dynamically loads the `codelist_rules.json` file from this repo for each `version-2.0X` branch. This is also stored in Redis for caching.

### Rulesets

-   [IATI-Rulesets](https://github.com/IATI/IATI-Rulesets)

This repo provides the "Rulesets" for various conditional and restraint rules for IATI data. This application dynamically loads the `rulsets/standard.json` file from this repo for each `version-2.0X` branch. This is also stored in Redis for caching.

#### Organisation IDs

The rulesets contain rules that require evaluation against a list of Publisher organisation identifiers, and valid organisation identifier prefixes. [link](https://iatistandard.org/en/guidance/publishing-data/registering-and-managing-your-organisation-account/how-to-create-your-iati-organisation-identifier/)

These are sourced from the following locations:

-   Organisation Identifier Prefixes (Registration Agencies) - https://org-id.guide/download.json

    -   `response.lists[].code`
    -   The validator expects the response header from the URL to contain: `Content-Disposition: attachment; filename="<filename>"`

-   Published Organisation Identifiers - https://func-validator-services-dev.azurewebsites.net/api/pvt/publishers
    -   `response[].iati_id`

## Known Issues

### Line numbers for Schema Errors in activities longer than 65535 lines

Due to a [known limitation](https://gitlab.gnome.org/GNOME/libxml2/-/issues/361) in the core library `libxml2` used to perform schema validation, if an activity has a schema error at a line greater than 65535, the value will not be accurate in the context.

If this is the case for your validation report, a message like so will be displayed in the context of the schema error:
`At line greater than: 65537. Note: The validator cannot display accurate line numbers for schema errors located at a line greater than 65537 for this activity.`
