const libxml = require('libxmljs2');
const fs = require('fs/promises');
const fetch = require('node-fetch');

const { aSetex, aGet, aExists } = require('../config/redis');
const config = require('../config/config');

const GITHUB_RAW = 'https://raw.githubusercontent.com';
const GITHUB_API = 'https://api.github.com';

const getFileBySha = async (owner, repo, sha, filePath) => {
    // https://raw.githubusercontent.com/IATI/IATI-Codelists/34a421386d554ccefbb4067b8fc21493c562a793/codelist_rules.json
    const res = await fetch(`${GITHUB_RAW}/${owner}/${repo}/${sha}/${filePath}`, {
        method: 'GET',
        headers: {
            Accept: 'text/plain',
            Authorization: `token ${config.BASIC_GITHUB_TOKEN}`,
        },
    });
    const body = res.json();
    if (res.status !== 200)
        throw new Error(
            `Error fetching file from github api. Status: ${res.status} Message: ${body.message} `
        );
    return body;
};

const getFileCommitSha = async (owner, repo, branch, filePath) => {
    // https://api.github.com/repos/IATI/IATI-Codelists/branches/v2.03/validatorCodelist
    const branchRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/branches/${branch}`, {
        method: 'GET',
        headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `token ${config.BASIC_GITHUB_TOKEN}`,
        },
    });
    const branchBody = await branchRes.json();
    if (branchRes.status !== 200)
        throw new Error(
            `Error fetching sha from github api. Status: ${branchRes.status} Message: ${branchBody.message} `
        );
    const { sha } = branchBody.commit;
    // https://api.github.com/repos/IATI/IATI-Codelists/commits?sha=2ad9521a0e7604f44e4df33a8a8699927941e177&path=codelist_rules.json
    const fileRes = await fetch(
        `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${sha}&path=${filePath}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github.v3+json',
                Authorization: `token ${config.BASIC_GITHUB_TOKEN}`,
            },
        }
    );
    const fileBody = await fileRes.json();
    if (fileRes.status !== 200)
        throw new Error(
            `Error fetching sha from github api. Status: ${branchRes.status} Message: ${fileBody.message} `
        );
    // sort to get newest commit
    fileBody.sort(
        (first, second) =>
            new Date(second.commit.committer.date) - new Date(first.commit.committer.date)
    );
    return fileBody[0].sha;
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
        codelistRules[version] = {};
        if ((await aExists(`codelistRules${version}`)) === 0) {
            console.log({
                name: `Fetching codelist rules for version: ${version}, repo: IATI-Codelists, branch: ${codelistBranch} `,
                value: true,
            });

            codelistRules[version].commitSha = await getFileCommitSha(
                'IATI',
                'IATI-Codelists',
                codelistBranch,
                'codelist_rules.json'
            );
            codelistRules[version].content = await getFileBySha(
                'IATI',
                'IATI-Codelists',
                codelistRules[version].commitSha,
                'codelist_rules.json'
            );
        } else {
            console.log({
                name: `Using redis cache codelist rules for version: ${version}`,
                value: true,
            });
            const cachedCodelist = JSON.parse(await aGet(`codelistRules${version}`));
            codelistRules[version] = cachedCodelist;
        }
    } catch (error) {
        console.error(`Error fetching Codelists for version ${version}. Error: ${error}`);
    }

    // load rulesets
    const rulesetBranch = `v${version}/validatorV2`;
    try {
        ruleset[version] = {};
        if ((await aExists(`ruleset${version}`)) === 0) {
            console.log({
                name: `Fetching ruleset for version: ${version}, repo: IATI-Rulesets, branch: ${rulesetBranch} `,
                value: true,
            });

            ruleset[version].commitSha = await getFileCommitSha(
                'IATI',
                'IATI-Rulesets',
                rulesetBranch,
                'rulesets/standard.json'
            );
            ruleset[version].content = await getFileBySha(
                'IATI',
                'IATI-Rulesets',
                ruleset[version].commitSha,
                'rulesets/standard.json'
            );
        } else {
            console.log({
                name: `Using redis cache rulesets for version: ${version}`,
                value: true,
            });
            const cachedRuleset = JSON.parse(await aGet(`ruleset${version}`));
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
        return codelistRules[version].content;
    }
    throw new Error(`Unable to retrieve codelist_rules.json for version ${version}`);
};

exports.getVersionCodelistCommitSha = (version) => {
    if (config.VERSIONS.includes(version)) {
        if ('commitSha' in codelistRules[version]) {
            return codelistRules[version].commitSha;
        }
    }
    return '';
};

exports.getRuleset = (version) => {
    if (config.VERSIONS.includes(version)) {
        return ruleset[version].content;
    }
    throw new Error(`Unable to retrieve standard.json ruleset for version ${version}`);
};

exports.getRulesetCommitSha = (version) => {
    if (config.VERSIONS.includes(version)) {
        if ('commitSha' in ruleset[version]) {
            return ruleset[version].commitSha;
        }
    }
    return '';
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

let orgIdPrefixInfo = '';

exports.getOrgIdPrefixes = async () => {
    if (orgIdPrefixInfo === '') {
        const ORG_ID_PREFIX_URL = 'https://org-id.guide/download.json';
        try {
            let fullOrgIdPrefixInfo;

            if ((await aExists('orgIdPrefixInfo')) === 0) {
                console.log({
                    name: `Fetching OrgId Prefixes from ${ORG_ID_PREFIX_URL}`,
                    value: true,
                });
                const res = await fetch(ORG_ID_PREFIX_URL);
                fullOrgIdPrefixInfo = await res.json();
                if (res.status !== 200)
                    throw new Error(
                        `HTTP Response from ${ORG_ID_PREFIX_URL}: ${res.status}, body: ${fullOrgIdPrefixInfo}`
                    );
                const fileName = res.headers
                    .get('content-disposition')
                    .match(/(org-id-[\w]{10}.json)/)[0];

                const orgIdPrefixes = fullOrgIdPrefixInfo.lists.reduce((acc, orgId) => {
                    if (orgId.confirmed) {
                        acc.push(orgId.code);
                    }
                    return acc;
                }, []);

                orgIdPrefixInfo = { fileName, content: new Set(orgIdPrefixes) };

                // cache to redis for REDIS_CACHE_SEC seconds
                const orgIdPrefixInfoObject = { fileName, content: orgIdPrefixes };
                await aSetex(
                    'orgIdPrefixInfo',
                    config.REDIS_CACHE_SEC,
                    JSON.stringify(orgIdPrefixInfoObject)
                );
            } else {
                console.log({
                    name: `Fetching OrgId Prefixes from Redis cache key: orgIdPrefixInfo`,
                    value: true,
                });
                const orgIdPrefixInfoObject = JSON.parse(await aGet('orgIdPrefixInfo'));
                orgIdPrefixInfo = {
                    ...orgIdPrefixInfoObject,
                    content: new Set(orgIdPrefixInfoObject.content),
                };
            }
        } catch (error) {
            console.error(
                `Error fetching Organsiation ID Prefixes from ${ORG_ID_PREFIX_URL}. Error: ${error}`
            );
        }
    }
    return orgIdPrefixInfo;
};

let orgIds = '';

exports.getOrgIds = async () => {
    if (orgIds === '') {
        const PUBLISHERS_URL = `${config.VALIDATOR_SERVICES_URL}/pvt/publishers`;
        const apiKeyName = config.VALIDATOR_SERVICES_KEY_NAME;
        const apiKeyValue = config.VALIDATOR_SERVICES_KEY_VALUE;
        try {
            let fullOrgIdInfo;

            if ((await aExists('fullOrgIdInfo')) === 0) {
                console.log({
                    name: `Fetching Publishers (orgIds) from ${PUBLISHERS_URL}`,
                    value: true,
                });
                const res = await fetch(PUBLISHERS_URL, {
                    method: 'GET',
                    headers: { [apiKeyName]: apiKeyValue },
                });
                fullOrgIdInfo = await res.json();

                // cache to redis for REDIS_CACHE_SEC seconds
                await aSetex(
                    'fullOrgIdInfo',
                    config.REDIS_CACHE_SEC,
                    JSON.stringify(fullOrgIdInfo)
                );
            } else {
                console.log({
                    name: `Fetching Publishers (orgIds) from Redis cache key: fullOrgIdInfo `,
                    value: true,
                });
                fullOrgIdInfo = JSON.parse(await aGet('fullOrgIdInfo'));
            }

            orgIds = fullOrgIdInfo.reduce((acc, orgId) => {
                acc.add(orgId.iati_id);
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
    'ORG-ID-PREFIX': (await this.getOrgIdPrefixes()).content,
    'ORG-ID': await this.getOrgIds(),
});

exports.getOrgIdPrefixFileName = async () => (await this.getOrgIdPrefixes()).fileName;
