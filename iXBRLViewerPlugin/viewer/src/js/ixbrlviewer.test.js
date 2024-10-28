// See COPYRIGHT.md for copyright information

import {iXBRLViewer} from "./ixbrlviewer";
describe("Feature enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Query parameter with no value results in enablement", () => {
        viewer.setFeatures({}, 'a')
        expect(viewer._staticFeatures).toEqual({});
        expect(viewer._dynamicFeatures).toEqual({'a': 'true'});
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Excluded from JSON, excluded from query", () => {
        viewer.setFeatures({}, '')
        expect(viewer._staticFeatures).toEqual({});
        expect(viewer._dynamicFeatures).toEqual({});
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Excluded from JSON, enabled in query", () => {
        viewer.setFeatures({}, 'a=true')
        expect(viewer._staticFeatures).toEqual({});
        expect(viewer._dynamicFeatures).toEqual({'a': 'true'});
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Excluded from JSON, disabled in query", () => {
        viewer.setFeatures({}, 'a=false')
        expect(viewer._staticFeatures).toEqual({});
        expect(viewer._dynamicFeatures).toEqual({'a': 'false'});
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Excluded from JSON, enabled and disabled in query", () => {
        viewer.setFeatures({}, 'a=true&a=false&a')
        expect(viewer._staticFeatures).toEqual({});
        expect(viewer._dynamicFeatures).toEqual({'a': 'false'});
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Included in JSON, excluded from query", () => {
        viewer.setFeatures({'a': true}, '')
        expect(viewer._staticFeatures).toEqual({'a': true});
        expect(viewer._dynamicFeatures).toEqual({});
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Included in JSON, enabled in query", () => {
        viewer.setFeatures({'a': true}, 'a=true')
        expect(viewer._staticFeatures).toEqual({'a': true});
        expect(viewer._dynamicFeatures).toEqual({'a': 'true'});
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Included in JSON, disabled in query", () => {
        viewer.setFeatures({'a': true}, 'a=false')
        expect(viewer._staticFeatures).toEqual({'a': true});
        expect(viewer._dynamicFeatures).toEqual({'a': 'false'});
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Included in JSON, enabled and disabled in query", () => {
        viewer.setFeatures({'a': true}, 'a=true&a=false&a')
        expect(viewer._staticFeatures).toEqual({'a': true});
        expect(viewer._dynamicFeatures).toEqual({'a': 'false'});
        expect(viewer.isFeatureEnabled('a')).toBeFalsy();
    });

    test("Value set in JSON, not included in query", () => {
        viewer.setFeatures({'a': '1'}, '')
        expect(viewer._staticFeatures).toEqual({'a': '1'});
        expect(viewer._dynamicFeatures).toEqual({});
        expect(viewer.getFeatureValue('a')).toEqual('1');
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Value not set in JSON, set in query", () => {
        viewer.setFeatures({}, 'a=1')
        expect(viewer._staticFeatures).toEqual({});
        expect(viewer._dynamicFeatures).toEqual({'a': '1'});
        expect(viewer.getFeatureValue('a')).toEqual('1');
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Value set in JSON, overwritten in query", () => {
        viewer.setFeatures({'a': '1'}, 'a=2')
        expect(viewer._staticFeatures).toEqual({'a': '1'});
        expect(viewer._dynamicFeatures).toEqual({'a': '2'});
        expect(viewer.getFeatureValue('a')).toEqual('2');
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });

    test("Value set in JSON, overwritten in query with blank", () => {
        viewer.setFeatures({'a': '1'}, 'a')
        expect(viewer._staticFeatures).toEqual({'a': '1'});
        expect(viewer._dynamicFeatures).toEqual({'a': 'true'});
        expect(viewer.getFeatureValue('a')).toEqual('true');
        expect(viewer.isFeatureEnabled('a')).toBeTruthy();
    });
});

describe("Review mode enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Review mode enabled", () => {
        viewer.setFeatures({'review': true}, '')
        expect(viewer.isReviewModeEnabled()).toBeTruthy();
    });

    test("Review mode disabled", () => {
        viewer.setFeatures({'a': true}, '')
        expect(viewer.isReviewModeEnabled()).toBeFalsy();
    });
});

describe("Support link enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Support link enabled by JSON", () => {
        viewer.setFeatures({'support-link': '/help'}, '')
        expect(viewer.getSupportLinkUrl()).toEqual('/help');
    });

    test("Support link enabled by query", () => {
        viewer.setFeatures({}, 'support-link=/help')
        expect(viewer.getSupportLinkUrl()).toEqual(null);
    });

    test("Support link disabled by query", () => {
        viewer.setFeatures({'support-link': '/help'}, 'support-link=false')
        expect(viewer.getSupportLinkUrl()).toEqual('/help');
    });
});
