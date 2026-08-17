// See COPYRIGHT.md for copyright information

import { BindSession, BIND_STATE } from "./bindSession.js";
import { TaggingJournal, VERDICT } from "./journal.js";

/* A surface stand-in: records the calls the session makes, and lets a test
 * push candidates as if the cursor had moved. */
function fakeSurface() {
    const calls = [];
    return {
        calls,
        session: null,
        beginBind(session) { calls.push("beginBind"); this.session = session; },
        endBind() { calls.push("endBind"); },
        widen(from) {
            calls.push("widen");
            return from.widenTo ?? null;
        },
    };
}

const candidate = (text, over = {}) => ({
    locatorType: "xbrl:pdfContentLocatorType",
    properties: [{ property: "xbrl:pdfPage", value: "292" },
                 { property: "xbrl:pdfMcid", value: "418" }],
    text,
    ...over,
});

function newSession(over = {}) {
    const surface = fakeSurface();
    const journal = new TaggingJournal({ document: "lor.pdf" });
    const session = new BindSession({
        fact: { id: "f-1", value: "84.5", dataType: "xs:decimal" },
        surface, journal, ...over,
    });
    return { session, surface, journal };
}

describe("lifecycle", () => {
    test("begin puts the surface into bind mode", () => {
        const { session, surface } = newSession();
        expect(session.state).toBe(BIND_STATE.IDLE);
        session.begin();
        expect(session.state).toBe(BIND_STATE.HOVERING);
        expect(surface.calls).toEqual(["beginBind"]);
    });

    test("begin is idempotent, so a double click on the button cannot double-bind", () => {
        const { session, surface } = newSession();
        session.begin();
        session.begin();
        expect(surface.calls).toEqual(["beginBind"]);
    });

    test("cancel leaves bind mode and tells the surface to clean up", () => {
        const { session, surface, journal } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        session.cancel();
        expect(session.state).toBe(BIND_STATE.IDLE);
        expect(session.current).toBeNull();
        expect(surface.calls).toEqual(["beginBind", "endBind"]);
        expect(journal.length).toBe(0);
    });

    test("ending twice does not call the surface twice", () => {
        const { session, surface } = newSession();
        session.begin();
        session.end();
        session.end();
        expect(surface.calls.filter(c => c === "endBind")).toHaveLength(1);
    });
});

describe("hovering", () => {
    test("a candidate carries its verdict", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        expect(session.state).toBe(BIND_STATE.CANDIDATE);
        expect(session.current.verdict).toBe(VERDICT.AGREE);
    });

    test("moving off content clears the candidate", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        session.candidate(null);
        expect(session.current).toBeNull();
        expect(session.state).toBe(BIND_STATE.HOVERING);
    });

    test("candidates are ignored before bind mode starts", () => {
        const { session } = newSession();
        session.candidate(candidate("84,5"));
        expect(session.current).toBeNull();
    });

    test("a coarse capture is reported as such", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("Provisions pour risques 84,5 76,8"));
        expect(session.current.verdict).toBe(VERDICT.COARSE);
    });
});

describe("capture", () => {
    test("capture freezes the candidate", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        session.capture();
        expect(session.state).toBe(BIND_STATE.CAPTURED);
        expect(session.captured.text).toBe("84,5");
    });

    test("stray mouse movement cannot overwrite a capture", () => {
        // after the click the panel shows a decision to confirm; letting the
        // cursor drift over other content must not silently replace it
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        session.capture();
        session.candidate(candidate("1 013,2"));
        expect(session.captured.text).toBe("84,5");
    });

    test("retry returns to hovering and discards the capture", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        session.capture();
        session.retry();
        expect(session.captured).toBeNull();
        expect(session.state).toBe(BIND_STATE.CANDIDATE);
    });

    test("capture with nothing under the cursor does nothing", () => {
        const { session } = newSession();
        session.begin();
        expect(session.capture()).toBeNull();
        expect(session.state).toBe(BIND_STATE.HOVERING);
    });
});

describe("joining fragments", () => {
    // a PDF setting "41 182,5" with the thousands separator as a gap puts the
    // halves in separate marked-content runs, so one click reaches half a value
    const half = (text, mcid) => candidate(text, {
        properties: [{ property: "xbrl:pdfPage", value: "292" },
                     { property: "xbrl:pdfMcid", value: mcid }],
    });

    function splitSession() {
        return newSession({ fact: { id: "f-1", value: "41182.5", dataType: "xs:decimal" } });
    }

    test("one half of a split number reports as partial, not as wrong", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        expect(session.current.verdict).toBe(VERDICT.PARTIAL);
    });

    test("joining the halves agrees, and keeps both as ordered sources", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.addFragment(half("182,5", "11"));
        // concatenated with nothing between, as Inline XBRL 1.1 continuations
        // are; no separator is invented, and the value still normalises to match
        expect(session.captured.text).toBe("41182,5");
        expect(session.captured.verdict).toBe(VERDICT.AGREE);
        expect(session.captured.sources.map(s => s.properties[1].value)).toEqual(["10", "11"]);
    });

    test("accepting a joined capture writes both sources to the journal", () => {
        const { session, journal } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.addFragment(half("182,5", "11"));
        session.accept();
        expect(journal.entries()[0].sources).toHaveLength(2);
        expect(journal.entries()[0].verdict).toBe(VERDICT.AGREE);
    });

    test("adding the same run twice is a slip, not a doubling", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.addFragment(half("41", "10"));
        expect(session.captured.sources).toHaveLength(1);
    });

    test("adding a fragment before any capture starts the capture", () => {
        const { session } = splitSession();
        session.begin();
        expect(session.addFragment(half("41", "10")).text).toBe("41");
        expect(session.state).toBe(BIND_STATE.CAPTURED);
    });

    test("dropping the last fragment re-assesses what remains", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.addFragment(half("182,5", "11"));
        session.dropFragment();
        expect(session.captured.text).toBe("41");
        expect(session.captured.verdict).toBe(VERDICT.PARTIAL);
    });

    test("dropping below one fragment returns to hovering", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.dropFragment();
        expect(session.captured).toBeNull();
        expect(session.state).not.toBe(BIND_STATE.CAPTURED);
    });

    test("removes any fragment, not only the last", () => {
        // joins are built left to right, so the wrong one is often not the most
        // recent; unwinding good fragments to reach it would be worse
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.addFragment(half("999", "98"));
        session.addFragment(half("182,5", "11"));
        expect(session.captured.verdict).toBe(VERDICT.DIFFER);
        session.removeFragment(1);
        expect(session.captured.text).toBe("41182,5");
        expect(session.captured.verdict).toBe(VERDICT.AGREE);
        expect(session.captured.sources.map(s => s.properties[1].value)).toEqual(["10", "11"]);
    });

    test("keeps whitespace the fragments carry, rather than inventing any", () => {
        // the source's own spacing is what makes a joined text block faithful:
        // "the end" must not become "theend", and equally two runs that differ
        // only in styling must not gain a space that was never there
        const { session } = newSession({ fact: { id: "f-1", value: "Total assets", dataType: "xs:string" } });
        session.begin();
        session.candidate(half("Total ", "10"));
        session.capture();
        session.addFragment(half("assets", "11"));
        expect(session.captured.text).toBe("Total assets");
    });

    test("adjacent runs differing only in style do not gain a space", () => {
        const { session } = newSession({ fact: { id: "f-1", value: "Revenue", dataType: "xs:string" } });
        session.begin();
        session.candidate(half("Rev", "10"));
        session.capture();
        session.addFragment(half("enue", "11"));
        expect(session.captured.text).toBe("Revenue");
        expect(session.captured.verdict).toBe(VERDICT.AGREE);
    });

    test("removing an out-of-range fragment does nothing", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        expect(session.removeFragment(5)).toBeNull();
        expect(session.fragments).toHaveLength(1);
    });

    test("removing the only fragment returns to hovering", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.removeFragment(0);
        expect(session.captured).toBeNull();
        expect(session.state).not.toBe(BIND_STATE.CAPTURED);
    });

    test("retry clears the fragments, so a new capture does not inherit them", () => {
        const { session } = splitSession();
        session.begin();
        session.candidate(half("41", "10"));
        session.capture();
        session.addFragment(half("182,5", "11"));
        session.retry();
        session.candidate(half("41", "10"));
        session.capture();
        expect(session.captured.sources).toHaveLength(1);
    });
});

describe("derivation", () => {
    test("a scaled value is solved, not merely reported as differing", () => {
        const { session } = newSession({ fact: { id: "f-1", value: "84500000", dataType: "xs:decimal" } });
        session.begin();
        session.candidate(candidate("84,5"));
        expect(session.current.verdict).toBe(VERDICT.DIFFER);
        expect(session.current.derivation.kind).toBe("solved");
        expect(session.current.derivation.solutions[0].scale).toBe(6);
    });

    test("an unrelated capture is not dressed up as a formatting question", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("1 013,2"));
        expect(session.current.derivation.kind).toBe("unrelated");
    });
});

describe("widen", () => {
    test("widening re-assesses, so the verdict follows the wider text", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5", {
            widenTo: candidate("Provisions pour risques 84,5 76,8"),
        }));
        expect(session.current.verdict).toBe(VERDICT.AGREE);
        const wider = session.widen();
        expect(wider.verdict).toBe(VERDICT.COARSE);
        expect(session.current.text).toMatch(/Provisions/);
    });

    test("widening a capture replaces the capture, not the hover", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5", { widenTo: candidate("row 84,5 76,8") }));
        session.capture();
        session.widen();
        expect(session.captured.text).toBe("row 84,5 76,8");
        expect(session.state).toBe(BIND_STATE.CAPTURED);
    });

    test("widening does nothing at the top of the ladder", () => {
        const { session } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        expect(session.widen()).toBeNull();
    });
});

describe("accept", () => {
    test("writes the capture to the journal and leaves bind mode", () => {
        const { session, journal, surface } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        session.capture();
        const entry = session.accept();
        expect(entry.factId).toBe("f-1");
        expect(entry.sources).toEqual([{ properties: candidate("84,5").properties }]);
        expect(entry.verdict).toBe(VERDICT.AGREE);
        expect(journal.length).toBe(1);
        expect(session.state).toBe(BIND_STATE.IDLE);
        expect(surface.calls).toContain("endBind");
    });

    test("a differing capture can still be accepted", () => {
        // scaling, sign and locale formatting all make a value differ from its
        // presentation legitimately; refusing would block the corrections a
        // rebind exists to make
        const { session, journal } = newSession();
        session.begin();
        session.candidate(candidate("1 013,2"));
        session.capture();
        expect(session.accept()).not.toBeNull();
        expect(journal.entries()[0].verdict).toBe(VERDICT.DIFFER);
    });

    test("a rebind records what it displaced", () => {
        const previous = [{ property: "xbrl:pdfPage", value: "1" }];
        const { session, journal } = newSession({
            fact: { id: "f-1", value: "84.5", dataType: "xs:decimal", currentProperties: previous },
        });
        session.begin();
        session.candidate(candidate("84,5"));
        session.capture();
        session.accept();
        expect(journal.entries()[0].previous).toEqual(previous);
    });

    test("accept without a capture does nothing", () => {
        const { session, journal } = newSession();
        session.begin();
        session.candidate(candidate("84,5"));
        expect(session.accept()).toBeNull();
        expect(journal.length).toBe(0);
    });
});

describe("subscribers", () => {
    test("state changes notify, and unsubscribing stops it", () => {
        const { session } = newSession();
        let n = 0;
        const off = session.onChange(() => { n++; });
        session.begin();
        session.candidate(candidate("84,5"));
        session.capture();
        expect(n).toBe(3);
        off();
        session.cancel();
        expect(n).toBe(3);
    });
});
