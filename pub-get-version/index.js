import config from '../config/config.js';

export default async function pubGetVersion(context) {
    context.log({
        name: 'runtimeVersion',
        node: process.versions.node,
    });

    context.res = {
        body: config.VERSION,
    };
}
