// See COPYRIGHT.md for copyright information

import moment from 'moment';
import { Period } from "./period.js";
import "./moment-jest.js";

describe("Types", () => {
    test("Undefined", () => {
        var d = new Period(undefined);
        expect(d.type()).toBeUndefined();
        expect(d.from()).toBeNull();
        expect(d.to()).toBeNull();
        expect(d.toString()).toEqual("Undefined");
    });
    test("Forever", () => {
        var f = new Period('f');
        expect(f.type()).toEqual('f');
        expect(f.from()).toBeNull();
        expect(f.to()).toBeNull();
        expect(f.toString()).toEqual("None");
    });
    test("Durations", () => {
        var d = new Period("2018-01-01/2019-01-01"); 
        expect(d.type()).toEqual('d');
        expect(d.from()).toEqualDate(moment.utc("2018-01-01"));
        expect(d.to()).toEqualDate(moment.utc("2019-01-01"));
        expect(d.toString()).toEqual("1 Jan 2018 to 31 Dec 2018");
    });
    test("Instant without time", () => {
        var i = new Period("2019-01-01"); 
        expect(i.type()).toEqual('i');
        expect(i.from()).toBeNull();
        expect(i.to()).toEqualDate(moment.utc("2019-01-01"));
        expect(i.toString()).toEqual("31 Dec 2018");
    });

    test("Instant with time", () => {
        var i = new Period("2019-01-01T06:00:00"); 
        expect(i.type()).toEqual('i');
        expect(i.from()).toBeNull();
        expect(i.to()).toEqualDate(moment.utc("2019-01-01T06:00:00"));
        expect(i.toString()).toEqual("1 Jan 2019 06:00:00");
    });
});

describe("Period.toString", () => {
    test("Instant with no time part", () => {
        var d = new Period("2018-06-02");
        expect(d.toString()).toEqual("1 Jun 2018");
    });
    test("Instant with explicit zero time part", () => {
        var d = new Period("2018-06-02T00:00:00");
        expect(d.toString()).toEqual("1 Jun 2018");
    });
    test("Instant with non-zero time part", () => {
        var d = new Period("2018-06-01T03:00:00");
        expect(d.toString()).toEqual("1 Jun 2018 03:00:00");
    });
    test("Duration with no time part", () => {
        var d = new Period("2017-06-02/2018-06-02");
        expect(d.toString()).toEqual("2 Jun 2017 to 1 Jun 2018");
    });
    test("Instant with explicit zero time part", () => {
        var d = new Period("2017-06-02T00:00:00/2018-06-02T00:00:00");
        expect(d.toString()).toEqual("2 Jun 2017 to 1 Jun 2018");
    });
    test("Instant with non-zero time part", () => {
        var d = new Period("2017-06-02T07:00:00/2018-06-01T03:00:00");
        expect(d.toString()).toEqual("2 Jun 2017 07:00:00 to 1 Jun 2018 03:00:00");
    });
});

describe("Equivalent durations", () => {
    test("Undefined vs undefined", () => {
        var u1 = new Period(undefined);
        var u2 = new Period(undefined);
        expect(u1.isEquivalentDuration(u2)).toBeFalsy();
    });

    test("Undefined vs forever", () => {
        var u = new Period(undefined);
        var f = new Period('f');
        expect(u.isEquivalentDuration(f)).toBeFalsy();
    });

    test("Undefined vs instant", () => {
        var u = new Period(undefined);
        var i = new Period('2018-01-01');
        expect(u.isEquivalentDuration(i)).toBeFalsy();
    });

    test("Undefined vs duration", () => {
        var u = new Period(undefined);
        var i = new Period('2018-01-01');
        expect(u.isEquivalentDuration(i)).toBeFalsy();
    });

    test("Forever vs forever", () => {
        var f1 = new Period('f');
        var f2 = new Period('f');
        expect(f1.isEquivalentDuration(f2)).toBeTruthy();
    });

    test("Forever vs instant", () => {
        var f = new Period(undefined);
        var i = new Period("2019-01-01");
        expect(f.isEquivalentDuration(i)).toBeFalsy();
    });

    test("Forever vs duration", () => {
        var f = new Period(undefined);
        var d = new Period("2018-01-01/2019-01-01");
        expect(f.isEquivalentDuration(d)).toBeFalsy();
    });

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
