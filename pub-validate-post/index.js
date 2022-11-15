import validate from '../services/validationService.js';
import { appInsights } from '../config/appInsights.js';

const pubValidatePost = async (context, req) => {
    await validate(context, req);
};

// Default export wrapped with Application Insights FaaS context propagation
const index = async (context, req) => {
    // Start an AI Correlation Context using the provided Function context
    const correlationContext = appInsights.startOperation(context, req);

    // Wrap the Function runtime with correlationContext
    return appInsights.wrapWithCorrelationContext(async () => {
        const startTime = Date.now(); // Start trackRequest timer

        // Run the Function
        await pubValidatePost(context, req);

        // Track Request on completion
        appInsights.defaultClient.trackRequest({
            name: `${context.req.method} ${context.req.url}`,
            resultCode: context.res.status,
            success: true,
            url: req.url,
            duration: Date.now() - startTime,
            id: correlationContext.operation.parentId,
        });
        appInsights.defaultClient.flush();
    }, correlationContext)();
};

export { index, pubValidatePost };
