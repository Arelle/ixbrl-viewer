// See COPYRIGHT.md for copyright information

import { Identifiers } from './identifiers.js';
import { QName } from './qname.js';

const prefixMap = {
    "e": "http://example.com",
    "cik": "http://www.sec.gov/CIK",
    "crn": "http://www.companieshouse.gov.uk/",
    "ua": "https://www.minfin.gov.ua",
};

function qname(s) {
    return new QName(prefixMap, s);
}

describe("readableName", () => {
    test("Unknown scheme", () => {
        expect(Identifiers.readableName(qname("e:1234"))).toBe("e:1234");
    });
    test("Known scheme", () => {
        expect(Identifiers.readableName(qname("cik:1234"))).toBe("[CIK] 1234");
        expect(Identifiers.readableName(qname("ua:01234"))).toBe("[EDRPOU] 01234");
    });
});

describe("readableNameHTML", () => {
    test("Unknown scheme", () => {
        const html = Identifiers.readableNameHTML(qname("e:1234"));
        expect(html.textContent).toBe("e:1234");
    });
    test("Known scheme with URL", () => {
        const html = Identifiers.readableNameHTML(qname("cik:1234"));
        expect(html.childNodes.length).toBe(2);
        expect(html.childNodes[0].textContent).toBe("[CIK] ");
        expect(html.childNodes[1].nodeName).toBe("A");
        expect(html.childNodes[1].getAttribute("href")).toBe("https://www.sec.gov/cgi-bin/browse-edgar?CIK=1234");
    });
    test("Known scheme with URL, padded identifier", () => {
        const html = Identifiers.readableNameHTML(qname("crn:1234"));
        expect(html.childNodes.length).toBe(2);
        expect(html.childNodes[0].textContent).toBe("[UK CRN] ");
        expect(html.childNodes[1].nodeName).toBe("A");
        expect(html.childNodes[1].getAttribute("href")).toBe("https://beta.companieshouse.gov.uk/company/00001234");
    });
    test("Known scheme without URL", () => {
        const html = Identifiers.readableNameHTML(qname("ua:1234"));
        expect(html.childNodes.length).toBe(2);
        expect(html.childNodes[0].textContent).toBe("[EDRPOU] ");
        expect(html.childNodes[1].nodeName).toBe("SPAN");
        expect(html.childNodes[1].textContent).toBe("1234");
    });
});
