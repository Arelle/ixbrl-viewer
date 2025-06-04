// See COPYRIGHT.md for copyright information

module.exports = {
    input: [
        "src/js/*.js",
        "src/html/*.html"
    ],
    output: "iXBRLViewerPlugin/viewer/src/i18n/$LOCALE/$NAMESPACE.json",
    locales: [ "cy", "da", "de", "en", "es", "fr", "nl", "uk" ],
    sort: true
};
