const { schemaValidateFile } = require('../services/schemaValidator');

module.exports = async (context, req) => {
    await schemaValidateFile(context, req);
};
