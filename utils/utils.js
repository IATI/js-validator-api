const libxml = require('libxmljs2');
const fs = require('fs/promises');
const fetch = require('node-fetch');

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
            fileType = xmlDoc.root().name();
            isIati = fileType === 'iati-activities' || fileType === 'iati-organisations';

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
    // load 'allowedCodes' Arrays in as Set's for faster .has() lookup
    try {
        codelistRules[version] = await fetchJSONfromGitHub(
            'IATI-Codelists',
            `v${version}/validatorCodelist`,
            'codelist_rules.json'
        );
    } catch (error) {
        console.error(
            `Error fetching Codelists for version ${version} from GitHub. Error: ${error}`
        );
    }

    // load rulesets
    try {
        ruleset[version] = await fetchJSONfromGitHub(
            'IATI-Rulesets',
            `v${version}/validatorV2`,
            'rulesets/standard.json'
        );
    } catch (error) {
        console.error(
            `Error fetching Rulesets for version ${version} from GitHub. Error: ${error}`
        );
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
        console.log({ name: 'Loading OrgId Prefixes', value: true });
        // const res = await fetch('http://org-id.guide/download.json');
        // const fullOrgIdInfo = await res.json();
        const fullOrgIdInfo = await JSON.parse(
            await fs.readFile('identifiers/org-id-45a64726cf.json')
        );
        orgIdPrefixes = fullOrgIdInfo.lists.reduce((acc, orgId) => {
            if (orgId.confirmed) {
                acc.add(orgId.code);
            }
            return acc;
        }, new Set());
    }
    return orgIdPrefixes;
};

let orgIds = '';

exports.getOrgIds = async () => {
    if (orgIds === '') {
        console.log({ name: 'Loading OrgIds', value: true });
        const fullOrgIdInfo = await JSON.parse(
            await fs.readFile('identifiers/iati_publishers_list.json')
        );
        orgIds = fullOrgIdInfo.reduce((acc, orgId) => {
            acc.add(orgId['IATI Organisation Identifier']);
            return acc;
        }, new Set());
    }
    return orgIds;
};

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
