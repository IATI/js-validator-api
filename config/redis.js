const redis = require('redis');
const { promisify } = require('util');
const config = require('./config');

try {
    let connectionOptions = {};
    if (config.REDISCACHEKEY && config.REDISCACHEHOSTNAME) {
        connectionOptions = {
            auth_pass: config.REDISCACHEKEY,
            tls: { servername: config.REDISCACHEHOSTNAME },
        };
    }
    const client = redis
        .createClient(config.REDIS_PORT, config.REDISCACHEHOSTNAME, connectionOptions)
        .on('ready', () => {
            console.log({
                name: 'redisConnect',
                value: `Redis: Connection to ${config.REDISCACHEHOSTNAME || 'local'} ready`,
            });
            return client;
        })
        .on('error', (err) => {
            console.error('Redis: Unable to connect to the redis database: ', err);

            throw err;
        });

    exports.aSetex = promisify(client.setex).bind(client);
    exports.aGet = promisify(client.get).bind(client);
} catch (error) {
    console.error('Redis: Unable to connect to the redis database: ', error);
}
