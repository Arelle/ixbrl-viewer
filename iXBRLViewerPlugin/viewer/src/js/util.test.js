// See COPYRIGHT.md for copyright information

import { xbrlDateToMoment, momentToHuman, formatNumber, wrapLabel, escapeRegex, truncateLabel } from "./util.js"
import moment from 'moment';
import "./moment-jest.js";

describe("xbrlDateToMoment", () => {
    test("Untimezoned dates should be treated as UTC", () => {
        expect(xbrlDateToMoment("2010-06-01")).toEqualDate(moment.utc("2010-06-01"));
    });
    test("Timezoned dates should be supported", () => {
        expect(xbrlDateToMoment("2010-06-01Z")).toEqualDate(moment.utc("2010-06-01"));
        expect(xbrlDateToMoment("2010-06-01+00:00")).toEqualDate(moment.utc("2010-06-01"));
        expect(xbrlDateToMoment("2010-06-01+00")).toEqualDate(moment.utc("2010-06-01"));
    });

    test("Timezoned dates are not treated as UTC", () => {
        expect(xbrlDateToMoment("2010-06-01+01")).not.toEqualDate(moment.utc("2010-06-01"));
    });

    test("Date with zero time component and no TZ is equal to date in UTC", () => {
        expect(xbrlDateToMoment("2010-06-01T00:00:00")).toEqualDate(moment.utc("2010-06-01"));
    });

    test("Datetime with zero time component and explicit TZ is equal to date in UTC", () => {
        expect(xbrlDateToMoment("2010-06-01T00:00:00Z")).toEqualDate(moment.utc("2010-06-01"));
    });

    test("Datetime with non-zero time component is not equal to date in UTC", () => {
        expect(xbrlDateToMoment("2010-06-01T02:00:00")).not.toEqualDate(moment.utc("2010-06-01"));
        expect(xbrlDateToMoment("2010-06-01T02:00:00Z")).not.toEqualDate(moment.utc("2010-06-01"));
    });

    test("Datetime with time that cancels TZ is equal to date", () => {
        expect(xbrlDateToMoment("2010-06-01T02:00:00+02")).toEqualDate(moment.utc("2010-06-01"));
    });
});

describe("momentToHuman", () => {
    test("Simple date with no time (from string)", () => {
        expect(momentToHuman(moment.utc("2018-06-01"))).toBe("1 Jun 2018")
    });

    test("Simple date with non-GMT timezone but no time (from string)", () => {
        /* I'm not sure that this is what we actually want, but I don't think
         * timezones other than "Z" and "unspecified" are actually in use */
        expect(momentToHuman(moment.utc("2018-06-01T00:00:00+03:00"))).toBe("31 May 2018 21:00:00")
    });

    test("Simple date with time from string", () => {
        expect(momentToHuman(moment.utc("2018-01-01T07:08:00"))).toBe("1 Jan 2018 07:08:00")
    });

    test("Simple date with time from string with timezone", () => {
        expect(momentToHuman(moment.utc("2018-01-01T07:08:00Z"))).toBe("1 Jan 2018 07:08:00")
    });

    test("Adjusted date should give previous day", () => {
        expect(momentToHuman(moment.utc("2018-01-01"),true)).toBe("31 Dec 2017")
    });

    test("Adjust does not have any effect if there's a time componetn", () => {
        expect(momentToHuman(moment.utc("2018-01-01T09:08:07"),true)).toBe("1 Jan 2018 09:08:07")
    });
});

describe("formatNumber", () => {
    test("Format number, no decimals", () => {
        expect(formatNumber(37123456,0)).toBe("37,123,456")
    });

    test("Format number, with rounding", () => {
        expect(formatNumber(37123456.78,0)).toBe("37,123,457")
    });

    test("Format number, add some decimals", () => {
        expect(formatNumber(123456,2)).toBe("123,456.00")
    });

    test("Format negative number number, add some decimals", () => {
        expect(formatNumber(-123456,3)).toBe("-123,456.000")
    });

    test("Format number, add some decimals", () => {
        expect(formatNumber(12345678,4)).toBe("12,345,678.0000")
    });

    test("Format decimal with large number of digits", () => {
        expect(formatNumber("10000000000.00000003", undefined)).toBe("10,000,000,000.00000003")
    });

    test("Format decimal with large number of digits", () => {
        expect(formatNumber("10000000000.000000030", undefined)).toBe("10,000,000,000.00000003")
    });

    test("Format decimal with large number of digits", () => {
        expect(formatNumber("10000000000.000000030", 10)).toBe("10,000,000,000.0000000300")
    });
});

describe("wrapLabel", () => {
    test("wrap label at width 10", () => {
        expect(wrapLabel("The cat sat on the mat.  My hovercraft is full of eels.", 10)).toEqual([
            "The cat",
            "sat on the",
            "mat.  My",
            "hovercraft",
            "is full of",
            "eels."
        ])
    });
    test("Words that exceed line length", () => {
        expect(wrapLabel("A verylongword is ok.", 10)).toEqual([
            "A",
            "verylongword",
            "is ok."
        ])
    });

    test("Leading and trailing space", () => {
        expect(wrapLabel(" leading and trailing space ", 10)).toEqual([
            "leading",
            "and",
            "trailing",
            "space "
        ])
    });
});

describe("truncateLabel", () => {
    test("Truncate at width 10", () => {
        expect(truncateLabel("The cat sat on the mat.  My hovercraft is full of eels.", 10)).toEqual(
            "The cat \u2026"
        );
        expect(truncateLabel("The cat", 10)).toEqual(
            "The cat"
        )
    });
});


describe("Regex escape", () => {
    test("Regex escape", () => {
        expect(escapeRegex("a.b*{}")).toBe("a\\.b\\*\\{\\}")
    });
});
