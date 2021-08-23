const config = require('../config/config');

module.exports = async (context) => {
    context.res = {
        body: config.VERSION,
    };
};
