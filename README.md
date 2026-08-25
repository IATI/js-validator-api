# Summary

| Product          | Validator API Endpoints                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Description      | Node.JS app that provides API end points to validate IATI XML files, is used by https://validator.iatistandard.org/                |
| Website          | [https://developer.iatistandard.org/](https://developer.iatistandard.org/)                                                         |
| Related          | [IATI/validator-services](https://github.com/IATI/validator-services), [IATI/validator-web](https://github.com/IATI/validator-web) |
| Documentation    | [https://developer.iatistandard.org/](https://developer.iatistandard.org/)                                                         |
| Technical Issues | https://github.com/IATI/js-validator-api/issues                                                                                    |
| Support          | https://iatistandard.org/en/guidance/get-support/                                                                                  |

# IATI JavaScript Validator API

[![Deploy_To_Dev_Function_On_Push](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml/badge.svg)](https://github.com/IATI/js-validator-api/actions/workflows/develop-func-deploy.yml)

## Endpoints

See OpenAPI specification `postman/schemas/index.yaml`. To view locally in Swagger UI, you can use the `42crunch.vscode-openapi` VSCode extension.

## Prerequisities

-   nvm - [nvm](https://github.com/nvm-sh/nvm) - Node version manager
-   Node LTS
    -   once you've installed nvm run `nvm use` which will look at `.nvmrc` for the node version, if it's not installed then it will prompt you to install it with `nvm install <version>`
-   [Azure Functions Core Tools v4](https://github.com/Azure/azure-functions-core-tools)
-   [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) version 2.4 or later.
-   [Docker Engine](https://docs.docker.com/engine/install/#server)
-   [Docker Compose](https://docs.docker.com/compose/install/)
-   `xmllint`
    -   There are two ways to run this locally: directly, or using the `docker compose` setup. The docker build includes the `xmllint` tool. If you run it directly, you may need to install this tool.
        -   On Ubuntu it is in `libxml2-utils`, so you'll need something like `sudo apt install libxml2-utils`.

## Getting Started

1. Clone this repository
1. Follow instructions for nvm/node prerequisties above
1. Setup the environment variables using the `.env` file (instructions below)
    - If running directly (option 1), this will mean setting up a `redis` database.

### Option 1: running directly

4. Run `npm i` to install dependencies
1. Run `npm start` to run the Function locally using the Azure Functions Core Tools
1. The API end points will be available on `localhost:7071`

### Option 2: using docker

4. Run `npm run docker:start` to run the Function inside a Docker container using docker-compose.yml to create a Redis instance.
1. The API end points will be available on `localhost:8080`

### Test setup

To test the basic setup, you can run the following command:

`curl http://localhost:8080/api/pub/version`

This should return a version number (change port if running directly instead of via docker).

To test the validation is working, obtain an IATI XML file, and run the following command (this is if running via the docker setup; change port to `7071` if running directly):

`curl -X POST --data-binary @PATH_TO_IATI_XML http://localhost:8080/api/pub/validate`

You should see something like (if the file is a valid IATI file):

    {
      "valid": true,
      "fileType": "iati-activities",
      "iatiVersion": "2.03",
      "rulesetCommitSha": "2cd1a14f6c584000ae6d76e708c73ddcc12b6c40",
      "codelistCommitSha": "cf571799b909eb894c071dc364cd2a4dfbcd5d7c",
      "orgIdPrefixFileName": "org-id-fa56731af7.json",
      "apiVersion": "2.3.2",
      "summary": {
        "critical": 0,
        "error": 0,
        "warning": 0
      },
      "errors": []
    }

If it has warnings or errors, you'll see them listed.

## Environment Variables

### Set Up

`cp .env.example .env`

### Description

APPLICATIONINSIGHTS_CONNECTION_STRING

-   **Required — the app will not start without it.** `config/appInsights.js` calls
    `appInsights.setup(...).start()` at module load. If the value is empty or malformed the SDK throws
    `Instrumentation key not found`, the Functions worker fails to load every function that imports it,
    and requests get `503 Function host is not running` (or an empty 500) naming no cause.
    For local development any syntactically valid connection string works; no telemetry is sent. The
    value shipped in `.env.example` is a usable dummy:

GITHUB_OAUTH_APP_CLIENT_ID
GITHUB_OAUTH_APP_CLIENT_SECRET

-   GitHub OAuth app. No special permissions or access needed. Optional, but you may get rate limited very easily if you don't.

REDIS_PORT=6379  
REDIS_HOSTNAME=redis

-   Redis connection, configured for `docker compose use`. If you develop outside
    docker, change these settings as appropriate.

VALIDATOR_SERVICES_URL=https://func-validator-services-dev.azurewebsites.net/api  
VALIDATOR_SERVICES_KEY_NAME=x-functions-key  
VALIDATOR_SERVICES_KEY_VALUE=

-   URL and API Key for Validator Services, used to get list of Publisher Identifiers

DATASTORE_SERVICES_URL=https://func-datastore-services-dev.azurewebsites.net/api
DATASTORE_SERVICES_AUTH_HTTP_HEADER_NAME=x-functions-key
DATASTORE_SERVICES_AUTH_HTTP_HEADER_VALUE=
DATASTORE_SERVICES_IATI_IDENTIFIERS_EXIST_MAX_NUMBER_OF_IDS=5000

-   URL and API Key for datastore services, used by the advisory system to check for the
    existence of IATI Identifiers in the Datastore

-   VALIDATOR_SERVICES_KEY_VALUE and DATASTORE_SERVICES_AUTH_HTTP_HEADER_VALUE are outbound
    credentials for Azure Functions. If you are an authorised developer on this
    codebase you can get them from the Azure portal for the respective Function Apps.
    If you do not have Azure access, ask the team.

### App config defaults (set in `config/config.js`)

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

-   `npm run unit:test`

There is a large set of Mocha unit tests for the Rulesets logic in `ruleset-unit-tests`.

## Integration Tests

### Running

Locally

-   Install newman globally `npm i -g newman`
-   Start function `npm start`
-   Run Tests `npm run int:test`

In Docker container

-   Install newman globally `npm i -g newman`
-   Edit `function.json` files to set `"authLevel": "anonymous"`, don't forget to change back!
-   Start function `npm run docker:start`
-   Run Tests `npm run docker:int:test`

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

### Deploying to dev

Dev deploys are handled by `.github/workflows/develop-func-deploy.yml`, which triggers on push to `develop` and on a daily 04:19 UTC cron.

-   Dependabot PRs are auto-merged with `GITHUB_TOKEN`. GitHub never triggers workflows on `GITHUB_TOKEN` pushes, so those merges are deployed by the next daily cron, not immediately.
-   This is a public repo, so GitHub auto-disables any workflow with a `schedule` trigger after 60 days without repo activity. When that happens the whole deploy workflow **stops responding to all** triggers, including human pushes to `develop`. Pushing again does not re-enable it.
-   The workflow will be re-enabled when a commit touches the workflow file itself (e.g. a dependabot action bump), after which the next 04:19 UTC cron deploys. It can also be re-enabled via the GitHub UI, or via this command:

    `gh workflow enable develop-func-deploy.yml`

-   If a merge to `develop` does not deploy, check the workflow state:

    `gh api repos/IATI/js-validator-api/actions/workflows --jq '.workflows[] | "\(.state) \(.path)"'`

    If the deploy workflow is not `active`, use one of the methods detailed above to re-enable the workflow, then do a manual dispatch.

## XML Library

XML parsing and XSD schema validation use [`libxml2-wasm`](https://github.com/jameslan/libxml2-wasm), a WebAssembly build of libxml2. `libxml2-wasm` builds its libxml2 from a git submodule, and from v0.7.0 that submodule points at the maintainer's own fork rather than upstream — earlier releases such as v0.6.0 pinned a clean upstream release tag. Version 0.7.1 pins commit `f52e859`, which is the **v2.15.1 release plus two unmerged commits** by the `libxml2-wasm` maintainer adding Windows path handling. It contains all of 2.15.1, but sits on a branch off it, so those two commits are not in 2.15.2 or 2.15.3.

Those patches touch `uri.c` and `xmlIO.c`, which is the code resolving `xsd:include`, but they do not change behaviour here: every branch they add is guarded by a runtime flag that defaults to off, and `libxml2-wasm` explicitly disables it on any platform other than Windows (`node_modules/libxml2-wasm/lib/libxml2.mjs`). Behaviour was also compared against v0.6.0, which pins the clean upstream v2.14.5 tag, across 426 real published datasets with no disagreement in verdict or error count.

When upgrading `libxml2-wasm`, check whether the submodule has returned to an upstream tag. While it stays on the fork, each bump also takes whatever else is on that branch.

It replaced the native `libxmljs2`, which is no longer maintained and still bundles libxml2 2.9.9 from 2019 — old enough to accept values that later versions correctly reject, so the Validator disagreed with the Dashboard on whether a file was schema valid. No release of `libxmljs2` carries a newer libxml2, which is why the library was changed rather than upgraded.

Two things to know when working with it:

-   Documents and compiled schemas hold memory outside the JS heap and must be `dispose()`d. Whatever creates an `XmlDocument` is responsible for freeing it, normally in a `finally`.
-   It throws on a parse failure whenever libxml2 recorded any error at all, even when a usable document was still produced. `libxmljs2` threw only when no document could be built, so problems that do not prevent a tree being built — an undeclared namespace prefix, say — were reported later as schema errors. `utils/xmlParse.js` restores that behaviour; without it such files would be rejected with a file level `0.1.1` instead.

Note the `xmllint --recover` pre-pass is a separate, system-installed libxml2 (see Prerequisities), so it is generally an older version than the one used for validation.

## Customised Dependencies

### xpath

-   Fork [IATI/xpath](https://github.com/iati/xpath) - [v0.0.34](https://github.com/IATI/xpath/releases/tag/v0.0.34)
    -   Sent a performance improvement PR that hasn't been merged into the original project: https://github.com/goto100/xpath/pull/107
        -   If that is ever merged, then we could get rid of this custom dependency.
    -   Also merged this performance PR from another dev to our fork (also hasn't been merged into the original project): https://github.com/goto100/xpath/pull/108
        -   If that is ever merged, then we could get rid of this custom dependency.

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

    At line greater than: 65537. Note: The validator cannot display accurate line numbers for schema errors located at a line greater than 65537 for this activity.
