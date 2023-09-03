const webfont = require("webfont").default;
const fs = require("fs");
const path = require("path");

const srcDir = path.join("iXBRLViewerPlugin", "viewer", "src");

webfont({
  files: "iXBRLViewerPlugin/viewer/src/icons/*.svg",
  fontName: "ixbrlviewer",
  template: path.join(srcDir, "less", "icons.less.njk"),
  formats: ['woff'],
})
  .then((result) => {
    const lessDir = path.join(srcDir, "less", "generated");
    if (!fs.existsSync(lessDir)) {
        fs.mkdirSync(lessDir);
    }
    const fontsDir = path.join(srcDir, "fonts");
    if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir);
    }
    fs.writeFileSync(path.join(fontsDir, "viewer-icons-min.woff"), result.woff);
    fs.writeFileSync(path.join(lessDir, "icons.less"), result.template);
  })
  .catch((error) => {
    throw error;
  });
