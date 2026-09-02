import $ from "jquery";
import { IXNode } from "./ixnode.js";
import { ReportSet } from "./reportset.js";
import { Viewer } from "./viewer.js";
import { NAMESPACE_ISO4217, viewerUniqueId } from "./util.js";

function highlightReportData(facts) {
    return {
        prefixes: {
            eg: "http://www.example.com",
            iso4217: NAMESPACE_ISO4217,
        },
        concepts: {
            "eg:Concept1": { labels: { std: { en: "A" } } },
            "other:Concept2": { labels: { std: { en: "B" } } },
        },
        facts,
        languages: {},
        roles: {},
        roleDefs: {},
        rels: {},
    };
}

function highlightFact(concept) {
    return {
        v: 1,
        a: {
            c: concept,
            u: "iso4217:USD",
            p: "2017-01-01/2018-01-01",
        },
    };
}

function appendHighlightWrapper(doc, className = "ixbrl-element") {
    const wrapper = doc.createElement("span");
    wrapper.className = className;
    doc.body.appendChild(wrapper);
    return wrapper;
}

function makeHighlightViewer(reviewMode = false, facts, buildNodes) {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    const factId = viewerUniqueId(0, "f1");
    const wrapper = buildNodes === undefined ? appendHighlightWrapper(doc) : undefined;
    if (wrapper !== undefined) {
        $(wrapper).data("ivids", [factId]);
    }
    const ixNodeMap = buildNodes === undefined
        ? { [factId]: new IXNode(factId, $(wrapper), 0) }
        : buildNodes(doc);
    const reportSet = new ReportSet(highlightReportData(facts ?? {
        f1: highlightFact("eg:Concept1"),
    }));
    reportSet.setIXNodeMap(ixNodeMap);
    const viewer = new Viewer(
        { options: {}, isReviewModeEnabled: () => reviewMode },
        $(iframe),
        reportSet
    );
    viewer._ixNodeMap = ixNodeMap;
    viewer.continuationOfMap = {};
    return { viewer, wrapper, doc };
}

describe("highlightAllTags", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("non-review mode toggles report-body highlighting", () => {
        const { viewer, wrapper, doc } = makeHighlightViewer(false);
        const groups = viewer._reportSet.namespaceGroups();

        viewer.highlightAllTags(true, groups);

        expect(doc.body.classList.contains("ixbrl-highlight-all")).toBe(true);
        expect(wrapper.classList.contains("ixbrl-highlight")).toBe(true);
        expect(wrapper.classList.contains("ixbrl-highlight-0")).toBe(true);

        viewer.highlightAllTags(false, groups);

        expect(doc.body.classList.contains("ixbrl-highlight-all")).toBe(false);
        expect(wrapper.classList.contains("ixbrl-highlight")).toBe(true);
        expect(wrapper.classList.contains("ixbrl-highlight-0")).toBe(true);
    });

    test("review mode toggles report body highlighting without node classes", () => {
        const { viewer, wrapper, doc } = makeHighlightViewer(true);
        const applyHighlightToFactWrappers = jest.spyOn(viewer, "_applyHighlightToFactWrappers");
        const groups = viewer._reportSet.namespaceGroups();

        viewer.highlightAllTags(true, groups);

        expect(doc.body.classList.contains("ixbrl-highlight-all")).toBe(true);
        expect(wrapper.classList.contains("ixbrl-highlight")).toBe(false);
        expect(wrapper.classList.contains("ixbrl-highlight-0")).toBe(false);
        expect(applyHighlightToFactWrappers).not.toHaveBeenCalled();

        viewer.highlightAllTags(false, groups);

        expect(doc.body.classList.contains("ixbrl-highlight-all")).toBe(false);
    });

    test("non-review mode prepares node classes only once", () => {
        const { viewer } = makeHighlightViewer(false);
        const applyHighlightToFactWrappers = jest.spyOn(viewer, "_applyHighlightToFactWrappers");
        const groups = viewer._reportSet.namespaceGroups();

        viewer.highlightAllTags(true, groups);
        viewer.highlightAllTags(false, groups);
        viewer.highlightAllTags(true, groups);

        expect(applyHighlightToFactWrappers).toHaveBeenCalledTimes(1);
    });

    test("review mode never prepares node classes", () => {
        const { viewer } = makeHighlightViewer(true);
        const applyHighlightToFactWrappers = jest.spyOn(viewer, "_applyHighlightToFactWrappers");
        const groups = viewer._reportSet.namespaceGroups();

        viewer.highlightAllTags(true, groups);
        viewer.highlightAllTags(false, groups);
        viewer.highlightAllTags(true, groups);

        expect(applyHighlightToFactWrappers).not.toHaveBeenCalled();
    });

    test("toggles highlighting on every report iframe body", () => {
        const { viewer, doc } = makeHighlightViewer(false);
        const secondIframe = document.createElement("iframe");
        document.body.appendChild(secondIframe);
        viewer._iframes = $([viewer._iframes.get(0), secondIframe]);

        viewer.highlightAllTags(true, viewer._reportSet.namespaceGroups());

        expect(doc.body.classList.contains("ixbrl-highlight-all")).toBe(true);
        expect(secondIframe.contentDocument.body.classList.contains("ixbrl-highlight-all")).toBe(true);

        viewer.highlightAllTags(false, viewer._reportSet.namespaceGroups());

        expect(doc.body.classList.contains("ixbrl-highlight-all")).toBe(false);
        expect(secondIframe.contentDocument.body.classList.contains("ixbrl-highlight-all")).toBe(false);
    });

    test("keeps namespace colors on primary fact wrappers", () => {
        const f1 = viewerUniqueId(0, "f1");
        const f2 = viewerUniqueId(0, "f2");
        const { viewer, doc } = makeHighlightViewer(
            false,
            {
                f1: highlightFact("eg:Concept1"),
                f2: highlightFact("other:Concept2"),
            },
            (reportDoc) => {
                const first = appendHighlightWrapper(reportDoc);
                const second = appendHighlightWrapper(reportDoc);
                return {
                    [f1]: new IXNode(f1, $(first), 0),
                    [f2]: new IXNode(f2, $(second), 0),
                };
            }
        );

        viewer.highlightAllTags(true, viewer._reportSet.namespaceGroups());

        const elements = [...doc.querySelectorAll(".ixbrl-element")];
        expect(elements[0].classList.contains("ixbrl-highlight-0")).toBe(true);
        expect(elements[1].classList.contains("ixbrl-highlight-1")).toBe(true);
    });

    test("colors continuation wrappers with their head fact", () => {
        const f1 = viewerUniqueId(0, "f1");
        const c1 = viewerUniqueId(0, "c1");
        const { viewer, doc } = makeHighlightViewer(
            false,
            { f1: highlightFact("eg:Concept1") },
            (reportDoc) => {
                const headWrapper = appendHighlightWrapper(reportDoc);
                const continuationWrapper = appendHighlightWrapper(reportDoc);
                const head = new IXNode(f1, $(headWrapper), 0);
                const continuation = new IXNode(c1, $(continuationWrapper), 0);
                head.continuations = [continuation];
                return { [f1]: head, [c1]: continuation };
            }
        );
        viewer.continuationOfMap = { [c1]: f1 };

        viewer.highlightAllTags(true, viewer._reportSet.namespaceGroups());

        const elements = [...doc.querySelectorAll(".ixbrl-element")];
        expect(elements[0].classList.contains("ixbrl-highlight-0")).toBe(true);
        expect(elements[1].classList.contains("ixbrl-highlight-0")).toBe(true);
    });

    test("prepares each mapped chain node once", () => {
        const f1 = viewerUniqueId(0, "f1");
        const f2 = viewerUniqueId(0, "f2");
        const c1 = viewerUniqueId(0, "c1");
        const { viewer } = makeHighlightViewer(
            false,
            {
                f1: highlightFact("eg:Concept1"),
                f2: highlightFact("other:Concept2"),
            },
            (reportDoc) => {
                const first = new IXNode(f1, $(appendHighlightWrapper(reportDoc)), 0);
                const second = new IXNode(f2, $(appendHighlightWrapper(reportDoc)), 0);
                const continuation = new IXNode(c1, $(appendHighlightWrapper(reportDoc)), 0);
                first.continuations = [continuation];
                second.continuations = [continuation];
                return { [f1]: first, [f2]: second, [c1]: continuation };
            }
        );
        viewer.continuationOfMap = { [c1]: f1 };
        const highlightPrimaryWrappers = jest.spyOn(viewer, "_highlightPrimaryWrappers");

        viewer.highlightAllTags(true, viewer._reportSet.namespaceGroups());

        expect(highlightPrimaryWrappers).toHaveBeenCalledTimes(3);
    });

    test("does not color sub-elements as primary wrappers", () => {
        const f1 = viewerUniqueId(0, "f1");
        let subElement;
        const { viewer, doc } = makeHighlightViewer(
            false,
            { f1: highlightFact("eg:Concept1") },
            (reportDoc) => {
                const primary = appendHighlightWrapper(reportDoc);
                subElement = appendHighlightWrapper(reportDoc, "ixbrl-sub-element");
                return { [f1]: new IXNode(f1, $(primary).add(subElement), 0) };
            }
        );

        viewer.highlightAllTags(true, viewer._reportSet.namespaceGroups());

        expect(doc.querySelector(".ixbrl-element").classList.contains("ixbrl-highlight-0")).toBe(true);
        expect(doc.querySelector(".ixbrl-element").classList.contains("ixbrl-highlight")).toBe(true);
        expect(subElement.classList.contains("ixbrl-highlight")).toBe(false);
        expect(subElement.classList.contains("ixbrl-highlight-0")).toBe(false);
    });

    test("keeps the first namespace color on a double-tagged wrapper", () => {
        const f1 = viewerUniqueId(0, "f1");
        const f2 = viewerUniqueId(0, "f2");
        const { viewer, doc } = makeHighlightViewer(
            false,
            {
                f1: highlightFact("eg:Concept1"),
                f2: highlightFact("other:Concept2"),
            },
            (reportDoc) => {
                const wrapper = appendHighlightWrapper(reportDoc);
                const wrappedNode = $(wrapper);
                return {
                    [f1]: new IXNode(f1, wrappedNode, 0),
                    [f2]: new IXNode(f2, wrappedNode, 0),
                };
            }
        );

        viewer.highlightAllTags(true, viewer._reportSet.namespaceGroups());

        const element = doc.querySelector(".ixbrl-element");
        expect(element.classList.contains("ixbrl-highlight-0")).toBe(true);
        expect(element.classList.contains("ixbrl-highlight-1")).toBe(false);
    });
});
