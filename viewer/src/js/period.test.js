import { Period } from "./period.js";

describe("Duration vs instant", () => {
    test("Durations", () => {
        var d = new Period("2018-01-01/2019-01-01"); 
        expect(d.from()).toEqual(new Date("2018-01-01"));
        expect(d.to()).toEqual(new Date("2019-01-01"));
        expect(d.toString()).toEqual("1 Jan 2018 to 31 Dec 2018");
    });
    test("Instant without time", () => {
        var i = new Period("2019-01-01"); 
        expect(i.from()).toBeNull();
        expect(i.to()).toEqual(new Date("2019-01-01"));
        expect(i.toString()).toEqual("31 Dec 2018");
    });

    test("Instant with time", () => {
        var i = new Period("2019-01-01T06:00:00"); 
        expect(i.from()).toBeNull();
        expect(i.to()).toEqual(new Date("2019-01-01T06:00:00"));
        expect(i.toString()).toEqual("1 Jan 2019 06:00:00");
    });
});

describe("Equivalent durations", () => {
    test("Instant vs duration", () => {
        var i = new Period("2019-01-01"); 
        var d = new Period("2018-01-01/2019-01-01"); 
        expect(i.isEquivalentDuration(d)).toBeFalsy();
        expect(d.isEquivalentDuration(i)).toBeFalsy();
    });

    test("Two instants", () => {
        var i1 = new Period("2019-01-01"); 
        var i2 = new Period("2018-01-01"); 
        expect(i1.isEquivalentDuration(i2)).toBeTruthy();
    });

    test("Exact same duration", () => {
        var d1 = new Period("2018-01-01/2019-01-01"); 
        var d2 = new Period("2018-01-01/2019-01-01"); 
        expect(d1.isEquivalentDuration(d2)).toBeTruthy();
    });

    test("Two years, one leap", () => {
        var d1 = new Period("2016-01-01/2017-01-01"); 
        var d2 = new Period("2017-01-01/2018-01-01"); 
        expect(d1.isEquivalentDuration(d2)).toBeTruthy();
    });

    test("Two months", () => {
        // We allow 20% variance, so this is OK.
        var d1 = new Period("2017-01-01/2017-02-01"); 
        var d2 = new Period("2017-02-01/2017-03-01"); 
        expect(d1.isEquivalentDuration(d2)).toBeTruthy();
    });

    test("One month vs two months", () => {
        // We allow 20% variance, so this is OK.
        var d1 = new Period("2017-01-01/2017-02-01"); 
        var d2 = new Period("2017-02-01/2017-04-01"); 
        expect(d1.isEquivalentDuration(d2)).toBeFalsy();
    });

});
