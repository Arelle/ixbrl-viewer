// See COPYRIGHT.md for copyright information

import { ReportSet } from "./reportset.js";
import { ViewerOptions } from "./viewerOptions.js";
import { NAMESPACE_ISO4217, viewerUniqueId } from "./util.js";
import { createNumericFact } from "./test-utils.js";

function anchoringRelationShips(include) {
    if (include) {
        return {
          "w-n": {
            "role1": {
              "eg:Concept1": [{"t": "eg:Concept2"}],
            }
          }
        }
    }
    return {}
}

function multiReportTestData(withAnchoring) {
    return {
        "features": [],
        "languages": {
            "en-us": "English (US)",
            "en": "English",
            "fr": "French",
        },
        "prefixes": {
            "eg": "http://www.example.com",
            "iso4217": NAMESPACE_ISO4217
        },
        "roles": {
            "role1": "https://www.example.com/role1",
            "role2": "https://www.example.com/role2",
            "role3": "https://www.example.com/role3",
            "role4": "https://www.example.com/role4"
        },
        "sourceReports": [
            { 
                "targetReports": [
                    {
                        "roleDefs": {
                            "role1": { "en": "Role 1 Label" },
                            "role2": { "en": null },
                            "role3": {}
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
                                        "en": "English label for concept two",
                                        "en-us": "English (US) label for concept two",
                                    }
                                }
                            },
                            "eg:Concept3": {
                                "labels": {
                                    "std": {
                                        "en": "Concept three"
                                    }
                                }
                            }
                        },

                        "facts": {
                            ...createNumericFact("f1", "eg:Concept1", "iso2417:USD", "2018-01-01/2019-01-01", 1000, -3),
                            ...createNumericFact("f2", "eg:Concept2", "iso2417:USD", "2018-01-01/2019-01-01", 1000, -3),
                        },


                        "softwareCredits": ["Example credit text C", "Example credit text B"],
                    },
                ]
            },
            {
                "targetReports": [
                    {
                        "roleDefs": {
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
                                        "en": "Report 2 English label for concept two",
                                    }
                                }
                            },
                            "eg:Concept3": {
                                "labels": {
                                    "std": {
                                        "en-gb": "Concept three"
                                    }
                                }
                            }
                        },

                        "facts": {
                            ...createNumericFact("f1", "eg:Concept1", "iso2417:USD", "2018-01-01/2019-01-01", 2000, -3),
                        },

                        "rels": {
                          ...anchoringRelationShips(withAnchoring)
                        },

                        "softwareCredits": ["Example credit text A"],
                    }
                ]
            }
        ]
    };
}

// Legacy report data format - no "sourceReports" array
function singleReportTestData() {
    return {
        "features": [],
        "languages": {
            "en-us": "English (US)",
            "en": "English",
            "fr": "French",
        },
        "prefixes": {
            "eg": "http://www.example.com",
            "iso4217": NAMESPACE_ISO4217
        },
        "roles": {
            "role1": "https://www.example.com/role1",
            "role2": "https://www.example.com/role2",
            "role3": "https://www.example.com/role3",
            "role4": "https://www.example.com/role4"
        },
        "roleDefs": {
            "role1": { "en": "Role 1 Label" },
            "role2": { "en": null },
            "role3": {}
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
                        "en": "English label for concept two",
                        "en-us": "English (US) label for concept two",
                    }
                }
            },
        },

        "facts": {
            ...createNumericFact("f1", "eg:Concept1", "iso2417:USD", "2018-01-01/2019-01-01", 1000, -3),
            ...createNumericFact("f2", "eg:Concept2", "iso2417:USD", "2018-01-01/2019-01-01", 1000, -3),
        },

        "softwareCredits": ["Example credit text"],
    };
}

describe("Multi report - basic", () => {
    const testReportSet = new ReportSet(multiReportTestData());
    testReportSet._initialize();
    test("Report count", () => {
        expect(testReportSet.reports).toHaveLength(2);
    });
});

describe("Multi report - Language options", () => {
    const testReportSet = new ReportSet(multiReportTestData());
    testReportSet._initialize();
    test("Available languages", () => {
        const al = testReportSet.availableLanguages();
        expect(al).toHaveLength(3);
        expect(al).toEqual(expect.arrayContaining(["en", "en-us", "en-gb"]));
    });
});

describe("Multi report - Fetching facts", () => {
    const testReportSet = new ReportSet(multiReportTestData());
    testReportSet._initialize();

    test("Successful f1 (report 1)", () => {
        const f = testReportSet.getItemById(viewerUniqueId(0, "f1"));
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });
    test("Successful f2 (report 1)", () => {
        const f = testReportSet.getItemById(viewerUniqueId(0, "f2"));
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });
    test("Successful f1 (report 2)", () => {
        const f = testReportSet.getItemById(viewerUniqueId(1, "f1"));
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });

    test("Non-existent fact", () => {
        const f = testReportSet.getItemById(viewerUniqueId(1, "f2"));
        expect(f).toBeUndefined();
    });
});

describe("Multi report - Concept labels", () => {
    const testReportSet = new ReportSet(multiReportTestData());
    testReportSet._initialize();
    const testReport = testReportSet.reports[0];
    const vo = new ViewerOptions();
    testReportSet.viewerOptions = vo;
    test("Label fallback", () => {
        vo.language = 'en-us';
        expect(testReportSet.reports[0].getLabel('eg:Concept2', 'std')).toBe("English (US) label for concept two");
        // No en-US label in report 2, so fall back on en label
        expect(testReportSet.reports[1].getLabel('eg:Concept2', 'std')).toBe("Report 2 English label for concept two");
    });
});

describe("Multi report - ELR labels", () => {
    const testReportSet = new ReportSet(multiReportTestData());
    testReportSet._initialize();

    test("Present", () => {
        // Role 1 only has a label in report 1
        expect(testReportSet.reports[0].getRoleLabelOrURI("role1")).toBe("Role 1 Label");
        expect(testReportSet.reports[1].getRoleLabelOrURI("role1")).toBe("https://www.example.com/role1");
    });
});

describe("Multi report - anchoring", () => {
    test("Without anchoring", () => {
        const testReportSet = new ReportSet(multiReportTestData(false));
        testReportSet._initialize();
        expect(testReportSet.usesAnchoring()).toBe(false);
    });
    test("With anchoring", () => {
        const testReportSet = new ReportSet(multiReportTestData(true));
        testReportSet._initialize();
        expect(testReportSet.usesAnchoring()).toBe(true);
    });
});

describe("Multi report - doc set files", () => {
    test("Not overlapping", () => {
        const data = multiReportTestData(false);
        data.sourceReports[0].docSetFiles = ["a.html", "b.html"];
        data.sourceReports[1].docSetFiles = ["c.html", "d.html"];
        const testReportSet = new ReportSet(data);
        testReportSet._initialize();
        expect(testReportSet.reportFiles()).toStrictEqual([{"index": 0, "file": "a.html"}, {"index": 0, "file": "b.html"}, {"index": 1, "file": "c.html"}, {"index": 1, "file": "d.html"}]);
    });
    test("Repeated document set", () => {
        const data = multiReportTestData(false);
        data.sourceReports[0].docSetFiles = ["a.html", "b.html"];
        data.sourceReports[1].docSetFiles = ["a.html", "b.html"];
        const testReportSet = new ReportSet(data);
        testReportSet._initialize();
        expect(testReportSet.reportFiles()).toStrictEqual([{"index": 0, "file": "a.html"}, {"index": 0, "file": "b.html"}, {"index": 1, "file": "a.html"}, {"index": 1, "file": "b.html"}]);
    });
});

describe("Single report - basic", () => {
    const testReportSet = new ReportSet(singleReportTestData());
    testReportSet._initialize();
    test("Report count", () => {
        expect(testReportSet.reports).toHaveLength(1);
    });
});

describe("Single report - Language options", () => {
    const testReportSet = new ReportSet(singleReportTestData());
    testReportSet._initialize();
    test("Available languages", () => {
        const al = testReportSet.availableLanguages();
        expect(al).toHaveLength(2);
        expect(al).toEqual(expect.arrayContaining(["en", "en-us"]));
    });
});

describe("Single report - Fetching facts", () => {
    const testReportSet = new ReportSet(singleReportTestData());
    testReportSet._initialize();

    test("Successful f1", () => {
        const f = testReportSet.getItemById(viewerUniqueId(0, "f1"));
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });
    test("Successful f2", () => {
        const f = testReportSet.getItemById(viewerUniqueId(0, "f2"));
        expect(f).not.toBeNull();
        expect(f.decimals()).toEqual(-3);
    });
    // There is no second report
    test("Successful f1 (report 2)", () => {
        const f = testReportSet.getItemById(viewerUniqueId(1, "f1"));
        expect(f).toBeUndefined();
    });
});

describe("Single report - Concept labels", () => {
    const testReportSet = new ReportSet(singleReportTestData());
    testReportSet._initialize();
    const testReport = testReportSet.reports[0];
    const vo = new ViewerOptions();
    testReportSet.viewerOptions = vo;
    test("Label fallback", () => {
        vo.language = 'en-us';
        expect(testReportSet.reports[0].getLabel('eg:Concept2', 'std')).toBe("English (US) label for concept two");
    });
});

describe("ELR labels", () => {
    const testReportSet = new ReportSet(singleReportTestData());
    testReportSet._initialize();

    test("Present", () => {
        expect(testReportSet.reports[0].getRoleLabelOrURI("role1")).toBe("Role 1 Label");
    });
});

describe("Fetching software credit", () => {

    test("Single", () => {
        const testReportSet = new ReportSet(singleReportTestData());
        testReportSet._initialize();

        const softwareCredits = testReportSet.getSoftwareCredits();
        expect(softwareCredits).toEqual(["Example credit text"]);
    });

    test("Multiple", () => {
        const testReportSet = new ReportSet(multiReportTestData(true));
        testReportSet._initialize();

        const softwareCredits = testReportSet.getSoftwareCredits();
        expect(softwareCredits).toEqual(["Example credit text A", "Example credit text B", "Example credit text C"]);
    });
});
