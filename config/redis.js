import { createClient } from 'redis';
import config from './config.js';

let connectionOptions = {};
if (config.REDIS_KEY && config.REDIS_HOSTNAME) {
    connectionOptions = {
        url: `rediss://${config.REDIS_HOSTNAME}:${config.REDIS_PORT}`,
        password: config.REDIS_KEY,
    };
}
const client = createClient(connectionOptions);
client.on('ready', () => {
    console.log({
        name: 'redisConnect',
        value: `Redis: Connection to ${config.REDIS_HOSTNAME || 'local'} ready`,
    });
});
client.on('error', (err) => {
    console.error('Redis: Unable to connect to the redis database: ', err);
    throw err;
});

await client.connect();

export default client;
