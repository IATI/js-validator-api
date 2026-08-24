/* eslint-disable no-bitwise */
import { XmlDocument, ParseOption } from 'libxml2-wasm';

/*
 * libxml2-wasm throws whenever the parser recorded any error, even when it still built
 * a usable document. libxmljs2 threw only when no document resulted, so problems that
 * are not fatal to building a tree - an undeclared namespace prefix, for instance -
 * used to parse through and be reported later as schema errors instead.
 *
 * Suppressing error collection restores that: with nothing collected, the throw depends
 * on whether a document was produced, which is the libxmljs2 rule. Verified to agree
 * with libxmljs2 on every integration fixture.
 *
 * The cost is that the resulting XmlParseError carries no message, line or column, and
 * the 0.1.1 and 0.3.1 reports need those. So a failed parse is repeated with collection
 * enabled purely to obtain the diagnostic. That second parse only happens for input that
 * is genuinely unparseable, which the request is about to be rejected for anyway.
 *
 */
const QUIET = ParseOption.XML_PARSE_NOERROR | ParseOption.XML_PARSE_NOWARNING;

const parseTolerantly = (parse, source, option) => {
    try {
        return parse(source, { option: option | QUIET });
    } catch {
        return parse(source, { option });
    }
};

export const parseXmlBuffer = (buffer, option = ParseOption.XML_PARSE_DEFAULT) =>
    parseTolerantly((source, options) => XmlDocument.fromBuffer(source, options), buffer, option);

export const parseXmlString = (string, option = ParseOption.XML_PARSE_DEFAULT) =>
    parseTolerantly((source, options) => XmlDocument.fromString(source, options), string, option);
