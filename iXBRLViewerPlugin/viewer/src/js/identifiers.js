// See COPYRIGHT.md for copyright information

const schemes = {
    "http://standards.iso.org/iso/17442": { "name": "LEI", "url": "https://search.gleif.org/#/record/%s" },
    "http://www.sec.gov/CIK": { "name": "CIK", "url": "https://www.sec.gov/cgi-bin/browse-edgar?CIK=%s"},
    "http://www.companieshouse.gov.uk/": { "name": "UK CRN", "url": "https://beta.companieshouse.gov.uk/company/%08d"},
    "https://www.minfin.gov.ua": { "name": "EDRPOU" },
};

export class Identifiers {
    static identifierURL(identifier) {
        const data = schemes[identifier.namespace];
        if (data !== undefined && data.url !== undefined) {
            let url = data.url.replace('%s', identifier.localname);
            url = url.replace(/%0(\d+)d/, (match, width) => identifier.localname.padStart(width, "0"));
            return url;
        }
        return undefined;
    }

    static identifierNameForFact(fact) {
        const data = schemes[fact.identifier().namespace];
        if (data !== undefined) {
            return data.name;
        }
        return undefined;
    }

    static readableName(identifier) {
        const data = schemes[identifier.namespace];
        if (data !== undefined) {
            return "[" + data.name + "] " + identifier.localname;
        }
        return identifier.qname
    }

    static readableNameHTML(identifier) {
        const data = schemes[identifier.namespace];
        const span = document.createElement("span");
        if (data !== undefined) {
            const schemeSpan = span.appendChild(document.createElement("span"));
            schemeSpan.textContent = "[" + data.name + "] ";
            const url = Identifiers.identifierURL(identifier);
            if (url !== undefined) {
                const a = span.appendChild(document.createElement("a"));
                a.textContent = identifier.localname;
                a.setAttribute("target", "_blank");
                a.setAttribute("href", url);
            }
            else {
                const el = span.appendChild(document.createElement("span"));
                el.textContent = identifier.localname;
            }
        }
        else {
            span.textContent = identifier.qname;
        }
        return span;
    }
}
