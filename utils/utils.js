const xml2js = require('xml2js');
const fs = require('fs/promises');

const config = require('../config/config');

// parse xml body to JSON to check the root element, don't attempt to parse if output from xmllint --recover was just blank XML doc
exports.getFileInformation = async (body) => {
    let fileType = '';
    let version = '';
    let generatedDateTime = '';
    let numberActivities;
    let supportedVersion;
    let isIati;
    let json;
    if (body.toString() !== `<?xml version="1.0"?>\n`) {
        json = await xml2js.parseStringPromise(body);
        if (json) {
            fileType = Object.keys(json).join('');
            if (fileType === 'iati-activities') {
                ({ version, 'generated-datetime': generatedDateTime } = json[fileType].$);
                supportedVersion = version && config.VERSIONS.includes(version);
                if (Array.isArray(json[fileType]['iati-activity'])) {
                    numberActivities = json[fileType]['iati-activity'].length;
                }
                isIati = true;
            } else if (fileType === 'iati-organisations') {
                ({ version, 'generated-datetime': generatedDateTime } = json[fileType].$);
                supportedVersion = version && config.VERSIONS.includes(version);
                numberActivities = '';
                isIati = true;
            } else {
                isIati = false;
            }
        }
    }
    return {
        fileType,
        version,
        generatedDateTime,
        numberActivities,
        supportedVersion,
        isIati,
    };
};

const codelistRules = {};
const ruleset = {};
config.VERSIONS.forEach(async (version) => {
    // load 'allowedCodes' Arrays in as Set's for faster .has lookup
    codelistRules[version] = JSON.parse(
        await fs.readFile(`codelists/${version}/codelist_rules.json`),
        (key, value) => (key === 'allowedCodes' ? new Set(value) : value)
    );

    ruleset[version] = JSON.parse(await fs.readFile(`rulesets/${version}/standard.json`));
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
