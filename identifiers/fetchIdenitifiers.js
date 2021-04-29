// const fetch = require('node-fetch');
const fs = require('fs/promises');

let orgIdPrefixes = '';
let orgIds = '';

exports.getOrgIdPrefixes = async () => {
    if (orgIdPrefixes === '') {
        console.log('Fetching OrgIdPrefixes from http://org-id.guide/download.json');
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

exports.getOrgIds = async () => {
    if (orgIds === '') {
        console.log('Fetching OrgIds');
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
