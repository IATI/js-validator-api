import { schemaValidateFile } from '../services/schemaValidator.js';

export default async function pvtSchemaValidateFilePost(context, req) {
    await schemaValidateFile(context, req);
}
