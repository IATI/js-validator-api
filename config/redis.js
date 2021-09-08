const redis = require('redis');
const { promisify } = require('util');
const config = require('./config');

try {
    let connectionOptions = {};
    if (config.REDIS_KEY && config.REDIS_HOSTNAME) {
        connectionOptions = {
            auth_pass: config.REDIS_KEY,
            tls: { servername: config.REDIS_HOSTNAME },
        };
    }
    const client = redis
        .createClient(config.REDIS_PORT, config.REDIS_HOSTNAME, connectionOptions)
        .on('ready', () => {
            console.log({
                name: 'redisConnect',
                value: `Redis: Connection to ${config.REDIS_HOSTNAME || 'local'} ready`,
            });
            return client;
        })
        .on('error', (err) => {
            console.error('Redis: Unable to connect to the redis database: ', err);

            throw err;
        });

    exports.aSetex = promisify(client.setex).bind(client);
    exports.aSet = promisify(client.set).bind(client);
    exports.aGet = promisify(client.get).bind(client);
    exports.aExists = promisify(client.exists).bind(client);
} catch (error) {
    console.error('Redis: Unable to connect to the redis database: ', error);
}
