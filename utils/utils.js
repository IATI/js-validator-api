import libxml from 'libxmljs2';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { spawn } from 'child_process';

import redisclient from '../config/redis.js';
import config from '../config/config.js';

const GITHUB_RAW = 'https://raw.githubusercontent.com';
const GITHUB_API = 'https://api.github.com';

const getFileBySha = async (owner, repo, sha, filePath) => {
    // https://raw.githubusercontent.com/IATI/IATI-Validator-Codelists/{sha}/codelist_rules.json
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
    // https://api.github.com/repos/IATI/IATI-Validator-Codelists/branches/version-2.03
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
    // https://api.github.com/repos/IATI/IATI-Validator-Codelists/commits?sha={sha}&path=codelist_rules.json
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
const getFileInformation = (body) => {
    let fileType = '';
    let version = '';
    let generatedDateTime = '';
    let supportedVersion;
    let isIati;
    let xmlDoc;
    if (body.toString() !== `<?xml version="1.0"?>\n`) {
        xmlDoc = libxml.parseXml(body, { huge: true });
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
const advisoryDefinitions = {};

config.VERSIONS.forEach(async (version) => {
    // load codelists
    const codelistRepo = 'IATI-Validator-Codelists';
    const codelistBranch = `version-${version}`;
    try {
        codelistRules[version] = {};
        if ((await redisclient.EXISTS(`codelistRules${version}`)) === 0) {
            console.log({
                name: `Fetching codelist rules for version: ${version}, repo: ${codelistRepo}, branch: ${codelistBranch} `,
                value: true,
            });

            codelistRules[version].commitSha = await getFileCommitSha(
                'IATI',
                codelistRepo,
                codelistBranch,
                'codelist_rules.json'
            );
            codelistRules[version].content = await getFileBySha(
                'IATI',
                codelistRepo,
                codelistRules[version].commitSha,
                'codelist_rules.json'
            );
            await redisclient.SET(
                `codelistRules${version}`,
                JSON.stringify(codelistRules[version])
            );
        } else {
            console.log({
                name: `Using redis cache codelist rules for version: ${version}`,
                value: true,
            });
            const cachedCodelist = JSON.parse(await redisclient.GET(`codelistRules${version}`));
            codelistRules[version] = cachedCodelist;
        }
    } catch (error) {
        console.error(`Error fetching Codelists for version ${version}. Error: ${error}`);
    }

    // load rulesets
    const rulesetBranch = `version-${version}`;
    try {
        ruleset[version] = {};
        if ((await redisclient.EXISTS(`ruleset${version}`)) === 0) {
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
            await redisclient.SET(`ruleset${version}`, JSON.stringify(ruleset[version]));
        } else {
            console.log({
                name: `Using redis cache rulesets for version: ${version}`,
                value: true,
            });
            const cachedRuleset = JSON.parse(await redisclient.GET(`ruleset${version}`));
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

    // load advisories
    try {
        const advisoriesJson = (await fs.readFile(`advisory-definitions/advisoryDefinitions-${version}.json`)).toString();
        advisoryDefinitions[version] = JSON.parse(advisoriesJson);
        console.log(`Loaded advisories for version ${version}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            advisoryDefinitions[version] = {};
        } else {
            console.error(`Problem fetching advisories for version ${version}: ${error}`);
        }
    }
});

const getVersionCodelistRules = (version) => {
    if (config.VERSIONS.includes(version)) {
        return codelistRules[version].content;
    }
    throw new Error(`Unable to retrieve codelist_rules.json for version ${version}`);
};

const getVersionCodelistCommitSha = (version) => {
    if (config.VERSIONS.includes(version)) {
        if ('commitSha' in codelistRules[version]) {
            return codelistRules[version].commitSha;
        }
    }
    return '';
};

const getRuleset = (version) => {
    if (config.VERSIONS.includes(version)) {
        return ruleset[version].content;
    }
    throw new Error(`Unable to retrieve standard.json ruleset for version ${version}`);
};

const getAdvisoryDefinitions = (version) => {
    if (config.VERSIONS.includes(version)) {
        return advisoryDefinitions[version];
    }
    throw new Error(`Unable to retrieve advisories in advisoryDefinitions-${version}.json`);
};


const getRulesetCommitSha = (version) => {
    if (config.VERSIONS.includes(version)) {
        if ('commitSha' in ruleset[version]) {
            return ruleset[version].commitSha;
        }
    }
    return '';
};

const getSchema = (fileType, version) => {
    if (
        config.VERSIONS.includes(version) &&
        (fileType === 'iati-activities' || fileType === 'iati-organisations')
    ) {
        return schemas[`${fileType}-${version}`];
    }
    throw new Error(`Unable to retrieve ${fileType} schema for version ${version}`);
};

const ORG_ID_PREFIX_URL = 'https://org-id.guide/download.json';

const parseOrgIdFilename = (headers) =>
    headers.get('content-disposition').match(/filename="(.+)"/)[1];

const fetchOrgIdFilename = async () => {
    // check filename
    const res = await fetch(ORG_ID_PREFIX_URL, {
        method: 'head',
        headers: { 'User-Agent': `iati-validator-api/${config.VERSION}` },
    });
    if (res.status !== 200) {
        console.error(
            `HTTP Response from ${ORG_ID_PREFIX_URL}: ${res.status}, while fetching current filename`
        );
        return '';
    }
    return parseOrgIdFilename(res.headers);
};

const fetchOrgIdPrefixes = async () => {
    console.log({
        name: `Fetching OrgId Prefixes from ${ORG_ID_PREFIX_URL}`,
        value: true,
    });
    const res = await fetch(ORG_ID_PREFIX_URL, {
        headers: { 'User-Agent': `iati-validator-api/${config.VERSION}` },
    });
    if (res.status !== 200) {
        console.error(`HTTP Response from ${ORG_ID_PREFIX_URL}: ${res.status}`);
        return { fileName: `error-${res.status}`, content: [] };
    }
    const fullOrgIdPrefixInfo = await res.json();
    const fileName = parseOrgIdFilename(res.headers);

    const orgIdPrefixesOnly = fullOrgIdPrefixInfo.lists.reduce((acc, orgId) => {
        if (orgId.confirmed) {
            acc.push(orgId.code);
        }
        return acc;
    }, []);

    return { fileName, content: orgIdPrefixesOnly };
};

let orgIdPrefixes = '';

const fetchCacheSaveOrgIdPrefixes = async () => {
    // fetch
    const orgIdPrefixInfoObject = await fetchOrgIdPrefixes();

    // cache redis
    await redisclient.SET('orgIdPrefixInfo', JSON.stringify(orgIdPrefixInfoObject));

    // save globally
    orgIdPrefixes = {
        fileName: orgIdPrefixInfoObject.fileName,
        content: new Set(orgIdPrefixInfoObject.content),
    };

    return orgIdPrefixes;
};

const getOrgIdPrefixes = async () => {
    try {
        const fileName = await fetchOrgIdFilename();
        if (fileName === '') {
            console.warn(
                `No filename in Content-Disposition header from ${ORG_ID_PREFIX_URL}, can't confirm we're using most up-to-date Org-Id prefixes`
            );
        }
        if (orgIdPrefixes !== '') {
            // check filename to ensure we have most current file
            if (fileName === '' || fileName === orgIdPrefixes.fileName) return orgIdPrefixes;
        }
        // not cached in redis
        if ((await redisclient.EXISTS('orgIdPrefixInfo')) === 0) {
            return fetchCacheSaveOrgIdPrefixes();
        }
        // is available in cache
        console.log({
            name: `Fetching OrgId Prefixes from Redis cache key: orgIdPrefixInfo`,
            value: true,
        });
        const orgIdPrefixInfoObject = JSON.parse(await redisclient.GET('orgIdPrefixInfo'));

        // if cached filename doesn't match fetch/cache/save
        if (fileName !== '' && fileName !== orgIdPrefixInfoObject.fileName) {
            return fetchCacheSaveOrgIdPrefixes();
        }

        // save globally
        orgIdPrefixes = {
            fileName: orgIdPrefixInfoObject.fileName,
            content: new Set(orgIdPrefixInfoObject.content),
        };

        return orgIdPrefixes;
    } catch (error) {
        console.error(
            `Error fetching Organisation ID Prefixes from ${ORG_ID_PREFIX_URL}. Error: ${error}`
        );
        return { fileName: 'not-available', content: new Set() };
    }
};

let orgIds = '';

const getOrgIds = async () => {
    if (orgIds === '') {
        const PUBLISHERS_URL = `${config.VALIDATOR_SERVICES_URL}/pvt/publishers`;
        const apiKeyName = config.VALIDATOR_SERVICES_KEY_NAME;
        const apiKeyValue = config.VALIDATOR_SERVICES_KEY_VALUE;
        try {
            let fullOrgIdInfo;

            if ((await redisclient.EXISTS('fullOrgIdInfo')) === 0) {
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
                await redisclient.SET('fullOrgIdInfo', JSON.stringify(fullOrgIdInfo), {
                    EX: config.REDIS_CACHE_SEC,
                });
            } else {
                console.log({
                    name: `Fetching Publishers (orgIds) from Redis cache key: fullOrgIdInfo `,
                    value: true,
                });
                fullOrgIdInfo = JSON.parse(await redisclient.GET('fullOrgIdInfo'));
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

const getIdSets = async () => ({
    'ORG-ID-PREFIX': (await getOrgIdPrefixes()).content,
    'ORG-ID': await getOrgIds(),
});

const getOrgIdPrefixFileName = () => orgIdPrefixes.fileName;

/**
 * stdout is written to output
 * sterr is written to error
 * returns an object { output, error } if exitcode = 0 on close
 */
const execXmllint = (input, command) =>
    new Promise((resolve, reject) => {
        const xmllint = spawn(command, { shell: true });
        // stdout and stderr are both captured to be made available if the promise rejects
        let output = '';
        let error = '';
        xmllint.stdout.on('data', (chunk) => {
            output += chunk.toString();
        });
        xmllint.stderr.on('data', (chunk) => {
            error += chunk.toString();
        });
        // Any errors cause a rejection
        xmllint.on('error', reject);
        xmllint.on('close', (code) => {
            if (code === 0) {
                return resolve({ output, error });
            }
            return reject(
                new Error(
                    `xmllint exited with code ${code} when executed with ${command}:\n${error}`
                )
            );
        });
        // pipe input to process
        xmllint.stdin.write(input);
        xmllint.stdin.end();
        xmllint.stdin.on('error', reject);
    });

/**
 * Validate XML without any DTD or schema. Return Recovered XML.
 *
 * @param input XML
 */
const validateXMLrecover = (input) => execXmllint(input, `xmllint --nonet --recover -`);

export {
    validateXMLrecover,
    getOrgIdPrefixFileName,
    getIdSets,
    getOrgIds,
    getOrgIdPrefixes,
    getFileInformation,
    getVersionCodelistRules,
    getVersionCodelistCommitSha,
    getRuleset,
    getAdvisoryDefinitions,
    getSchema,
    getRulesetCommitSha,
};
