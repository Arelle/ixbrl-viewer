const webfont = require("webfont").default;
const fs = require("fs");
const path = require("path");

const srcDir = "iXBRLViewerPlugin/viewer/src";

webfont({
  files: path.join(srcDir, "icons/*.svg"),
  fontName: "ixbrlviewer",
  template: path.join(srcDir, "less/icons.less.njk"),
  formats: ['woff'],
})
  .then((result) => {
    fs.mkdir(path.join(srcDir, "less/generated"), (err) => { if (err) { throw err } });
    fs.writeFile(path.join(srcDir, "fonts/viewer-icons-min.woff"), result.woff, err => { if (err) { throw err } });
    fs.writeFile(path.join(srcDir, "less/generated/icons.less"), result.template, err => { if (err) { throw err } });
  })
  .catch((error) => {
    throw error;
  });
