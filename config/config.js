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
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_CACHE_SEC: process.env.REDIS_CACHE_SEC || 86400,
    REDIS_KEY: process.env.REDIS_KEY,
    REDIS_HOSTNAME: process.env.REDIS_HOSTNAME,
    VALIDATOR_SERVICES_URL: process.env.VALIDATOR_SERVICES_URL,
    VALIDATOR_SERVICES_KEY_NAME: process.env.VALIDATOR_SERVICES_KEY_NAME,
    VALIDATOR_SERVICES_KEY_VALUE: process.env.VALIDATOR_SERVICES_KEY_VALUE,
};
