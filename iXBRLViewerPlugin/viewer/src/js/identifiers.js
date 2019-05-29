// Copyright 2019 Workiva Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var schemes = {
    "http://standards.iso.org/iso/17442": { "name": "LEI", "url": "https://search.gleif.org/#/record/%s" },
    "http://www.sec.gov/CIK": { "name": "CIK", "url": "https://www.sec.gov/cgi-bin/browse-edgar?CIK=%s"},
    "http://www.companieshouse.gov.uk/": { "name": "UK CRN", "url": "https://beta.companieshouse.gov.uk/company/%08d"},
};

export function Identifiers() {
}

Identifiers.identifierURLForFact = function(fact) {
    var data = schemes[fact.identifier().namespace];
    if (data !== undefined) {
        var url = data.url.replace('%s', fact.identifier().localname);
        url = url.replace(/%0(\d+)d/, function (match, width) { 
            return fact.identifier().localname.padStart(width, "0");
        });
        return url;
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
