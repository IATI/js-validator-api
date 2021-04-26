const fetch = require('node-fetch');

let orgIds = '';

exports.getOrgIds = async () => {
    if (orgIds === '') {
        console.log('Fetching OrgIds');
        const res = await fetch('http://org-id.guide/download.json');
        const fullOrgIdInfo = await res.json();
        orgIds = fullOrgIdInfo.lists.reduce((acc, orgId) => {
            if (orgId.confirmed) {
                acc.add(orgId.code);
            }
            return acc;
        }, new Set());
    }
    return orgIds;
};
