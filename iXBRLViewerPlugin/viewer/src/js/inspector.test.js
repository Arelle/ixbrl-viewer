// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { ReportSet } from "./reportset.js";
import { ReportSetOutline } from "./outline.js";
import { IXNode } from "./ixnode.js";
import { Menu } from "./menu.js";
import { TestInspector } from "./test-utils.js";
import { NAMESPACE_ISO4217, SHOW_FACT, viewerUniqueId, FACTS_PER_GROUP, ZOOM_LEVELS } from "./util.js";


const testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217,
        "e": "http://example.com/entity",
    },
    "concepts": {
        "eg:Concept1": {
            "labels": {
                "std": {
                    "en": "English label"
                }
            }
        },
        "eg:Concept2": {
            "labels": {
                "std": {
                    "en": "English label for concept two"
                }
            }
        },
        "eg:Concept3": {
            "labels": {
                "std": {
                    "en": "English label for concept three"
                }
            }
        }
    },
    "facts": {},
    "languages": {},
    "roles": {},
    "roleDefs": {},
    "rels": {},
};

function testViewer() {
    return {
        documentCount: () => 1,
        getTitle: () => "Document title",
    };
}

function testReport(facts, ixData) {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
    data.facts = facts;
    const reportSet = new ReportSet(data);
    reportSet.setIXNodeMap(ixData);
    return reportSet;
}

function fromFact(value) {
    const factData = {
                "v": value,
                "a": {
                    "c": "eg:Concept1",
                    "u": "iso4217:USD",
                    "p": "2017-01-01/2018-01-01",
                }};
    return testReport({"f1": factData}, {"f1": {} }).getItemById("0-f1");
}

function toFact(value) {
    const factData = {
                "v": value,
                "a": {
                    "c": "eg:Concept1",
                    "u": "iso4217:USD",
                    "p": "2018-01-01/2019-01-01",
                }};

    return testReport({"f1": factData}, {"f1": {} }).getItemById("0-f1");
}

describe("Describe changes", () => {
    const insp = new TestInspector();
    beforeAll(() => {
        return insp.i18nInit();
    });

    test("Simple changes", () => {
        expect(insp.describeChange(fromFact(1000), toFact(2000))).toBe("100.0% increase on ");
        expect(insp.describeChange(fromFact(2000), toFact(1000))).toBe("50.0% decrease on ");
        expect(insp.describeChange(fromFact(1000), toFact(1000))).toBe("0.0% increase on ");
    });

    test("Sign changes", () => {
        expect(insp.describeChange(fromFact(1000), toFact(-1000))).toBe("From US $ 1,000 in ");
        expect(insp.describeChange(fromFact(-1000000), toFact(1000))).toBe("From US $ -1,000,000 in ");
    });

    test("From/to zero", () => {
        expect(insp.describeChange(fromFact(0), toFact(1000))).toBe("From US $ 0 in ");
        expect(insp.describeChange(fromFact(0), toFact(0))).toBe("From US $ 0 in ");
        expect(insp.describeChange(fromFact(1000), toFact(0))).toBe("From US $ 1,000 in ");
    });
});

describe("Scales filter options", () => {
    const createTestFact = function(isMonetary) {
        return {
            "v": 1,
            "a": {
                "c": "eg:Concept1",
                "u": isMonetary ? "iso4217:USD" : "test:shares",
                "p": "2018-01-01/2019-01-01",
                "e": "eg:1234",
            },
        };
    }
    const ixData = {};
    const monetaryFactData = {};
    for (let scale = -4; scale < 11; scale++) {
        const id = `itemM${scale}`;
        monetaryFactData[id] = createTestFact(true);
        const ixNode = {}
        if (scale !== 0) {
            ixNode["scale"] = scale;
        }
        ixData[viewerUniqueId(0, id)] = ixNode;
    }
    const nonMonetaryFactData = {};
    for (let scale = -4; scale < 11; scale++) {
        const id = `item${scale}`;
        nonMonetaryFactData[id] = createTestFact(false);
        const ixNode = {}
        if (scale !== 0) {
            ixNode["scale"] = scale;
        }
        ixData[viewerUniqueId(0, id)] = ixNode;
    }

    test("Scales filter options with monetary and non-monetary facts", () => {
        const insp = new TestInspector();
        const reportSet = testReport({
            ...monetaryFactData,
            ...nonMonetaryFactData,
        }, ixData);
        insp.initialize(reportSet, testViewer());
        insp.i18nInit();
        const scalesOptions = insp._getScalesOptions();
        expect(scalesOptions).toEqual([
              { value: '1', label: 'Tens' },
              { value: '2', label: 'Hundreds' },
              { value: '3', label: 'Thousands' },
              { value: '4', label: 'Ten Thousands' },
              { value: '5', label: 'Hundred Thousands' },
              { value: '6', label: 'Millions' },
              { value: '7', label: 'Ten Millions' },
              { value: '8', label: 'Hundred Millions' },
              { value: '9', label: 'Billions' },
              { value: '10', label: '10' },
              { value: '-1', label: 'Tenths' },
              { value: '-2', label: 'Cents, Hundredths' },
              { value: '-3', label: 'Thousandths' },
              { value: '-4', label: '-4' }
        ]);
    })

    test("Scales filter options with only monetary facts", () => {
        const insp = new TestInspector();
        const reportSet = testReport({
            ...monetaryFactData,
        }, ixData);
        insp.initialize(reportSet, testViewer());
        insp.i18nInit();
        const scalesOptions = insp._getScalesOptions();
        expect(scalesOptions).toEqual([
              { value: '1', label: 'Tens' },
              { value: '2', label: 'Hundreds' },
              { value: '3', label: 'Thousands' },
              { value: '4', label: 'Ten Thousands' },
              { value: '5', label: 'Hundred Thousands' },
              { value: '6', label: 'Millions' },
              { value: '7', label: 'Ten Millions' },
              { value: '8', label: 'Hundred Millions' },
              { value: '9', label: 'Billions' },
              { value: '10', label: '10' },
              { value: '-1', label: 'Tenths' },
              { value: '-2', label: 'Cents' },
              { value: '-3', label: 'Thousandths' },
              { value: '-4', label: '-4' }
        ]);
    });

    test("Scales filter options with only non-monetary facts", () => {
        const insp = new TestInspector();
        const reportSet = testReport({
            ...nonMonetaryFactData,
        }, ixData);
        insp.initialize(reportSet, testViewer());
        insp.i18nInit();
        const scalesOptions = insp._getScalesOptions();
        expect(scalesOptions).toEqual([
              { value: '1', label: 'Tens' },
              { value: '2', label: 'Hundreds' },
              { value: '3', label: 'Thousands' },
              { value: '4', label: 'Ten Thousands' },
              { value: '5', label: 'Hundred Thousands' },
              { value: '6', label: 'Millions' },
              { value: '7', label: 'Ten Millions' },
              { value: '8', label: 'Hundred Millions' },
              { value: '9', label: 'Billions' },
              { value: '10', label: '10' },
              { value: '-1', label: 'Tenths' },
              { value: '-2', label: 'Hundredths' },
              { value: '-3', label: 'Thousandths' },
              { value: '-4', label: '-4' }
        ]);
    });
});

describe("Fact deep link", () => {
    const insp = new TestInspector();
    insp._reportSet = {
        getItemById: jest.fn(id => ["0-123", "1-abc"].includes(id) ? true : undefined),
    };
    const mockSelect = jest.fn(id => true);
    insp.selectItem = mockSelect;
    test("Old style fact deep link", () => {
        mockSelect.mockClear();
        location.hash = "#f-123";
        insp.handleFactDeepLink();
        expect(mockSelect).toHaveBeenCalledWith("0-123");
    })
    test("Old style fact deep link (non-existent)", () => {
        mockSelect.mockClear();
        location.hash = "#f-1234";
        insp.handleFactDeepLink();
        expect(mockSelect).not.toHaveBeenCalled();
    })
    test("New style fact deep link", () => {
        mockSelect.mockClear();
        location.hash = "#f0-123";
        insp.handleFactDeepLink();
        expect(mockSelect).toHaveBeenCalledWith("0-123");
    })
    test("New style fact deep link", () => {
        mockSelect.mockClear();
        location.hash = "#f1-abc";
        insp.handleFactDeepLink();
        expect(mockSelect).toHaveBeenCalledWith("1-abc");
    })
    test("New style fact deep link (non-existent)", () => {
        mockSelect.mockClear();
        location.hash = "#f0-1234";
        insp.handleFactDeepLink();
        expect(mockSelect).not.toHaveBeenCalled();
    })
});

describe("doInitialSelection", () => {
    const setUpInspector = (searchOnStartup, hasOutline = false) => {
        const insp = new TestInspector();
        insp._iv.setFeatures({ "search_on_startup": searchOnStartup }, "");
        insp.outline = { hasOutline: jest.fn(() => hasOutline) };
        insp.inspectorMode = jest.fn();
        return insp;
    };

    test("enters search mode when search_on_startup is enabled and no deep link is present", () => {
        const insp = setUpInspector(true);
        insp._currentItem = undefined;
        insp.doInitialSelection();
        expect(insp.inspectorMode).toHaveBeenCalledWith("search-mode");
    });

    test("enters fact-mode when search_on_startup is disabled", () => {
        const insp = setUpInspector(false);
        insp._currentItem = undefined;
        insp.doInitialSelection();
        expect(insp.inspectorMode).toHaveBeenCalledWith("fact-mode");
    });

    test("adds show-facts-by-group class when the outline has an outline and search_on_startup is disabled", () => {
        const insp = setUpInspector(false, true);
        insp._currentItem = undefined;
        $("#inspector").remove();
        $(document.body).append('<div id="inspector"></div>');
        insp.doInitialSelection();
        expect($("#inspector").hasClass("show-facts-by-group")).toBe(true);
    });

    test("uses the deep-linked fact when one is present, regardless of search_on_startup", () => {
        const insp = setUpInspector(true);
        insp._currentItem = { some: "fact" };
        insp.doInitialSelection();
        expect(insp.inspectorMode).not.toHaveBeenCalled();
    });
});

describe("highlightTagsOnStartup", () => {
    afterEach(() => {
        window.localStorage.clear();
    });

    test("returns true when highlight_facts_on_startup is enabled and no stored preference exists", () => {
        const insp = new TestInspector();
        insp._iv.setFeatures({ "highlight_facts_on_startup": true }, "");
        expect(insp.highlightTagsOnStartup()).toBe(true);
    });

    test("returns false when highlight_facts_on_startup is disabled and no stored preference exists", () => {
        const insp = new TestInspector();
        insp._iv.setFeatures({ "highlight_facts_on_startup": false }, "");
        expect(insp.highlightTagsOnStartup()).toBe(false);
    });
});

describe("Calculation mode setting visibility", () => {
    beforeAll(() => {
        return new TestInspector().i18nInit();
    });

    const setUpInspector = (usesCalculations10, hideCalculationModeOption) => {
        const insp = new TestInspector();
        insp._iv.setFeatures({ "hide_calculation_mode_option": hideCalculationModeOption }, "");
        insp._reportSet = { usesCalculations10: jest.fn(() => usesCalculations10) };
        $(document.body).append('<table><tbody><tr class="section"><td><select id="setting-calculation-mode"></select></td></tr></tbody></table>');
        return insp;
    };

    afterEach(() => {
        $("#setting-calculation-mode").closest(".section").remove();
    });

    test("hides calc-mode section when hide_calculation_mode_option is enabled", () => {
        const insp = setUpInspector(true, true);
        insp.buildSettingsPage();
        expect($("#setting-calculation-mode").closest(".section").css("display")).toBe("none");
    });

    test("shows calc-mode section when hide_calculation_mode_option is disabled and report uses calculations 1.0", () => {
        const insp = setUpInspector(true, false);
        insp.buildSettingsPage();
        expect($("#setting-calculation-mode").closest(".section").css("display")).not.toBe("none");
    });
});

describe("Handle message", () => {
    const generateEvent = (data) => {
        return {
            originalEvent: {
                data: JSON.stringify(data)
            }
        };
    }
    const insp = new TestInspector();
    insp._reportSet = {
        getItemById: jest.fn(id => ["0-123", "1-abc"].includes(id) ? true : undefined),
    };
    const mockSelect = jest.fn(id => true);
    insp.selectItem = mockSelect;
    it.each([
        ["0", "0-123"],
        [0, "0-123"],
        [undefined, "0-123"],
        ["1", "1-123"],
        [1, "1-123"],
        ["X", "0-123"],
    ])("SHOW_FACT task with valid factID and %p docSetId selects VUID %p", (docSetId, result) => {
        mockSelect.mockClear();
        const data = {
            task: SHOW_FACT,
            factId: "123",
        }
        if (docSetId !== undefined) {
            data["docSetId"] = docSetId
        }
        const event = generateEvent({
            task: SHOW_FACT,
            factId: "123",
            docSetId: docSetId
        });
        insp.handleMessage(event);
        expect(mockSelect).toHaveBeenCalledWith(result);
    });
    test("SHOW_FACT with no factId", () => {
        mockSelect.mockClear();
        const event = generateEvent({
            task: SHOW_FACT,
            docSetId: "0",
        });
        insp.handleMessage(event);
        expect(mockSelect).toHaveBeenCalledWith(null);
    })
    test("SHOW_FACT with empty factId", () => {
        mockSelect.mockClear();
        const event = generateEvent({
            task: SHOW_FACT,
            factId: "",
        });
        insp.handleMessage(event);
        expect(mockSelect).toHaveBeenCalledWith("0-");
    });
    test("Invalid task", () => {
        mockSelect.mockClear();
        const event = generateEvent({
            task: "INVALID_TASK",
        });
        jest.spyOn(console, 'log').withImplementation(() => {}, () => {
            insp.handleMessage(event);
        });
        expect(mockSelect).not.toHaveBeenCalled();
    })
    test("Invalid JSON", () => {
        mockSelect.mockClear();
        const event = {
            originalEvent: {
                data: `{
                    task: "SHOW_TASK"
                    factId: "f1-abc"
                }`
            }
        };
        insp.handleMessage(event);
        expect(mockSelect).not.toHaveBeenCalled();
    })
});

describe("Facts by group", () => {
    const groupReportData = {
        prefixes: {
            eg: "http://www.example.com",
        },
        concepts: {
            "eg:Root1": { labels: { std: { en: "Root 1" } } },
            "eg:LineItem1": { labels: { std: { en: "Line Item 1" } } },
            "eg:LineItem2": { labels: { std: { en: "Line Item 2" } } },
        },
        roles: {
            elr1: "http://www.example.com/elr1",
            elr2: "http://www.example.com/elr2",
        },
        roleDefs: {
            elr1: { en: "001 Group 1" },
            elr2: { en: "002 Group 2" },
        },
        rels: {
            pres: {
                elr1: { "eg:Root1": [{ t: "eg:LineItem1" }] },
                elr2: { "eg:Root1": [{ t: "eg:LineItem2" }] },
            },
        },
        facts: {},
        languages: {},
    };

    // insertionOrder controls the key order of the "facts" object (and thus
    // reportSet.facts() order); docOrder controls the order IXNode objects
    // are constructed in, which determines document order (docOrderindex).
    function buildGroupReportSet(insertionOrder, docOrder, conceptOf) {
        const data = JSON.parse(JSON.stringify(groupReportData));
        data.facts = {};
        for (const id of insertionOrder) {
            data.facts[id] = { a: { c: conceptOf(id), p: "2019-01-01" } };
        }
        const reportSet = new ReportSet(data);
        const ixNodeMap = {};
        for (const id of docOrder) {
            ixNodeMap[viewerUniqueId(0, id)] = new IXNode(id, $('<span></span>'));
        }
        reportSet.setIXNodeMap(ixNodeMap);
        return reportSet;
    }

    function conceptOf(id) {
        return id.startsWith("f1") ? "eg:LineItem1" : "eg:LineItem2";
    }

    function buildTwoReportSet() {
        function targetReport(elr, factId, concept) {
            const data = JSON.parse(JSON.stringify(groupReportData));
            for (const other of ["elr1", "elr2"].filter(e => e !== elr)) {
                delete data.roles[other];
                delete data.roleDefs[other];
                delete data.rels.pres[other];
            }
            data.facts = { [factId]: { a: { c: concept, p: "2019-01-01" } } };
            return data;
        }
        const reportSet = new ReportSet({
            sourceReports: [ { targetReports: [
                targetReport("elr1", "fa", "eg:LineItem1"),
                targetReport("elr2", "fb", "eg:LineItem2"),
            ] } ]
        });
        const ixNodeMap = {};
        for (const id of ["fa", "fb"]) {
            ixNodeMap[viewerUniqueId(0, id)] = new IXNode(id, $('<span></span>'));
        }
        reportSet.setIXNodeMap(ixNodeMap);
        return reportSet;
    }

    function setUpInspector(reportSet) {
        const insp = new TestInspector();
        insp._reportSet = reportSet;
        insp.outline = new ReportSetOutline(reportSet);
        $("#ixv, #inspector").remove();
        $(document.body).append(`
            <div id="ixv">
              <div id="inspector" class="show-facts-by-group">
                <div class="inspector-container fact-inspector">
                  <div class="section section-list-controls">
                    <div class="section-list-title" data-i18n="inspector.fact-groups">Sections</div>
                    <div class="section-list-buttons">
                      <button id="collapse-all-sections" data-i18n="inspector.collapseAllSections">Collapse all</button>
                      <button id="expand-all-sections" data-i18n="inspector.expandAllSections">Expand all</button>
                    </div>
                  </div>
                  <div class="inspector-body">
                    <div class="facts-by-group"></div>
                  </div>
                </div>
              </div>
            </div>
        `);
        $("#ixv").localize();
        insp.initializeCollapsibleSections();
        insp.initializeSectionListControls();
        return insp;
    }

    function sections() {
        return $("#inspector .facts-by-group .collapsible-section");
    }

    function headerButton(index) {
        return sections().eq(index).find("> .collapsible-header button:first-of-type");
    }

    function collapsedFlags() {
        return sections().map((_, el) => $(el).hasClass("collapsed")).get();
    }

    function bulkButton(action) {
        return $(`#${action}-all-sections`);
    }

    beforeAll(() => {
        $.fx.off = true;
        return new TestInspector().i18nInit();
    });

    afterAll(() => {
        $.fx.off = false;
    });

    test("only renders facts belonging to the specified group, even when fact-array order differs from document order", () => {
        // Insertion order into reportSet.facts() puts f2 (an elr2 fact)
        // between f1 and f1a (both elr1), even though document order is
        // f1, f1a, f2. This reproduces the bug where index-based slicing of
        // reportSet.facts() pulled in facts from other groups.
        const reportSet = buildGroupReportSet(["f1", "f2", "f1a"], ["f1", "f1a", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);

        insp.buildFactListByGroup();

        const groupBodies = $("#inspector .facts-by-group .collapsible-body");
        const elr1Body = groupBodies.eq(0);
        const renderedIds = elr1Body.find(".fact-list-item").map((_, el) => $(el).data("ivid")).get();
        expect(renderedIds).not.toContain(viewerUniqueId(0, "f2"));
    });

    test("includes the last fact in the group (no off-by-one)", () => {
        const reportSet = buildGroupReportSet(["f1", "f2", "f1a"], ["f1", "f1a", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);

        insp.buildFactListByGroup();

        const elr1Body = $("#inspector .facts-by-group .collapsible-body").eq(0);
        const renderedIds = elr1Body.find(".fact-list-item").map((_, el) => $(el).data("ivid")).get();
        expect(renderedIds).toEqual([viewerUniqueId(0, "f1"), viewerUniqueId(0, "f1a")]);
    });

    test("paginates a group's facts with a show-more button", () => {
        const ids = [];
        for (let i = 0; i < FACTS_PER_GROUP + 5; i++) {
            ids.push(`f1-${i}`);
        }
        const reportSet = buildGroupReportSet(ids, ids, () => "eg:LineItem1");
        const insp = setUpInspector(reportSet);

        insp.buildFactListByGroup();

        const body = $("#inspector .facts-by-group .collapsible-body").eq(0);
        expect(body.find(".fact-list-item").length).toBe(FACTS_PER_GROUP - 1);
        expect(body.find(".show-more").length).toBe(1);

        body.find(".show-more").trigger("click");

        expect(body.find(".fact-list-item").length).toBe(ids.length);
        expect(body.find(".show-more").length).toBe(0);
    });

    test("builds every section collapsed, reporting aria-expanded=false", () => {
        const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);

        insp.buildFactListByGroup();

        expect(sections().length).toBe(2);
        sections().each((_, el) => {
            expect($(el).hasClass("collapsed")).toBe(true);
        });
        expect(headerButton(0).attr("aria-expanded")).toBe("false");
        expect(headerButton(1).attr("aria-expanded")).toBe("false");
    });

    test("clicking a section header expands that section and only that section", () => {
        const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);
        insp.buildFactListByGroup();

        headerButton(0).trigger("click");

        expect(sections().eq(0).hasClass("collapsed")).toBe(false);
        expect(headerButton(0).attr("aria-expanded")).toBe("true");
        expect(sections().eq(1).hasClass("collapsed")).toBe(true);
        expect(headerButton(1).attr("aria-expanded")).toBe("false");
    });

    test("clicking an expanded section header collapses it again", () => {
        const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);
        insp.buildFactListByGroup();

        headerButton(0).trigger("click");
        headerButton(0).trigger("click");

        expect(sections().eq(0).hasClass("collapsed")).toBe(true);
        expect(headerButton(0).attr("aria-expanded")).toBe("false");
    });

    test("the toolbar labels its title and its buttons", () => {
        const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);

        insp.buildFactListByGroup();

        expect(sections().length).toBe(2);
        expect(bulkButton("collapse").text()).toBe("Collapse all");
        expect(bulkButton("expand").text()).toBe("Expand all");
    });

    test("Expand all expands every section, and Collapse all collapses every section", () => {
        const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);
        insp.buildFactListByGroup();

        bulkButton("expand").trigger("click");

        expect(collapsedFlags()).toEqual([false, false]);
        expect(headerButton(0).attr("aria-expanded")).toBe("true");
        expect(headerButton(1).attr("aria-expanded")).toBe("true");

        bulkButton("collapse").trigger("click");

        expect(collapsedFlags()).toEqual([true, true]);
        expect(headerButton(0).attr("aria-expanded")).toBe("false");
        expect(headerButton(1).attr("aria-expanded")).toBe("false");
    });

    test("Expand all expands a section a reader had already expanded by hand", () => {
        const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
        const insp = setUpInspector(reportSet);
        insp.buildFactListByGroup();
        headerButton(0).trigger("click");

        bulkButton("expand").trigger("click");

        expect(collapsedFlags()).toEqual([false, false]);
    });

    test("the bulk buttons cover sections from every report", () => {
        const insp = setUpInspector(buildTwoReportSet());
        insp.buildFactListByGroup();

        expect(sections().length).toBe(2);

        bulkButton("expand").trigger("click");

        expect(collapsedFlags()).toEqual([false, false]);

        bulkButton("collapse").trigger("click");

        expect(collapsedFlags()).toEqual([true, true]);
    });

    test("alternating bulk clicks replace an in-flight slide rather than stacking animations", () => {
        $.fx.off = false;
        try {
            const reportSet = buildGroupReportSet(["f1", "f2"], ["f1", "f2"], conceptOf);
            const insp = setUpInspector(reportSet);
            insp.buildFactListByGroup();

            bulkButton("expand").trigger("click");
            bulkButton("collapse").trigger("click");
            bulkButton("expand").trigger("click");

            const queued = sections()
                .map((_, el) => $.queue($(el).find("> .collapsible-body").get(0), "fx").length)
                .get();
            expect(queued).toEqual([1, 1]);
        }
        finally {
            sections().find("> .collapsible-body").finish();
            $.fx.tick();
            $.fx.off = true;
        }
    });

    test("a section paged out with show more keeps every row across a bulk round trip", () => {
        const ids = [];
        for (let i = 0; i < FACTS_PER_GROUP + 5; i++) {
            ids.push(`f1-${i}`);
        }
        const reportSet = buildGroupReportSet(ids, ids, () => "eg:LineItem1");
        const insp = setUpInspector(reportSet);
        insp.buildFactListByGroup();
        const body = $("#inspector .facts-by-group .collapsible-body").eq(0);
        body.find(".show-more").trigger("click");

        bulkButton("collapse").trigger("click");
        bulkButton("expand").trigger("click");

        expect(body.find(".fact-list-item").length).toBe(ids.length);
        expect(body.find(".show-more").length).toBe(0);
    });
});

describe("Collapsible sections", () => {
    function setUpSections() {
        const insp = new TestInspector();
        $("#ixv").remove();
        $(document.body).append(`
            <div id="ixv">
              <div class="collapsible-section first">
                <h3 class="collapsible-header"><button aria-expanded="true">First</button></h3>
                <div class="collapsible-body">First body</div>
              </div>
              <div class="collapsible-section second">
                <h3 class="collapsible-header"><button aria-expanded="true">Second</button></h3>
                <div class="collapsible-body">Second body</div>
              </div>
            </div>
        `);
        insp.initializeCollapsibleSections();
        return insp;
    }

    function headerButton(section) {
        return $(`#ixv .collapsible-section.${section} .collapsible-header button`);
    }

    beforeAll(() => {
        $.fx.off = true;
    });

    afterAll(() => {
        $.fx.off = false;
    });

    test("clicking a header collapses that section and flips its aria-expanded", () => {
        setUpSections();

        headerButton("first").trigger("click");

        expect($("#ixv .collapsible-section.first").hasClass("collapsed")).toBe(true);
        expect(headerButton("first").attr("aria-expanded")).toBe("false");
        expect($("#ixv .collapsible-section.first .collapsible-body").css("display")).toBe("none");
    });

    test("clicking a collapsed header expands it again", () => {
        setUpSections();

        headerButton("first").trigger("click");
        headerButton("first").trigger("click");

        expect($("#ixv .collapsible-section.first").hasClass("collapsed")).toBe(false);
        expect(headerButton("first").attr("aria-expanded")).toBe("true");
        expect($("#ixv .collapsible-section.first .collapsible-body").css("display")).not.toBe("none");
    });

    test("clicking a header leaves sibling sections alone", () => {
        setUpSections();

        headerButton("first").trigger("click");

        expect($("#ixv .collapsible-section.second").hasClass("collapsed")).toBe(false);
        expect(headerButton("second").attr("aria-expanded")).toBe("true");
    });

    test("keeps the body shown inline while it slides shut", () => {
        $.fx.off = false;
        try {
            setUpSections();

            headerButton("first").trigger("click");

            const body = $("#ixv .collapsible-section.first .collapsible-body");
            expect(body.get(0).style.display).toBe("block");
        }
        finally {
            $.fx.off = true;
        }
    });

    test("collapsing a section authored expanded leaves no inline display residue on expand", () => {
        setUpSections();

        headerButton("first").trigger("click");
        headerButton("first").trigger("click");

        const body = $("#ixv .collapsible-section.first .collapsible-body");
        expect(body.get(0).style.height).toBe("");
        expect(body.get(0).style.display).not.toBe("none");
    });
});

describe("_populateFileSummary", () => {
    const emptyDocuments = {
        inline: [],
        schema: [],
        calcLinkbase: [],
        defLinkbase: [],
        labelLinkbase: [],
        presLinkbase: [],
        refLinkbase: [],
        unrecognizedLinkbase: [],
    };

    const buildSummaryDom = () => $(`
        <div>
          <div class="collapsible-section files-summary">
            <div class="collapsible-body">
              <ul class="plain-list files-summary-list"></ul>
            </div>
          </div>
        </div>
    `);

    test("hides the files summary section when there are no local documents", () => {
        const insp = new TestInspector();
        insp.summary = { getLocalDocuments: () => emptyDocuments };
        const summaryDom = buildSummaryDom();

        insp._populateFileSummary(summaryDom);

        expect(summaryDom.find(".files-summary").css("display")).toBe("none");
    });

    test("shows the files summary section when there are local documents", () => {
        const insp = new TestInspector();
        insp.summary = {
            getLocalDocuments: () => ({
                ...emptyDocuments,
                inline: ["report.html"],
            }),
        };
        const summaryDom = buildSummaryDom();

        insp._populateFileSummary(summaryDom);

        expect(summaryDom.find(".files-summary").css("display")).not.toBe("none");
        expect(summaryDom.find(".files-summary-list li").text()).toBe("report.html");
    });
});

describe("Plugin extension points", () => {
    const menuFixture = (id) => $(`
        <div class="menu" id="${id}">
          <button class="menu-title"></button>
          <div class="content-container">
            <div class="content"></div>
          </div>
        </div>
    `);

    test("extendDisplayOptionsMenu is invoked on registered plugins and rendered menu items appear in the DOM", () => {
        const insp = new TestInspector();
        const plugin = {
            extendDisplayOptionsMenu: jest.fn((menu) => {
                menu.addCheckboxItem("Plugin option", () => {}, "plugin-option");
                menu.addLink("Plugin link", "https://example.com");
            }),
        };
        insp._iv.registerPlugin(plugin);
        insp._optionsMenu = new Menu(menuFixture("display-options-menu"));

        insp.buildDisplayOptionsMenu();

        expect(plugin.extendDisplayOptionsMenu).toHaveBeenCalledWith(insp._optionsMenu);
        const items = insp._optionsMenu._elt.find(".content .item");
        expect(items).toHaveLength(2);
        expect(items.eq(0).text()).toBe("Plugin option");
        expect(items.eq(1).text()).toBe("Plugin link");
        expect(items.eq(1).attr("href")).toBe("https://example.com");
    });

    test("extendToolbarHighlightMenu is invoked on registered plugins and rendered menu items appear in the DOM", () => {
        const insp = new TestInspector();
        const plugin = {
            extendToolbarHighlightMenu: jest.fn((menu) => {
                menu.addCheckboxItem("Untagged Facts", () => {}, "highlight-untagged-facts");
            }),
        };
        insp._iv.registerPlugin(plugin);
        insp._toolbarMenu = new Menu(menuFixture("toolbar-highlight-menu"));

        insp.buildToolbarHighlightMenu();

        expect(plugin.extendToolbarHighlightMenu).toHaveBeenCalledWith(insp._toolbarMenu);
        const items = insp._toolbarMenu._elt.find(".content .item");
        expect(items).toHaveLength(1);
        expect(items.eq(0).text()).toBe("Untagged Facts");
    });
});

describe("Zoom boundary clamping", () => {
    const setUpInspector = () => {
        const insp = new TestInspector();
        insp._viewer = { zoom: jest.fn() };
        return insp;
    };

    test("zoomRelative does not go below the minimum zoom level", () => {
        const insp = setUpInspector();
        insp._zoomLevel = 0;
        insp.zoomRelative(-1);
        expect(insp._zoomLevel).toBe(0);
        expect(insp._viewer.zoom).toHaveBeenCalledWith(ZOOM_LEVELS[0]);
    });

    test("zoomRelative does not go above the maximum zoom level", () => {
        const insp = setUpInspector();
        insp._zoomLevel = ZOOM_LEVELS.length - 1;
        insp.zoomRelative(1);
        expect(insp._zoomLevel).toBe(ZOOM_LEVELS.length - 1);
        expect(insp._viewer.zoom).toHaveBeenCalledWith(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
    });

    test("zoomRelative moves one step within bounds", () => {
        const insp = setUpInspector();
        insp._zoomLevel = 5;
        insp.zoomRelative(1);
        expect(insp._zoomLevel).toBe(6);
        expect(insp._viewer.zoom).toHaveBeenCalledWith(ZOOM_LEVELS[6]);
    });

    test("zoomAbsolute sets the zoom level to the given index", () => {
        const insp = setUpInspector();
        insp.zoomAbsolute("3");
        expect(insp._zoomLevel).toBe(3);
        expect(insp._viewer.zoom).toHaveBeenCalledWith(ZOOM_LEVELS[3]);
    });

    test("zoomAbsolute clamps an index below the minimum zoom level", () => {
        const insp = setUpInspector();
        insp.zoomAbsolute("-1");
        expect(insp._zoomLevel).toBe(0);
        expect(insp._viewer.zoom).toHaveBeenCalledWith(ZOOM_LEVELS[0]);
    });

    test("zoomAbsolute clamps an index above the maximum zoom level", () => {
        const insp = setUpInspector();
        insp.zoomAbsolute(String(ZOOM_LEVELS.length));
        expect(insp._zoomLevel).toBe(ZOOM_LEVELS.length - 1);
        expect(insp._viewer.zoom).toHaveBeenCalledWith(ZOOM_LEVELS[ZOOM_LEVELS.length - 1]);
    });
});

describe("_populateDownloadsSummary", () => {
    const buildSummaryDom = () => $(`
        <div>
          <div class="collapsible-section downloads-summary">
            <div class="bordered-section filing-documents">
              <a class="download-link" href=""></a>
            </div>
          </div>
        </div>
    `);

    test("sets the download link href on the .filing-documents element when present", () => {
        const insp = new TestInspector();
        insp._reportSet = { filingDocuments: () => "https://example.com/documents.zip" };
        const summaryDom = buildSummaryDom();

        insp._populateDownloadsSummary(summaryDom);

        expect(summaryDom.find(".filing-documents .download-link").attr("href")).toBe("https://example.com/documents.zip");
        expect(summaryDom.find(".filing-documents").css("display")).not.toBe("none");
        expect(summaryDom.find(".downloads-summary").css("display")).not.toBe("none");
    });

    test("hides the .filing-documents element when there are no filing documents", () => {
        const insp = new TestInspector();
        insp._reportSet = { filingDocuments: () => undefined };
        const summaryDom = buildSummaryDom();

        insp._populateDownloadsSummary(summaryDom);

        expect(summaryDom.find(".filing-documents").css("display")).toBe("none");
        expect(summaryDom.find(".downloads-summary").css("display")).toBe("none");
    });
});
