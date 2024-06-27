// See COPYRIGHT.md for copyright information

// Class to expose properties of Unit Type Registry entries from viewer data

export class UTREntry {
    
    constructor(data) {
        this.symbol = data.s;
        this.name = data.n;
    }
}
