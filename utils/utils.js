const libxml = require('libxmljs2');
const fs = require('fs/promises');

const config = require('../config/config');

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
    codelistRules[version] = JSON.parse(
        await fs.readFile(`codelists/${version}/codelist_rules.json`),
        (key, value) => (key === 'allowedCodes' ? new Set(value) : value)
    );

    // load rulesets
    ruleset[version] = JSON.parse(await fs.readFile(`rulesets/${version}/standard.json`));

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
