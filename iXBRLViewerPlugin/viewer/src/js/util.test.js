// See COPYRIGHT.md for copyright information

import { xbrlDateToMoment, momentToHuman, formatNumber, wrapLabel, escapeRegex, truncateLabel, getIXHiddenLinkStyle, runGenerator } from "./util.js"
import { MessageChannel as NodeMessageChannel } from 'worker_threads';

describe("runGenerator", () => {
    // jsdom has no MessageChannel, so use the Node implementation.
    const savedMessageChannel = global.MessageChannel;
    let channels;

    beforeEach(() => {
        channels = [];
        global.MessageChannel = jest.fn(() => {
            const channel = new NodeMessageChannel();
            jest.spyOn(channel.port1, "close");
            jest.spyOn(channel.port2, "close");
            channels.push(channel);
            return channel;
        });
    });

    afterEach(() => {
        // Open ports keep the Node event loop alive.
        channels.forEach(c => { c.port1.close(); c.port2.close(); });
        global.MessageChannel = savedMessageChannel;
    });

    function* slices(log, name, count, done) {
        for (let i = 0; i < count; i++) {
            log.push(name + i);
            yield;
        }
        done();
    }

    function drainTasks() {
        return new Promise(resolve => setTimeout(() => setTimeout(resolve, 0), 0));
    }

    test("Calls onDone after the generator finishes", async () => {
        let resolveRun;
        const run = new Promise(resolve => { resolveRun = resolve; });
        const onDone = jest.fn();
        onDone.mockImplementation(resolveRun);

        runGenerator(slices([], "a", 1, () => {}), onDone);

        expect(onDone).not.toHaveBeenCalled();
        await run;
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    test("Runs every slice, in order", async () => {
        const log = [];
        await new Promise(resolve => runGenerator(slices(log, "a", 4, resolve)));
        expect(log).toEqual(["a0", "a1", "a2", "a3"]);
    });

    test("No slice runs synchronously", async () => {
        const log = [];
        const run = new Promise(resolve => runGenerator(slices(log, "a", 2, resolve)));
        expect(log).toEqual([]);
        await run;
        expect(log).toEqual(["a0", "a1"]);
    });

    test("Two generators in flight at once both complete, on channels of their own", async () => {
        const log = [];
        await Promise.all([
            new Promise(resolve => runGenerator(slices(log, "a", 3, resolve))),
            new Promise(resolve => runGenerator(slices(log, "b", 3, resolve))),
        ]);
        expect(log.filter(s => s.startsWith("a"))).toEqual(["a0", "a1", "a2"]);
        expect(log.filter(s => s.startsWith("b"))).toEqual(["b0", "b1", "b2"]);
        expect(global.MessageChannel).toHaveBeenCalledTimes(2);
        expect(channels[0]).not.toBe(channels[1]);
    });

    test("A generator with no slices terminates without asking for another", async () => {
        const next = jest.fn(() => ({ done: true, value: undefined }));
        runGenerator({ next });
        await drainTasks();
        expect(next).toHaveBeenCalledTimes(1);
        expect(channels[0].port1.close).toHaveBeenCalledTimes(1);
        expect(channels[0].port2.close).toHaveBeenCalledTimes(1);
    });
});

describe("xbrlDateToMoment", () => {
    test("Untimezoned dates should be treated as UTC", () => {
        expect(xbrlDateToMoment("2010-06-01")).toEqual(new Date("2010-06-01"));
    });
    test("Timezoned dates should be supported", () => {
        expect(xbrlDateToMoment("2010-06-01Z")).toEqual(new Date("2010-06-01"));
        expect(xbrlDateToMoment("2010-06-01+00:00")).toEqual(new Date("2010-06-01"));
        expect(xbrlDateToMoment("2010-06-01+00")).toEqual(new Date("2010-06-01"));
    });

    test("Timezoned dates are not treated as UTC", () => {
        expect(xbrlDateToMoment("2010-06-01+01")).toEqual(new Date("2010-05-31T23:00:00Z"));
    });

    test("Date with zero time component and no TZ is equal to date in UTC", () => {
        expect(xbrlDateToMoment("2010-06-01T00:00:00")).toEqual(new Date("2010-06-01"));
    });

    test("Datetime with zero time component and explicit TZ is equal to date in UTC", () => {
        expect(xbrlDateToMoment("2010-06-01T00:00:00Z")).toEqual(new Date("2010-06-01"));
    });

    test("Datetime with non-zero time component keeps its time in UTC", () => {
        expect(xbrlDateToMoment("2010-06-01T02:00:00")).toEqual(new Date("2010-06-01T02:00:00Z"));
        expect(xbrlDateToMoment("2010-06-01T02:00:00Z")).toEqual(new Date("2010-06-01T02:00:00Z"));
    });

    test("Datetime with time that cancels TZ is equal to date", () => {
        expect(xbrlDateToMoment("2010-06-01T02:00:00+02")).toEqual(new Date("2010-06-01"));
    });

    test("Offsets with minutes are supported, with or without a colon", () => {
        expect(xbrlDateToMoment("2018-06-01T02:00:00+05:30")).toEqual(new Date("2018-05-31T20:30:00Z"));
        expect(xbrlDateToMoment("2018-06-01T02:00:00-0800")).toEqual(new Date("2018-06-01T10:00:00Z"));
    });

    test("End of day time rolls over to the next day", () => {
        expect(xbrlDateToMoment("2018-12-31T24:00:00")).toEqual(new Date("2019-01-01"));
    });

    test("Fractional seconds and times without seconds are supported", () => {
        expect(xbrlDateToMoment("2018-06-01T12:30:00.5Z")).toEqual(new Date("2018-06-01T12:30:00.500Z"));
        expect(xbrlDateToMoment("2018-06-01T02:00")).toEqual(new Date("2018-06-01T02:00:00Z"));
    });

    test("Years before 100 are not treated as 20th century years", () => {
        expect(xbrlDateToMoment("0099-01-01").getUTCFullYear()).toBe(99);
    });

    test("Malformed or out of range dates are invalid", () => {
        for (const s of ["garbage", "2021-02-29", "2018-13-01", "2018-06-00", "2018-06-01T24:30:00", "2018-06-01T12:60:00"]) {
            expect(Number.isNaN(xbrlDateToMoment(s).getTime())).toBe(true);
        }
    });
});

describe("momentToHuman", () => {
    test("Simple date with no time (from string)", () => {
        expect(momentToHuman(new Date("2018-06-01"))).toBe("1 Jun 2018")
    });

    test("Simple date with non-GMT timezone but no time (from string)", () => {
        /* I'm not sure that this is what we actually want, but I don't think
         * timezones other than "Z" and "unspecified" are actually in use */
        expect(momentToHuman(new Date("2018-06-01T00:00:00+03:00"))).toBe("31 May 2018 21:00:00")
    });

    test("Simple date with time from string", () => {
        expect(momentToHuman(xbrlDateToMoment("2018-01-01T07:08:00"))).toBe("1 Jan 2018 07:08:00")
    });

    test("Simple date with time from string with timezone", () => {
        expect(momentToHuman(new Date("2018-01-01T07:08:00Z"))).toBe("1 Jan 2018 07:08:00")
    });

    test("Adjusted date should give previous day", () => {
        expect(momentToHuman(new Date("2018-01-01"),true)).toBe("31 Dec 2017")
    });

    test("Adjust does not have any effect if there's a time componetn", () => {
        expect(momentToHuman(new Date("2018-01-01T09:08:07Z"),true)).toBe("1 Jan 2018 09:08:07")
    });

    test("Invalid dates", () => {
        expect(momentToHuman(new Date(NaN))).toBe("Invalid date")
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

describe("Get IX Hidden Link Style", () => {
    it.each([
        ["-ix-hidden:123", "123"],
        ["-sec-ix-hidden:123", "123"],
        ["-esef-ix-hidden:123", "123"],
        ["-xxx-ix-hidden:123", null],
        ["-sec-ix-hidden: 123", "123"],
        ["-sec-ix-hidden:123 ", "123"],
        ["-sec-ix-hidden:123;", "123"],
        ["-sec-ix-hidden:123 abc", "123"],
        ["xxx-sec-ix-hidden:123", null],
        ["xxx;-sec-ix-hidden:123", "123"],
        [" -sec-ix-hidden:123", "123"],
        [";-sec-ix-hidden:123", "123"],
        ["-sec-ix-Hidden:123", null],
        ["-sec-ix-hidden:123;-sec-ix-hidden:abc", "123"],
        ["", null],
        [null, null],
    ])("Style value %p returns %p", (style, result) => {
        const domNode = document.createElement('div');
        domNode.setAttribute("style", style);
        const id = getIXHiddenLinkStyle(domNode);
        expect(id).toEqual(result);
    });

    test("No style attribute returns null", () => {
        const domNode = document.createElement('div');
        const id = getIXHiddenLinkStyle(domNode);
        expect(id).toEqual(null);
    })
});
