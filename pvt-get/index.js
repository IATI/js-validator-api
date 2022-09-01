import { client, getStartTime, getElapsedTime } from '../config/appInsights.js';
import config from '../config/config.js';

export default async function pvtGet(context, req) {
    // context.log is equivalent to console.log in Azure Functions
    context.log('JavaScript HTTP trigger function processed a request.');

    const startTime = getStartTime();

    const name = req.query.name || (req.body && req.body.name);
    const responseMessage = `Private API.\nVersion ${config.VERSION}\n${
        name
            ? `Hello, ${name}. This HTTP triggered function executed successfully.`
            : 'This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.'
    }`;

    const responseTime = getElapsedTime(startTime);

    // Send a specific metric in AppInsights Telemetry
    client.trackMetric({
        name: 'Message Creation - Success (s)',
        value: responseTime,
    });

    // Send a full Event in AppInsights - able to report/chart on this in AppInsights
    const eventSummary = {
        name: 'PVT Event Summary',
        properties: {
            messageTime: responseTime,
            responseMessage,
            query: name,
        },
    };
    client.trackEvent(eventSummary);

    // Generating a response
    context.res = {
        status: 200 /* Defaults to 200 */,
        headers: { 'Content-Type': 'application/json' },
        body: responseMessage,
    };
}
