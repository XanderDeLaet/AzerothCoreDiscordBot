"use strict";
exports.__esModule = true;
exports.parseMTOMResp = exports.xmlEscape = exports.splitQName = exports.findPrefix = exports.TNS_PREFIX = exports.passwordDigest = void 0;
var crypto = require("crypto");
var multipart_parser_js_1 = require("formidable/lib/multipart_parser.js");
function passwordDigest(nonce, created, password) {
    // digest = base64 ( sha1 ( nonce + created + password ) )
    var pwHash = crypto.createHash('sha1');
    var NonceBytes = Buffer.from(nonce || '', 'base64');
    var CreatedBytes = Buffer.from(created || '', 'utf8');
    var PasswordBytes = Buffer.from(password || '', 'utf8');
    var FullBytes = Buffer.concat([NonceBytes, CreatedBytes, PasswordBytes]);
    pwHash.update(FullBytes);
    return pwHash.digest('base64');
}
exports.passwordDigest = passwordDigest;
exports.TNS_PREFIX = '__tns__'; // Prefix for targetNamespace
/**
 * Find a key from an object based on the value
 * @param {Object} Namespace prefix/uri mapping
 * @param {*} nsURI value
 * @returns {String} The matching key
 */
function findPrefix(xmlnsMapping, nsURI) {
    for (var n in xmlnsMapping) {
        if (n === exports.TNS_PREFIX) {
            continue;
        }
        if (xmlnsMapping[n] === nsURI) {
            return n;
        }
    }
}
exports.findPrefix = findPrefix;
function splitQName(nsName) {
    if (typeof nsName !== 'string') {
        return {
            prefix: exports.TNS_PREFIX,
            name: nsName
        };
    }
    var topLevelName = nsName.split('|')[0];
    var prefixOffset = topLevelName.indexOf(':');
    return {
        prefix: topLevelName.substring(0, prefixOffset) || exports.TNS_PREFIX,
        name: topLevelName.substring(prefixOffset + 1)
    };
}
exports.splitQName = splitQName;
function xmlEscape(obj) {
    if (typeof (obj) === 'string') {
        if (obj.substr(0, 9) === '<![CDATA[' && obj.substr(-3) === ']]>') {
            return obj;
        }
        return obj
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    return obj;
}
exports.xmlEscape = xmlEscape;
function parseMTOMResp(payload, boundary) {
    var resp = {
        parts: []
    };
    var headerName = '';
    var headerValue = '';
    var data;
    var partIndex = 0;
    var parser = new multipart_parser_js_1.MultipartParser();
    parser.initWithBoundary(boundary);
    parser.onPartBegin = function () {
        resp.parts[partIndex] = {
            body: null,
            headers: {}
        };
        data = Buffer.from('');
    };
    parser.onHeaderField = function (b, start, end) {
        headerName = b.slice(start, end).toString();
    };
    parser.onHeaderValue = function (b, start, end) {
        headerValue = b.slice(start, end).toString();
    };
    parser.onHeaderEnd = function () {
        resp.parts[partIndex].headers[headerName.toLowerCase()] = headerValue;
    };
    parser.onHeadersEnd = function () { };
    parser.onPartData = function (b, start, end) {
        data = Buffer.concat([data, b.slice(start, end)]);
    };
    parser.onPartEnd = function () {
        resp.parts[partIndex].body = data;
        partIndex++;
    };
    parser.onEnd = function () { };
    parser.write(payload);
    return resp;
}
exports.parseMTOMResp = parseMTOMResp;
//# sourceMappingURL=utils.js.map