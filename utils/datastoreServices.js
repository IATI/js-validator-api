import fetch from 'node-fetch';
import config from '../config/config.js';


async function checkIfBatchIatiIdentifiersInDatastore(iatiIdentifiers) {
    const requestHeaders = { Accept: 'application/json' };
    requestHeaders[config.DATASTORE_SERVICES_AUTH_HTTP_HEADER_NAME] = config.DATASTORE_SERVICES_AUTH_HTTP_HEADER_VALUE;

    const requestBody = { "iati_identifiers" : iatiIdentifiers };

    const response = await fetch(`${config.DATASTORE_SERVICES_URL}/pub/iati-identifiers/exist`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody)
    });

    const responseJson = await response.json();
    
    if (response.status !== 200) {
        throw new Error(
            `Error querying the Datastore to check existence of IATI Identifiers. Status: ${response.status}. Message: ${responseJson.error}`
        );
    }
    
    return responseJson;
};

async function checkIfIatiIdentifiersInDatastore(iatiIdentifiers) {

    const identifiersPerBatch = config.DATASTORE_SERVICES_IATI_IDENTIFIERS_EXIST_MAX_NUMBER_OF_IDS;

    const datastoreResults = { num_iati_identifiers_not_found: 0, 
        total_iati_identifier_occurrences: 0, 
        unique_iati_identifiers_found: 0,
        iati_identifiers_found: {},
        iati_identifiers_not_found: {}
    };

    for (let i = 0; i < iatiIdentifiers.length; i += identifiersPerBatch) {
        const iatiIdentifiersToCheckInBatch = iatiIdentifiers.slice(i, (i + identifiersPerBatch));
        // eslint-disable-next-line no-await-in-loop
        const batchResults = await checkIfBatchIatiIdentifiersInDatastore(iatiIdentifiersToCheckInBatch);

        datastoreResults.num_iati_identifiers_not_found += batchResults.num_iati_identifiers_not_found;
        datastoreResults.total_iati_identifier_occurrences += batchResults.total_iati_identifier_occurrences;
        datastoreResults.unique_iati_identifiers_found += batchResults.unique_iati_identifiers_found;
        Object.assign(datastoreResults.iati_identifiers_found, batchResults.iati_identifiers_found);
        Object.assign(datastoreResults.iati_identifiers_not_found, batchResults.iati_identifiers_not_found);
    }

    return datastoreResults;
}

// eslint-disable-next-line import/prefer-default-export
export { checkIfIatiIdentifiersInDatastore };
