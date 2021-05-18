# IATI JavaScript Validator API

[![Deploy_To_Dev_Function_On_Push](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml/badge.svg)](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml)

## Prerequisities

-   nvm - [nvm](https://github.com/nvm-sh/nvm) - Node version manager
-   Node LTS
    -   once you've installed nvm run `nvm use` which will look at `.nvmrc` for the node version, if it's not installed then it will prompt you to install it with `nvm install <version>`
-   [Azure Functions Core Tools v3](https://github.com/Azure/azure-functions-core-tools)
-   [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) version 2.4 or later.

## Getting Started

1. Clone this repository
1. Follow instructions for nvm/node prerequisties above
1. Run `npm i` to install dependencies
1. Run `npm start` to run the function locally using the Azure Functions Core Tools

## Environment Variables

### Set Up

`cp .env.example .env`

### Description

APPINSIGHTS_INSTRUMENTATIONKEY=

-   Needs to be set for running locally, but will not actually report telemetry to the AppInsights instance in my experience

### config defaults

-   `APP_NAME`: IATI Validator API
-   `VERSION`: process.env.npm_package_version
-   `NODE_ENV`: process.env.NODE_ENV
-   `APPINSIGHTS_INSTRUMENTATIONKEY`: process.env.APPINSIGHTS_INSTRUMENTATIONKEY
-   `NS_PER_SEC`: 1e9
-   `VERSIONS`: process.env.VERSIONS || ['2.01', '2.02', '2.03']
-   `MAX_FILESIZE`: process.env.MAX_FILESIZE || 60

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

### `POST /pub/validate`

-   Request Body

    -   application/xml
    -   IATI XML

-   Returns

#### HTTP Response Codes

`200 OK`:

-   Full validation has run (fullValidation)

`400 Bad Request` aka can't read it:

-   No Body
-   Body not application/xml string
-   Not parseable XML (xmlError)

`404 Not Found`:

-   This can happen in cases where the Azure Function has crashed and hasn't restarted yet to present the API Route

`413 Payload Too Large`:

-   Body is larger than 60 MiB

`422 Unprocessable Entity` aka can read it but it doesn't make sense:

-   Not recognisable as IATI (notIati)
-   Not a current version of IATI (notSupportedVersion)
-   Schema Errors (schemaErrors)

`500 Internal Server Error`:

-   Unhandled server error, contact the IATI Tech Team

## Creating a new route

`func new --name <routename> --template "HTTP trigger" --authlevel "anonymous"`

## AppInsights SDK

-   An example of using the `config/appInsights.js` utility is available in the `pvt-get/index.js` where execution time of the function is measured and then logged in 2 ways to the AppInsights Telemetry.

## Filesystem

-   Provided in `config/fileSystem.js` which can be imported to get the promisified versions of common `fs` functions since we're stuck with Node v12 for now (these are standard in Node v14)

## Unit Tests

-   `npm run rules:test`

There is a large set of Mocha unit tests for the Rulesets logic in `ruleset-unit-tests`. This may be moved to the IATI-Rulesets repo in the future.

## Integration Tests

### Running

-   Install newman globally `npm i -g newman`
-   Start function `npm start`
-   Run Tests `npm int:test`

### Modifying/Adding

Integration tests are written in Postman v2.1 format and run with newman
Import the `integrations-tests/dev-func-validator.postman_collection.json` into Postman and write additional tests there
Then once you are happy, export the collection and overwrite the file, then check into git.

## Deployment

-   Update relevant items in `.github/workflows/develop-func-deploy.yml` (see comments inline)
-   Create a [Service Principal](https://github.com/IATI/IATI-Internal-Wiki/blob/main/IATI-Unified-Infra/ServicePrincipals.md) and set the DEV_AZURE_CREDENTIALS GitHub Secret
