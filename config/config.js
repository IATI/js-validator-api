require('dotenv').config();

module.exports = {
    APP_NAME: 'IATI Validator API',
    VERSION: process.env.npm_package_version,
    NODE_ENV: process.env.NODE_ENV,
    APPINSIGHTS_INSTRUMENTATIONKEY: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
    NS_PER_SEC: 1e9,
    VERSIONS: process.env.VERSIONS || ['2.01', '2.02', '2.03'],
    MAX_FILESIZE: process.env.MAX_FILESIZE || 60,
    GITHUB_BASIC_TOKEN: process.env.GITHUB_BASIC_TOKEN,
};
