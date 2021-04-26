const fetch = require('node-fetch');

exports.getOrgIds = async () => {
    const res = await fetch('http://org-id.guide/download.json');
    const fullOrgIdInfo = await res.json();
    return fullOrgIdInfo.lists.reduce((acc, orgId) => {
        if (orgId.confirmed) {
            acc.add(orgId.code);
        }
        return acc;
    }, new Set());
};
