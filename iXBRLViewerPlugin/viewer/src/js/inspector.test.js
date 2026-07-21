// See COPYRIGHT.md for copyright information

import $ from 'jquery';
import { ReportSet } from "./reportset.js";
import { TestInspector } from "./test-utils.js";
import { NAMESPACE_ISO4217, SHOW_FACT, viewerUniqueId } from "./util.js";


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
