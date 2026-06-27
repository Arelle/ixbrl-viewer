import { iXBRLViewer } from "ixbrl-viewer";
import { D6ExtendedViewer } from "./d6-plugin.js";

const scriptSrc = document.currentScript && document.currentScript.src;

const loadPlugin = () => {
  const options = {};
  if (scriptSrc) {
    const configUrl = new URL("ixbrlviewer.config.json", scriptSrc);
    if (configUrl.protocol !== "file:") {
      options.configUrl = configUrl;
    }
  }
  const iv = new iXBRLViewer(options);
  iv.registerPlugin(new D6ExtendedViewer(iv));
  iv.load();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadPlugin);
} else {
  loadPlugin();
}
