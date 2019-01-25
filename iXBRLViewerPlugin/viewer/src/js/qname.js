

export function QName(prefixMap, qname) {
    var a = qname.split(":", 2);
    this.localname = a[1];
    this.prefix = a[0];
    this.namespace = prefixMap[a[0]]; 
    this.qname = qname;
}

