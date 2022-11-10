import appInsights from 'applicationinsights';
import config from './config.js';

appInsights.setup(config.APPLICATIONINSIGHTS_CONNECTION_STRING).start();
const initAppInsights = appInsights;
export { initAppInsights as appInsights };
export const client = appInsights.defaultClient;

export function getStartTime() {
    return process.hrtime.bigint();
}

export function getElapsedTime(startTime) {
    return Number(
        Number(Number(process.hrtime.bigint() - startTime) / config.NS_PER_SEC).toFixed(3)
    );
}

export function getStartRSS() {
    return process.resourceUsage().maxRSS;
}

export function getRSSChange(beforeRSS) {
    return (process.resourceUsage().maxRSS - beforeRSS) / 1000000;
}
