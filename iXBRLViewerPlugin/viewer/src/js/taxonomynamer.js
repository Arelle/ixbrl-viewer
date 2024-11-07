// See COPYRIGHT.md for copyright information

export class TaxonomyNamer {
    constructor(map) {
        this.map = new Map(Array.from(map.entries()).map(([k,v]) => [new RegExp(k), new TaxonomyName(v[0], v[1])]));
    }

    getName(qname) {
        for (const [re, name] of this.map.entries()) {
            const m = qname.namespace.match(re);
            if (m !== null)  {
                return name;
            }
        }
        return new TaxonomyName(qname.prefix, qname.prefix);
    }
}

export class TaxonomyName {
    constructor(prefix, name) {
        this.prefix = prefix;
        this.name = name;
    }
}
