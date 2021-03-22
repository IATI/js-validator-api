const xml2js = require('xml2js');
const { client, getStartTime, getElapsedTime } = require('../config/appInsights');

exports.validate = async (context, req) => {
    const { body } = req;
    const state = {
        fileSize: '',
    };

    // Metric: File Size (Mb)
    state.fileSize = Number(Buffer.byteLength(body) / 1000000).toFixed(4);

    client.trackMetric({ name: 'File Size (Mb)', value: state.fileSize });
    context.log({ name: 'File Size (Mb)', value: state.fileSize });

    try {
        const parseStart = getStartTime();
        const json = await xml2js.parseStringPromise(body, {});

        state.parseTime = getElapsedTime(parseStart);
        context.log({ name: 'Parse Time (s)', value: state.parseTime });

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json),
        };
        return;
    } catch (error) {
        context.log(error);

        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                feedback: 'unhandled server error please contact the iati technical team',
                error,
            },
        };
    }
};
