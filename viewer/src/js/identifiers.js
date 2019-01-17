
var schemes = {
    "http://standards.iso.org/iso/17442": { "name": "LEI", "url": "https://www.gleif.org/lei/%s" },
    "http://www.sec.gov/CIK": { "name": "CIK", "url": "https://www.sec.gov/cgi-bin/browse-edgar?CIK=%s"},

};

export function Identifiers() {
}

Identifiers.identifierURLForFact = function(fact) {
    var data = schemes[fact.identifier().namespace];
    if (data !== undefined) {
        return data.url.replace('%s', fact.identifier().localname);
    }
    return undefined;
}

Identifiers.identifierNameForFact = function(fact) {
    var data = schemes[fact.identifier().namespace];
    if (data !== undefined) {
        return data.name;
    }
    return undefined;
}

Identifiers.readableName = function (identifier) {
    var data = schemes[identifier.namespace];
    if (data !== undefined) {
        return "[" + data.name + "] " + identifier.localname;
    }
    return identifier.qname
}
