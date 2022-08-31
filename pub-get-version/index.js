import config from '../config/config.js';

export default async function pubGetVersion(context) {
    context.res = {
        body: config.VERSION,
    };
}
