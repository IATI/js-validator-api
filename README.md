# IATI JavaScript Validator API

[![Deploy_To_Dev_Function_On_Push](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml/badge.svg)](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml)

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

### `GET /pub/version`

-   Returns

Version

```
X.X.X
```

### `GET /pub?name=Name`

-   Returns

```
Public API.
Version <0.0.0>
Hello, <Name>. This HTTP triggered function executed successfully.
```

### `POST /pub/validate`

-   Query Params

    -   `details=true`
        -   shows all context information for advanced use and debugging
    -   `group=false`
        -   returns errors ungrouped in a "flat" structure, default is to group by Activity/Organisation identifier and Category
    -   `meta=true`
        -   returns an additional `"activities"` key for activities files and `"organisations"` key for organisation files which contains an Array of metadata about the activities or organisations present in the file. In the following structure:

```json
"activities": [
       {
           "identifier": "AA-AAA-123456789-ABC123",
           "valid": false,
           "index": 0
       }
   ],
```

```json
"organisations": [
       {
            "identifier": "NP-SWC-1234",
            "valid": true,
            "index": 0
       }
   ],
```

-   Request Body

    -   application/xml
    -   IATI XML

-   Returns

#### HTTP Response Codes (pub-validate-post)

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

### `POST /pvt/validate-schema`

-   Request Body

    -   application/xml
    -   Single IATI XML activity wrapped in `<iati-activities>` element
    -   Only critically invalid files that have an error id of `0.3.1` in the validation report should be sent to this endpoint. Error ids `0.1.1`, `0.2.1.`, `0.6.1` apply to the whole file so those files can be wholly excluded up front. [Validator rule tracker](https://github.com/IATI/validator-rule-tracker/blob/main/application.csv)

-   Returns

#### `200 OK`

    -   Valid:

```json
{
    "valid": true
}
```

    - Invalid:

```json
{
    "valid": false
}
```

#### `400 Bad Request`

[Validator rule tracker](https://github.com/IATI/validator-rule-tracker/blob/main/application.csv)

-   Not XML - 0.1.1
-   Not IATI XML - 0.2.1
-   Unsupported IATI Version - 0.6.1
-   Not iati-activities file

### `POST /pvt/schema-validate-file`

-   Request Body

    -   application/xml
    -   IATI XML

-   Returns

#### `200 OK`

    -   Valid:

```json
{
    "valid": true
}
```

    - Invalid:

```json
{
    "valid": false
}
```

#### `400 Bad Request`

-   No Body
-   Not a application/xml string body

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

## Deployment

-   Development environment is deployed using GitHub Actions on push

## Release / Version Management

Increment the version on `main` branch using npm:

`npm version major | minor | patch`

Push the new tag and commit to gitHub

```bash
git push origin main
git push ???-tags origin main
```

Create a new Release in GitHub based on the latest tag. Publishing that release deploys the application.

Once deployed successfully PR `main` back into `develop`.

## Customised Dependencies

### xpath

-   Fork [IATI/xpath](https://github.com/iati/xpath)
    -   Sent a performance improvement PR that hasn't been merged into the original project: https://github.com/goto100/xpath/pull/107
    -   If that is ever merged, then we could get rid of this custom dependency.
    -   Also merged this performance PR to our fork: https://github.com/goto100/xpath/pull/108
