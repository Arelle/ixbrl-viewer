// See COPYRIGHT.md for copyright information

export class QName {
    constructor(prefixMap, qname) {
        const a = qname.split(":", 2);
        this.localname = a[1];
        this.prefix = a[0];
        this.namespace = prefixMap[a[0]]; 
        this.qname = qname;
    }
}

