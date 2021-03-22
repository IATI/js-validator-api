const appInsights = require('applicationinsights');
const config = require('./config');

appInsights.setup().start();
exports.appInsights = appInsights;
exports.client = appInsights.defaultClient;

exports.getStartTime = () => process.hrtime.bigint();

exports.getElapsedTime = (startTime) =>
    Number(Number(Number(process.hrtime.bigint() - startTime) / config.NS_PER_SEC).toFixed(3));

exports.getStartRSS = () => process.resourceUsage().maxRSS;

exports.getRSSChange = (beforeRSS) => (process.resourceUsage().maxRSS - beforeRSS) / 1000000;
