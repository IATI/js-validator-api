import { schemaValidate } from '../services/schemaValidator.js';

export default async function pvtValidateSchemaPost(context, req) {
    await schemaValidate(context, req);
}
