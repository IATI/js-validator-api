require('dotenv').config();

module.exports = {
    APP_NAME: 'IATI App Name Here',
    VERSION: process.env.npm_package_version,
    NODE_ENV: process.env.NODE_ENV,
    APPINSIGHTS_INSTRUMENTATIONKEY: process.env.APPINSIGHTS_INSTRUMENTATIONKEY,
    NS_PER_SEC: 1e9,
};
