import { createClient } from 'redis';
import config from './config.js';

let connectionOptions = {};
// https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/cache-best-practices-connection
if (config.REDIS_KEY && config.REDIS_HOSTNAME) {
    connectionOptions = {
        url: `rediss://${config.REDIS_HOSTNAME}:${config.REDIS_PORT}`,
        password: config.REDIS_KEY,
        socket: {
            connectTimeout: 5000,
            reconnectStrategy: (attempts) => {
                if (attempts === 1) {
                    console.log(
                        `Failed to connect to ${config.REDIS_HOSTNAME}:${config.REDIS_PORT}. Reconnecting...`
                    );
                }
                if (attempts >= 20) {
                    return 500;
                }
                const timeToWait = 2 ** attempts * 10;
                console.log(
                    `Redis reconnecting attempt ${attempts}, waiting ${timeToWait / 1000}s...`
                );
                return timeToWait;
            },
        },
    };
} else {
    connectionOptions = {
        url: `redis://${config.REDIS_HOSTNAME}:${config.REDIS_PORT}`
    };
}
const client = createClient(connectionOptions);
client.on('ready', () => {
    console.log({
        name: 'redisConnect',
        value: `Redis: Connection to ${config.REDIS_HOSTNAME} ready`,
    });
});
client.on('error', (err) => {
    console.error('Redis: Unable to connect to the redis database: ', err);
});

await client.connect();

export default client;
