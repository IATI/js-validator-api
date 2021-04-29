const fetch = require('node-fetch');

let orgIdPrefixes = '';

exports.getOrgIdPrefixes = async () => {
    if (orgIdPrefixes === '') {
        console.log('Fetching OrgIds');
        const res = await fetch('http://org-id.guide/download.json');
        const fullOrgIdInfo = await res.json();
        orgIdPrefixes = fullOrgIdInfo.lists.reduce((acc, orgId) => {
            if (orgId.confirmed) {
                acc.add(orgId.code);
            }
            return acc;
        }, new Set());
    }
    return orgIdPrefixes;
};
