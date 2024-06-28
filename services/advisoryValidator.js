/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import { getAdvisoryDefinitions } from '../utils/utils.js';
import { checkIfIatiIdentifiersInDatastore } from '../utils/datastoreServices.js';

const select = xpath.useNamespaces({ xml: 'http://www.w3.org/XML/1998/namespace' });


function getIdentifiersInCurrentDataset(iatiDOM) {
    const iatiIdentifierNodes = select("/iati-activities/iati-activity/iati-identifier/text()", iatiDOM);
    const iatiIdentifiers = iatiIdentifierNodes.map((item) => item.data).filter(item => item !== '');
    return [...new Set(iatiIdentifiers)];
}

function getListIatiIdentifiersToCheck(itemsMatchingAdvisoryWithIdentifiers) {
    const allIdentifiers = itemsMatchingAdvisoryWithIdentifiers.map((item) =>
            item.matchedContent
        ).filter(item => item !== '');
    return [...new Set(allIdentifiers)];
}

function extractIatiIdentifierToVerify(itemsMatchingAdvisory) {
    const matchingItemsWithIdentifiers = itemsMatchingAdvisory.map((item) => {
        const itemWithIdentifier = item;
        itemWithIdentifier.matchedContent = item.matchingElement.getAttribute(item.fullAdvisoryDefinition.attributeToTest)
        return itemWithIdentifier;
    }
    );
    return matchingItemsWithIdentifiers;    
}

function getFailureContextFromDOM(itemMatchingAdvisory, adjustLineCountForMissingXmlTag) {
    const lineAdjustForXmlTag = adjustLineCountForMissingXmlTag ? 1 : 0;
    return [ {
        "text": `For ${itemMatchingAdvisory.fullAdvisoryDefinition.advisoryXPath}/@${itemMatchingAdvisory.fullAdvisoryDefinition.attributeToTest}` + 
                ` = ${itemMatchingAdvisory.matchedContent}` + 
                ` at line: ${itemMatchingAdvisory.matchingElement.lineNumber + lineAdjustForXmlTag},` +
                ` column: ${itemMatchingAdvisory.matchingElement.columnNumber}`,
        "lineNumber": itemMatchingAdvisory.matchingElement.lineNumber + lineAdjustForXmlTag,
        "columnNumber": itemMatchingAdvisory.matchingElement.columnNumber
    }
    ];
}

function getIatiIdentifierOfContainingActivity(domElementNode) {
    if (domElementNode.nodeName === "iati-activity") {
        const iatiIdentifiers = domElementNode.childNodes
                                                    .filter(n => n.nodeName === 'iati-identifier')
                                                    .map(n => n.textContent);
        return iatiIdentifiers.length === 0 ? "" : iatiIdentifiers[0];
    }
    return domElementNode.parentNode === null ? "" : getIatiIdentifierOfContainingActivity(domElementNode.parentNode);
}

function getIatiActivityTitleOfContainingActivity(domElementNode) {
    if (domElementNode.nodeName === "iati-activity") {
        const activityTitles = xpath.select("title/narrative/text()", domElementNode);
        return activityTitles.length === 0 ? "" : activityTitles[0].textContent;
    }
    return domElementNode.parentNode === null ? "" : getIatiActivityTitleOfContainingActivity(domElementNode.parentNode);
}

// itemsMatchingAdvisory:
//   list of objects, each object of type:
//     { "advisoryTestName": N, 
//       "advisoryXPath": V, 
//       "fullAdvisoryDefinition": DICT_OF_DEF, 
//       "matchingElement", DOM_ELEMENT
//     }
async function checkIatiIdentifierCrossReferences(advisoryDefinitions, 
                                                  iatiDOM, 
                                                  itemsMatchingAdvisory, 
                                                  adjustLineCountForMissingXmlTag, 
                                                  showDetails) {
    // get list of matching items with iatiIdentifier added
    const itemsMatchingAdvisoryWithIdentifiers = extractIatiIdentifierToVerify(itemsMatchingAdvisory);

    // get list of IATI Identifiers in this file
    const iatiIdentifiersInCurrentDataset = getIdentifiersInCurrentDataset(iatiDOM);    

    // filter out where the attribute for activity ID is empty, b/c otherwise publishing
    // systems which automatically populate all possible attributes w/empty values will 
    // start getting lots of alerts
    const itemsMatchingAdvisoryNonEmpty = itemsMatchingAdvisoryWithIdentifiers.filter(item => item.matchedContent !== '');

    // filter out any items that reference IATI activities located in the current file
    const itemsMatchingNotInCurrentDataset = itemsMatchingAdvisoryNonEmpty.filter(item => !(iatiIdentifiersInCurrentDataset.includes(item.matchedContent)));

    // get the list of IATI Identifiers to check against IATI Datastore
    const iatiIdentifiersToCheck = getListIatiIdentifiersToCheck(itemsMatchingNotInCurrentDataset);

    // query Datastore
    const datastoreResults = await checkIfIatiIdentifiersInDatastore(iatiIdentifiersToCheck);

    // the items with IATI Identifier cross refs that weren't matched
    const itemsWithUnmatchedCrossRefs = itemsMatchingNotInCurrentDataset.filter(item => !Object.keys(datastoreResults.iati_identifiers_found).includes(item.matchedContent));

    const advisoryFailures = itemsWithUnmatchedCrossRefs.map((itemWithUnmatchedCrossRefs, index, array) => {
            const details = showDetails ? {"ruleName": itemWithUnmatchedCrossRefs.advisoryTestName} : {};
            return {
                "id": itemWithUnmatchedCrossRefs.fullAdvisoryDefinition.id,
                "category": itemWithUnmatchedCrossRefs.fullAdvisoryDefinition.category,
                "severity": itemWithUnmatchedCrossRefs.fullAdvisoryDefinition.severity,
                "message":  itemWithUnmatchedCrossRefs.fullAdvisoryDefinition.message,
                "identifier": getIatiIdentifierOfContainingActivity(itemWithUnmatchedCrossRefs.matchingElement) || 'noIdentifier',
                "title": getIatiActivityTitleOfContainingActivity(itemWithUnmatchedCrossRefs.matchingElement) || 'noTitle',
                "context": getFailureContextFromDOM(itemWithUnmatchedCrossRefs, adjustLineCountForMissingXmlTag),
                details
            };
        });

    return advisoryFailures;
}

function getElementsMatchingAdvisoryXPath(advisoryDefinitions, iatiDOM) {
    
    const elementsMatchingAdvisoryXPath = Object.values(advisoryDefinitions).map((advisoryDefinition) => {
        const matchingElements = select(advisoryDefinition.advisoryXPath, iatiDOM);
        return matchingElements.filter(match => {
                                    let hasTargetAttribute = false;
                                    for (let i = 0; i < match.attributes.length; i += 1) {
                                        hasTargetAttribute ||= match.attributes[i].name === advisoryDefinition.attributeToTest;
                                    } 
                                    return hasTargetAttribute;
                               })
                               .map(matchingElement => ({
                                    "advisoryTestName": advisoryDefinition.advisoryTestName, 
                                    "advisoryXPath": advisoryDefinition.advisoryXPath,
                                    "fullAdvisoryDefinition": advisoryDefinition,
                                    "matchingElement": matchingElement
                               }));
    }).flat();

    return elementsMatchingAdvisoryXPath;
}

export default async function validateAdvisories(iatiVersion, iatiXml, adjustLineCountForMissingXmlTag, showDetails = false) {
    const advisories = [];
    const advisoryDefinitions = getAdvisoryDefinitions(iatiVersion);
    const advisoryHandlers = {'iati_identifier_exists': checkIatiIdentifierCrossReferences};

    const iatiDOM = new DOMParser().parseFromString(iatiXml);

    const elementsMatchingAdvisoryXPath = getElementsMatchingAdvisoryXPath(advisoryDefinitions, iatiDOM);

    const elementsMatchingAdvisoryGrouped = elementsMatchingAdvisoryXPath.reduce((acc, item) => {
        (acc[item.advisoryTestName] = acc[item.advisoryTestName] || []).push(item);
        return acc;
    }, {});

    // eslint-disable-next-line no-restricted-syntax
    for (const advisoryTestName  of Object.keys(elementsMatchingAdvisoryGrouped)) {
        if (advisoryTestName in advisoryHandlers) {
            // eslint-disable-next-line no-await-in-loop
            advisories.push(...await advisoryHandlers[advisoryTestName](advisoryDefinitions, 
                                                                        iatiDOM, 
                                                                        elementsMatchingAdvisoryGrouped[advisoryTestName],
                                                                        adjustLineCountForMissingXmlTag,
                                                                        showDetails));
        } else {
            throw new Error("Unknown advisory type");
        }
    }

    return advisories;
};
