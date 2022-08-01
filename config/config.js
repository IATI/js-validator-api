require('dotenv').config();
const { version } = require('../package.json');

module.exports = {
    APP_NAME: 'IATI Validator API',
    VERSION: version,
    NODE_ENV: process.env.NODE_ENV,
    APPLICATIONINSIGHTS_CONNECTION_STRING: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    NS_PER_SEC: 1e9,
    VERSIONS: process.env.VERSIONS || ['2.01', '2.02', '2.03'],
    MAX_FILESIZE: process.env.MAX_FILESIZE || 60,
    BASIC_GITHUB_TOKEN: process.env.BASIC_GITHUB_TOKEN,
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_CACHE_SEC: process.env.REDIS_CACHE_SEC || 86400,
    REDIS_KEY: process.env.REDIS_KEY,
    REDIS_HOSTNAME: process.env.REDIS_HOSTNAME,
    VALIDATOR_SERVICES_URL: process.env.VALIDATOR_SERVICES_URL,
    VALIDATOR_SERVICES_KEY_NAME: process.env.VALIDATOR_SERVICES_KEY_NAME,
    VALIDATOR_SERVICES_KEY_VALUE: process.env.VALIDATOR_SERVICES_KEY_VALUE,
};
