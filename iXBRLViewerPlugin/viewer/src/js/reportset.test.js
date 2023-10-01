// See COPYRIGHT.md for copyright information

import { ReportSet } from "./reportset.js";
import { ViewerOptions } from "./viewerOptions.js";
import { viewerUniqueId } from "./util.js";
import { createNumericFact } from "./test-utils.js";

const multiReportTestData = {
    "features": [],
    "languages": {
        "en-us": "English (US)",
        "en": "English",
        "fr": "French",
    },
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": "http://www.xbrl.org/2003/iso4217"
    },
    "roles": {
        "role1": "https://www.example.com/role1",
        "role2": "https://www.example.com/role2",
        "role3": "https://www.example.com/role3",
        "role4": "https://www.example.com/role4"
    },
    "reports": [
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
            }
        },
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
            }
        }
    ]
};

// Legacy report data format - no "reports" array
const singleReportTestData = {
    "features": [],
    "languages": {
        "en-us": "English (US)",
        "en": "English",
        "fr": "French",
    },
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": "http://www.xbrl.org/2003/iso4217"
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
    }
};

describe("Multi report - basic", () => {
    const testReportSet = new ReportSet(multiReportTestData);
    testReportSet._initialize();
    test("Report count", () => {
        expect(testReportSet.reports).toHaveLength(2);
    });
});

describe("Multi report - Language options", () => {
    const testReportSet = new ReportSet(multiReportTestData);
    testReportSet._initialize();
    test("Available languages", () => {
        const al = testReportSet.availableLanguages();
        expect(al).toHaveLength(3);
        expect(al).toEqual(expect.arrayContaining(["en", "en-us", "en-gb"]));
    });

    test("Names for languages", () => {
        const ln = testReportSet.languageNames();
        expect(Object.keys(ln)).toHaveLength(3);
        expect(ln['en']).toBe("English");
        expect(ln['en-us']).toBe("English (US)");
        expect(ln['fr']).toBe("French");
    });
});

describe("Multi report - Fetching facts", () => {
    const testReportSet = new ReportSet(multiReportTestData);
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
    const testReportSet = new ReportSet(multiReportTestData);
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
    const testReportSet = new ReportSet(multiReportTestData);
    testReportSet._initialize();

    test("Present", () => {
        // Role 1 only has a label in report 1
        expect(testReportSet.reports[0].getRoleLabel("role1")).toBe("Role 1 Label");
        expect(testReportSet.reports[1].getRoleLabel("role1")).toBe("https://www.example.com/role1");
    });
});

describe("Single report - basic", () => {
    const testReportSet = new ReportSet(singleReportTestData);
    testReportSet._initialize();
    test("Report count", () => {
        expect(testReportSet.reports).toHaveLength(1);
    });
});

describe("Single report - Language options", () => {
    const testReportSet = new ReportSet(singleReportTestData);
    testReportSet._initialize();
    test("Available languages", () => {
        const al = testReportSet.availableLanguages();
        expect(al).toHaveLength(2);
        expect(al).toEqual(expect.arrayContaining(["en", "en-us"]));
    });

    test("Names for languages", () => {
        const ln = testReportSet.languageNames();
        expect(Object.keys(ln)).toHaveLength(3);
        expect(ln['en']).toBe("English");
        expect(ln['en-us']).toBe("English (US)");
        expect(ln['fr']).toBe("French");
    });
});

describe("Single report - Fetching facts", () => {
    const testReportSet = new ReportSet(singleReportTestData);
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
    const testReportSet = new ReportSet(singleReportTestData);
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
    const testReportSet = new ReportSet(singleReportTestData);
    testReportSet._initialize();

    test("Present", () => {
        expect(testReportSet.reports[0].getRoleLabel("role1")).toBe("Role 1 Label");
    });
});
