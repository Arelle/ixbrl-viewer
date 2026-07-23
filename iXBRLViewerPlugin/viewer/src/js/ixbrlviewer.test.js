// See COPYRIGHT.md for copyright information

import {iXBRLViewer} from "./ixbrlviewer";
import {
    FEATURE_GUIDE_LINK,
    FEATURE_HOME_LINK_LABEL,
    FEATURE_HOME_LINK_URL,
    FEATURE_REVIEW,
    FEATURE_SUPPORT_LINK,
    FEATURE_SURVEY_LINK,
    USER_GUIDE_URL,
} from "./util";
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
        viewer.setFeatures({[FEATURE_REVIEW]: true}, '')
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
        viewer.setFeatures({[FEATURE_SUPPORT_LINK]: '/help'}, '')
        expect(viewer.getSupportLinkUrl()).toEqual('/help');
    });

    test("Support link enabled by query", () => {
        viewer.setFeatures({}, FEATURE_SUPPORT_LINK + '=/help')
        expect(viewer.getSupportLinkUrl()).toEqual(null);
    });

    test("Support link disabled by query", () => {
        viewer.setFeatures({[FEATURE_SUPPORT_LINK]: '/help'}, FEATURE_SUPPORT_LINK + '=false')
        expect(viewer.getSupportLinkUrl()).toEqual('/help');
    });
});

describe("Survey link enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Survey link enabled by JSON", () => {
        viewer.setFeatures({[FEATURE_SURVEY_LINK]: '/survey'}, '')
        expect(viewer.getSurveyLinkUrl()).toEqual('/survey');
    });

    test("Survey link enabled by query", () => {
        viewer.setFeatures({}, FEATURE_SURVEY_LINK + '=/survey')
        expect(viewer.getSurveyLinkUrl()).toEqual(null);
    });

    test("Survey link disabled by query", () => {
        viewer.setFeatures({[FEATURE_SURVEY_LINK]: '/survey'}, FEATURE_SURVEY_LINK + '=false')
        expect(viewer.getSurveyLinkUrl()).toEqual('/survey');
    });
});

describe("Home link feature values", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("getStaticFeatureValue returns configured home link url and label", () => {
        viewer.setFeatures({[FEATURE_HOME_LINK_URL]: '/home', [FEATURE_HOME_LINK_LABEL]: 'Home'}, '')
        expect(viewer.getStaticFeatureValue(FEATURE_HOME_LINK_URL)).toEqual('/home');
        expect(viewer.getStaticFeatureValue(FEATURE_HOME_LINK_LABEL)).toEqual('Home');
    });

    test("Query string cannot override static-only home link url", () => {
        viewer.setFeatures({[FEATURE_HOME_LINK_URL]: '/home'}, FEATURE_HOME_LINK_URL + '=/other')
        expect(viewer.getStaticFeatureValue(FEATURE_HOME_LINK_URL)).toEqual('/home');
    });

    test("Query string cannot override static-only home link label", () => {
        viewer.setFeatures({[FEATURE_HOME_LINK_LABEL]: 'Home'}, FEATURE_HOME_LINK_LABEL + '=Other')
        expect(viewer.getStaticFeatureValue(FEATURE_HOME_LINK_LABEL)).toEqual('Home');
    });
});

describe("Guide link enablement", () => {
    var viewer = null;
    beforeAll(() => {
        viewer = new iXBRLViewer({})
    });

    test("Guide link enabled by JSON", () => {
        viewer.setFeatures({[FEATURE_GUIDE_LINK]: '/guide'}, '')
        expect(viewer.getGuideLinkUrl()).toEqual('/guide');
    });

    test("Guide link enabled by query", () => {
        viewer.setFeatures({}, FEATURE_GUIDE_LINK + '=/guide')
        expect(viewer.getGuideLinkUrl()).toEqual(USER_GUIDE_URL);
    });

    test("Guide link disabled by query", () => {
        viewer.setFeatures({[FEATURE_GUIDE_LINK]: '/guide'}, FEATURE_GUIDE_LINK + '=false')
        expect(viewer.getGuideLinkUrl()).toEqual('/guide');
    });
});
