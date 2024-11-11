// See COPYRIGHT.md for copyright information

import { FactSet } from "./factset.js";
import { Fact  } from "./fact.js";
import { NAMESPACE_ISO4217, viewerUniqueId } from "./util.js";
import { ReportSet } from "./reportset.js";
import './test-utils.js';

var i = 0;

var testReportData = {
    "prefixes": {
        "eg": "http://www.example.com",
        "iso4217": NAMESPACE_ISO4217,
        "e": "http://example.com/entity",
    },
    "concepts": {
        "eg:Concept1": {
            "labels": {
                "std": {
                    "en": "Concept 1"
                }
            }
        },
        "eg:Concept2": {
            "labels": {
                "std": {
                    "en": "Concept 2"
                }
            }
        },
        "eg:Concept3": {
            "labels": {
                "std": {
                    "en": "Concept 3"
                }
            }
        },
        "eg:Concept4": {
            "labels": {
            }
        },
        "eg:Dimension1": {
            "labels": {
                "std": {
                    "en": "Dimension 1"
                }
            }
        },
        "eg:Dimension2": {
            "labels": {
                "std": {
                    "en": "Dimension 2"
                }
            }
        },
        "eg:DimensionValue1": {
            "labels": {
                "std": {
                    "en": "Dimension Value 1"
                }
            }
        },
        "eg:DimensionValue2": {
            "labels": {
                "std": {
                    "en": "Dimension Value 2"
                }
            }
        }
    },
    "facts": {
    }
};

function testReportSet(facts) {
    // Deep copy of standing data
    const data = JSON.parse(JSON.stringify(testReportData));
    data.facts = facts;
    const reportset = new ReportSet(data);
    reportset._initialize();
    return reportset;
}

function testFact(aspectData) {
    var factData = { "a": aspectData };
    return factData;
}

function getFact(reportSet, id) {
  return reportSet.getItemById(viewerUniqueId(0, id));
}

describe("Minimally unique labels (non-dimensional)", () => {
  const reportSet = testReportSet({ 
      "f1": testFact({"c": "eg:Concept1", "p": "2018-01-01"}),
      "f2": testFact({"c": "eg:Concept2", "p": "2018-01-01"}),
      "f3": testFact({"c": "eg:Concept2", "p": "2019-01-01"}),
      "f4": testFact({"c": "eg:Concept2", "p": "2019-01-01"}),
  });

  const f1 = getFact(reportSet, "f1");
  const f2 = getFact(reportSet, "f2");
  const f3 = getFact(reportSet, "f3");
  const f4 = getFact(reportSet, "f4");

  test("Different concept", () => {
    const fs = new FactSet([ f1, f2 ]);
    expect(fs._allDimensions()).toEqual([]);
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Concept 1");
    expect(fs.minimallyUniqueLabel(f2)).toEqual("Concept 2");
  });

  test("Different period", () => {
    const fs = new FactSet([ f2, f3 ]);
    expect(fs._allDimensions()).toEqual([]);
    expect(fs.minimallyUniqueLabel(f2)).toEqual("31 Dec 2017");
    expect(fs.minimallyUniqueLabel(f3)).toEqual("31 Dec 2018");
  });

  test("Different concept and period, concept takes precedence", () => {
    const fs = new FactSet([ f1, f4 ]);
    expect(fs._allDimensions()).toEqual([]);
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Concept 1");
    expect(fs.minimallyUniqueLabel(f4)).toEqual("Concept 2");
  });

  test("Mix of period and concept differences", () => {
    const fs = new FactSet([ f1, f2, f3 ]);
    expect(fs._allDimensions()).toEqual([]);
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Concept 1, 31 Dec 2017");
    expect(fs.minimallyUniqueLabel(f2)).toEqual("Concept 2, 31 Dec 2017");
    expect(fs.minimallyUniqueLabel(f3)).toEqual("Concept 2, 31 Dec 2018");
  });
});

describe("Minimally unique labels (dimensional)", () => {
  const reportSet = testReportSet({ 
      "f1": testFact({"c": "eg:Concept1", "p": "2018-01-01", "eg:Dimension1": "eg:DimensionValue1"}),
      "f2": testFact({"c": "eg:Concept1", "p": "2018-01-01", "eg:Dimension1": "eg:DimensionValue2"}),
      "f3": testFact({"c": "eg:Concept1", "p": "2019-01-01", "eg:Dimension1": "eg:DimensionValue2"}),
      "f4": testFact({"c": "eg:Concept1", "p": "2018-01-01" }),
  });

  const f1 = getFact(reportSet, "f1");
  const f2 = getFact(reportSet, "f2");
  const f3 = getFact(reportSet, "f3");
  const f4 = getFact(reportSet, "f4");

  test("Same concept & period, different dimension value", () => {
    const fs = new FactSet([ f1, f2 ]);
    expect(fs._allDimensions()).toEqual(["eg:Dimension1"]);
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Dimension Value 1");
    expect(fs.minimallyUniqueLabel(f2)).toEqual("Dimension Value 2");
  });

  test("Different period, different dimension value", () => {
    const fs = new FactSet([ f1, f3 ]);
    expect(fs._allDimensions()).toEqual(["eg:Dimension1"]);
    /* Different period takes precedence */
    expect(fs.minimallyUniqueLabel(f1)).toEqual("31 Dec 2017");
    expect(fs.minimallyUniqueLabel(f3)).toEqual("31 Dec 2018");
  });

  test("Dimension present on one fact only", () => {
    const fs = new FactSet([ f1, f4 ]);
    expect(fs._allDimensions()).toEqual(["eg:Dimension1"]);
    /* Concept is included even though it's the same across all to avoid an
     * empty label */
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Concept 1, Dimension Value 1");
    expect(fs.minimallyUniqueLabel(f4)).toEqual("Concept 1");
  });

});

describe("Minimally unique labels (duplicate facts)", () => {
  const reportSet = testReportSet({ 
      "f1": testFact({"c": "eg:Concept1", "p": "2018-01-01", "eg:Dimension1": "eg:DimensionValue1"}),
      "f2": testFact({"c": "eg:Concept1", "p": "2018-01-01", "eg:Dimension1": "eg:DimensionValue1"}),
  });

  const f1 = getFact(reportSet, "f1");
  const f2 = getFact(reportSet, "f2");

  test("Two facts, all aspects the same", () => {
    const fs = new FactSet([ f1, f2 ]);
    expect(fs._allDimensions()).toEqual(["eg:Dimension1"]);
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Concept 1");
    expect(fs.minimallyUniqueLabel(f2)).toEqual("Concept 1");
  });
});

describe("Minimally unique labels (missing labels)", () => {
  const reportSet = testReportSet({ 
      "f1": testFact({"c": "eg:Concept1", "p": "2018-01-01" }),
      "f2": testFact({"c": "eg:Concept4", "p": "2018-01-01" }),
  });

  const f1 = getFact(reportSet, "f1");
  const f2 = getFact(reportSet, "f2");

  test("Two facts, one has no label", () => {
    var fs = new FactSet([ f1, f2 ]);
    expect(fs._allDimensions()).toEqual([]);
    expect(fs.minimallyUniqueLabel(f1)).toEqual("Concept 1");
    expect(fs.minimallyUniqueLabel(f2)).toEqual("eg:Concept4");
  });
});

function numericTestFact(value, decimals) {
    var factData = { "d": decimals, "v": value, "a": { "c": "eg:Concept1", "u": "eg:pure" }};
    return factData;
}

describe("Consistency", () => {
    const reportSet = testReportSet({ 
        "f1": numericTestFact(150, -1), // 145-155
        "f2": numericTestFact(200, -2), // 150-250
        "f3": numericTestFact(140, -1), // 135-145
    });

    const f1 = getFact(reportSet, "f1");
    const f2 = getFact(reportSet, "f2");
    const f3 = getFact(reportSet, "f3");

    test("Inconsistent fact set", () => {
      const factSet = new FactSet([f1, f2, f3]);
      expect(factSet.valueIntersection()).toBeUndefined();
      expect(factSet.isConsistent()).toBeFalsy();
    });

    test("Consistent fact sets - overlap", () => {
      const factSet = new FactSet([f1, f2]);
      const intersection = factSet.valueIntersection();
      expect(intersection.a).toEqualDecimal(150);
      expect(intersection.b).toEqualDecimal(155);
      expect(factSet.isConsistent()).toBeTruthy();
    });

    test("Consistent fact sets - bounds coincide", () => {
      const factSet = new FactSet([f1, f3]);
      const intersection = factSet.valueIntersection();
      expect(intersection.a).toEqualDecimal(145);
      expect(intersection.b).toEqualDecimal(145);
      expect(factSet.isConsistent()).toBeTruthy();
    });
  
});

describe("Most precise", () => {
    const reportSet = testReportSet({ 
        "f1": numericTestFact(150, -1), 
        "f2": numericTestFact(200, 0), 
        "f3": numericTestFact(140, 2),
        "f4": numericTestFact(160, undefined)
    });

    const f1 = getFact(reportSet, "f1");
    const f2 = getFact(reportSet, "f2");
    const f3 = getFact(reportSet, "f3");
    const f4 = getFact(reportSet, "f4");

    test("Most precise - finite decimals", () => {
        const factSet = new FactSet([f1, f2, f3]);
        expect(factSet.mostPrecise()).toEqual(f3);
    });

    test("Most precise - mixture of finite and infinite", () => {
        const factSet = new FactSet([f1, f2, f3, f4]);
        expect(factSet.mostPrecise()).toEqual(f4);
    });
});
