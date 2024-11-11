// See COPYRIGHT.md for copyright information

export class TaxonomyNamer {
    constructor(map) {
        this.map = new Map(Array.from(map.entries()).map(([k,v]) => [new RegExp(k), new TaxonomyName(v[0], v[1])]));
    }


    getName(prefix, uri) {
        for (const [re, name] of this.map.entries()) {
            const m = uri.match(re);
            if (m !== null)  {
                return name;
            }
        }
        return new TaxonomyName(prefix, prefix);
    }

    fromQName(qname) {
        return this.getName(qname.prefix, qname.namespace);
    }

    convertQName(qname) {
        const name = this.fromQName(qname)
        return name.prefix + ':' + qname.localname;
    }
}

export class TaxonomyName {
    constructor(prefix, name) {
        this.prefix = prefix;
        this.name = name;
    }
}
