// See COPYRIGHT.md for copyright information

module.exports = {
    input: [
        "src/js/*.js",
        "src/html/*.html"
    ],
    output: "iXBRLViewerPlugin/viewer/src/i18n/$LOCALE/$NAMESPACE.json",
    locales: [ "en", "es" ],
    sort: true
};
