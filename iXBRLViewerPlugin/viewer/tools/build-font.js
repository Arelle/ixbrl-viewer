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
    const lessDir = path.join(srcDir, "less/generated");
    if (!fs.existsSync(lessDir)) {
        fs.mkdirSync(lessDir);
    }
    fs.writeFileSync(path.join(srcDir, "fonts/viewer-icons-min.woff"), result.woff);
    fs.writeFileSync(path.join(lessDir, "icons.less"), result.template);
  })
  .catch((error) => {
    throw error;
  });
