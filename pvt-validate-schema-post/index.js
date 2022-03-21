const { schemaValidate } = require('../services/schemaValidator');

module.exports = async (context, req) => {
    await schemaValidate(context, req);
};
