const libxml = require('libxmljs2');
const fs = require('fs/promises');
const fetch = require('node-fetch');

const { aSetex, aGet } = require('../config/redis');
const config = require('../config/config');

const GITHUB_RAW = 'https://raw.githubusercontent.com';

// https://raw.githubusercontent.com/IATI/IATI-Codelists/v2.03/validatorCodelist/codelist_rules.json
const fetchJSONfromGitHub = async (repo, branch, fileName) => {
    const res = await fetch(`${GITHUB_RAW}/IATI/${repo}/${branch}/${fileName}`, {
        method: 'GET',
        headers: {
            Accept: 'text/plain',
            Authorization: `Basic ${config.GITHUB_BASIC_TOKEN}`,
        },
    });
    return res.json();
};

// parse xml body to JSON to check the root element, don't attempt to parse if output from xmllint --recover was just blank XML doc
exports.getFileInformation = (body) => {
    let fileType = '';
    let version = '';
    let generatedDateTime = '';
    let supportedVersion;
    let isIati;
    let xmlDoc;
    if (body.toString() !== `<?xml version="1.0"?>\n`) {
        xmlDoc = libxml.parseXml(body);
        if (xmlDoc) {
            const root = xmlDoc.root().name();

            isIati = root === 'iati-activities' || root === 'iati-organisations';
            // set fileType to '' for non IATI files
            fileType = isIati ? root : '';

            if (xmlDoc.get(`/${fileType}/@version`) !== undefined) {
                version = xmlDoc.get(`/${fileType}/@version`).value();
            }
            if (xmlDoc.get(`/${fileType}/@generated-datetime`) !== undefined) {
                generatedDateTime = xmlDoc.get(`/${fileType}/@generated-datetime`).value();
            }
            supportedVersion = version && config.VERSIONS.includes(version);
        }
    }
    return {
        fileType,
        version,
        generatedDateTime,
        supportedVersion,
        isIati,
        xmlDoc,
    };
};

const codelistRules = {};
const ruleset = {};
const schemas = {};

config.VERSIONS.forEach(async (version) => {
    // load codelists
    const codelistBranch = `v${version}/validatorCodelist`;
    try {
        const cachedCodelistRule = JSON.parse(await aGet(`codelistRules${version}`));

        if (!cachedCodelistRule) {
            console.log({
                name: `Fetching codelist rules for version: ${version}, repo: IATI-Codelists, branch: ${codelistBranch} `,
                value: true,
            });
            codelistRules[version] = await fetchJSONfromGitHub(
                'IATI-Codelists',
                codelistBranch,
                'codelist_rules.json'
            );
        } else {
            console.log({
                name: `Using redis cache codelist rules for version: ${version}`,
                value: true,
            });
            codelistRules[version] = cachedCodelistRule;
        }
    } catch (error) {
        console.error(`Error fetching Codelists for version ${version}. Error: ${error}`);
    }

    // load rulesets
    const rulesetBranch = `v${version}/validatorV2`;
    try {
        const cachedRuleset = JSON.parse(await aGet(`ruleset${version}`));

        if (!cachedRuleset) {
            console.log({
                name: `Fetching ruleset for version: ${version}, repo: IATI-Rulesets, branch: ${rulesetBranch} `,
                value: true,
            });
            ruleset[version] = await fetchJSONfromGitHub(
                'IATI-Rulesets',
                rulesetBranch,
                'rulesets/standard.json'
            );
        } else {
            console.log({
                name: `Using redis cache rulesets for version: ${version}`,
                value: true,
            });
            ruleset[version] = cachedRuleset;
        }
    } catch (error) {
        console.error(`Error fetching Rulesets for version ${version}. Error: ${error}`);
    }

    // load schemas
    ['iati-activities', 'iati-organisations'].forEach(async (fileType) => {
        schemas[`${fileType}-${version}`] = libxml.parseXml(
            (await fs.readFile(`schemas/${version}/${fileType}-schema.xsd`)).toString(),
            { baseUrl: `./schemas/${version}/` }
        );
    });
});

exports.getVersionCodelistRules = (version) => {
    if (config.VERSIONS.includes(version)) {
        return codelistRules[version];
    }
    throw new Error(`Unable to retrieve codelist_rules.json for version ${version}`);
};

exports.getRuleset = (version) => {
    if (config.VERSIONS.includes(version)) {
        return ruleset[version];
    }
    throw new Error(`Unable to retrieve standard.json ruleset for version ${version}`);
};

exports.getSchema = (fileType, version) => {
    if (
        config.VERSIONS.includes(version) &&
        (fileType === 'iati-activities' || fileType === 'iati-organisations')
    ) {
        return schemas[`${fileType}-${version}`];
    }
    throw new Error(`Unable to retrieve standard.json ruleset for version ${version}`);
};

let orgIdPrefixes = '';

exports.getOrgIdPrefixes = async () => {
    if (orgIdPrefixes === '') {
        const ORG_ID_PREFIX_URL = 'http://org-id.guide/download.json';
        try {
            let fullOrgIdPrefixInfo = JSON.parse(await aGet('fullOrgIdPrefixInfo'));

            if (fullOrgIdPrefixInfo === null) {
                console.log({
                    name: `Fetching OrgId Prefixes from ${ORG_ID_PREFIX_URL}`,
                    value: true,
                });
                const res = await fetch(ORG_ID_PREFIX_URL);
                fullOrgIdPrefixInfo = await res.json();

                // cache to redis for REDIS_CACHE_SEC seconds
                await aSetex(
                    'fullOrgIdPrefixInfo',
                    config.REDIS_CACHE_SEC,
                    JSON.stringify(fullOrgIdPrefixInfo)
                );
            }
            // const fullOrgIdPrefixInfo = await JSON.parse(
            //     await fs.readFile('identifiers/org-id-45a64726cf.json')
            // );
            orgIdPrefixes = fullOrgIdPrefixInfo.lists.reduce((acc, orgId) => {
                if (orgId.confirmed) {
                    acc.add(orgId.code);
                }
                return acc;
            }, new Set());
        } catch (error) {
            console.error(
                `Error fetching Organsiation ID Prefixes from ${ORG_ID_PREFIX_URL}. Error: ${error}`
            );
        }
    }
    return orgIdPrefixes;
};

let orgIds = '';

exports.getOrgIds = async () => {
    if (orgIds === '') {
        const PUBLISHERS_URL = 'https://iatiregistry.org/publisher/download/json';
        try {
            let fullOrgIdInfo = JSON.parse(await aGet('fullOrgIdInfo'));

            if (fullOrgIdInfo === null) {
                // console.log({
                //     name: `Fetching Publishers (orgIds) from ${PUBLISHERS_URL}`,
                //     value: true,
                // });
                // const res = await fetch(PUBLISHERS_URL);
                // fullOrgIdInfo = await res.json();

                console.log({
                    name: `Loading Publishers (orgIds) from local file`,
                    value: true,
                });
                fullOrgIdInfo = await JSON.parse(
                    await fs.readFile('identifiers/iati_publishers_list.json')
                );

                // cache to redis for REDIS_CACHE_SEC seconds
                await aSetex(
                    'fullOrgIdInfo',
                    config.REDIS_CACHE_SEC,
                    JSON.stringify(fullOrgIdInfo)
                );
            }

            orgIds = fullOrgIdInfo.reduce((acc, orgId) => {
                acc.add(orgId['IATI Organisation Identifier']);
                return acc;
            }, new Set());
        } catch (error) {
            console.error(
                `Error fetching Organsiation IDs from ${PUBLISHERS_URL}. Error: ${error}`
            );
        }
    }
    return orgIds;
};

exports.getIdSets = async () => ({
    'ORG-ID-PREFIX': await this.getOrgIdPrefixes(),
    'ORG-ID': await this.getOrgIds(),
});

// returns an array of branch info from the GitHub API, filtered to "version-X.XX" branches only
exports.getVersionBranches = async (repo) => {
    const response = await fetch(`https://api.github.com/repos/IATI/${repo}/branches`, {
        method: 'GET',
        headers: {
            accept: 'application/vnd.github.v3+json',
            Authorization: `Basic ${config.GITHUB_BASIC_TOKEN}`,
        },
    });
    const data = await response.json();

    // filter to "version-X.XX" branches that are in VERSIONS
    return Array.from(data).filter((branch) => {
        const ver = branch.name.split('-')[1];
        return config.VERSIONS.includes(ver);
    });
};
