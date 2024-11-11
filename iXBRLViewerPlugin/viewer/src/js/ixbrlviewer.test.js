// See COPYRIGHT.md for copyright information

import {iXBRLViewer} from "./ixbrlviewer";
describe("Feature enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Query parameter with no value results in enablement", () => {
        viewer.setFeatures([], 'a')
        expect(viewer._features).toEqual(new Set(['a']));
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Excluded from JSON, excluded from query", () => {
        viewer.setFeatures([], '')
        expect(viewer._features).toEqual(new Set([]));
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Excluded from JSON, enabled in query", () => {
        viewer.setFeatures([], 'a=true')
        expect(viewer._features).toEqual(new Set(['a']));
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Excluded from JSON, disabled in query", () => {
        viewer.setFeatures([], 'a=false')
        expect(viewer._features).toEqual(new Set([]));
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Excluded from JSON, enabled and disabled in query", () => {
        viewer.setFeatures([], 'a=true&a=false&a')
        expect(viewer._features).toEqual(new Set([]));
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Included in JSON, excluded from query", () => {
        viewer.setFeatures(['a'], '')
        expect(viewer._features).toEqual(new Set(['a']));
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Included in JSON, enabled in query", () => {
        viewer.setFeatures(['a'], 'a=true')
        expect(viewer._features).toEqual(new Set(['a']));
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Included in JSON, disabled in query", () => {
        viewer.setFeatures(['a'], 'a=false')
        expect(viewer._features).toEqual(new Set([]));
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Included in JSON, enabled and disabled in query", () => {
        viewer.setFeatures(['a'], 'a=true&a=false&a')
        expect(viewer._features).toEqual(new Set([]));
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });
});

describe("Review mode enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Review mode enabled", () => {
        viewer.setFeatures(['review'], '')
        expect(viewer.isReviewModeEnabled()).toBeTruthy();
    });

    test("Review mode disabled", () => {
        viewer.setFeatures(['a'], '')
        expect(viewer.isReviewModeEnabled()).toBeFalsy();
    });
});
