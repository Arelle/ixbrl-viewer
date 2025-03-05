// See COPYRIGHT.md for copyright information

// Class to expose properties of Unit Type Registry entries from viewer data

export class UTREntry {
    
    constructor(symbol, name) {
        this.symbol = symbol;
        this.name = name;
    }
}

class UTR {
    constructor() {
        self.entries = require("../data/utr.json");
    }

    get(qname) {
        const u = self.entries[qname.namespace]?.[qname.localname]
        if (u === undefined) {
            return undefined;
        }
        return new UTREntry(u.s, u.n)
    }
}

export const utr = new UTR();
